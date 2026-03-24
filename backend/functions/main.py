"""
main.py - Firebase Cloud Functions Entry Point for Taksis

This is the main entry point for all Firebase Cloud Functions. It exposes:
- HTTP endpoints for the mobile app to call
- Scheduled functions for automated tasks (schedule generation, notifications, etc.)
- Firestore triggers for reactive updates

Function Categories:
1. Schedule Management - Generate, modify, and query deacon schedules
2. User Management - CRUD operations for users and children
3. Notifications - Liturgy reminders, schedule updates, servants meetings
4. Attendance Sheets - Google Sheets/Excel generation
5. Maintenance - Age updates, yearly cleanup, test utilities

Scheduled Jobs Summary (all times Eastern):
- Sunday 12:00 AM: Update user ages
- Sunday 12:30 PM: Servants meeting reminder
- Sunday 3:45 PM: Update lastServe for today's servers
- Sunday 4:00 PM: Generate next week's schedule
- Sunday 4:15 PM: First liturgy reminder (for next Sunday)
- Friday 8:00 PM: Second liturgy reminder
- Saturday 9:00 AM: Third liturgy reminder
- Monday 12:00 AM: Generate attendance sheets
- September 11 12:00 AM: New school year cleanup
"""
import datetime
from firebase_functions import scheduler_fn as _sched_mod

_original_strptime = datetime.datetime.strptime

class _PatchedDatetime(datetime.datetime):
    @classmethod
    def strptime(cls, data_string, fmt):
        if fmt == "%Y-%m-%dT%H:%M:%S%z":
            for f in ("%Y-%m-%dT%H:%M:%S.%f%z", "%Y-%m-%dT%H:%M:%S%z"):
                try:
                    return _original_strptime(data_string, f)
                except ValueError:
                    continue
        return _original_strptime(data_string, fmt)

# Patch the datetime module reference inside scheduler_fn
_sched_mod._dt.datetime = _PatchedDatetime

from typing import Any, List, Dict
import random
import uuid
import asyncio
import math
from firebase_functions import https_fn, scheduler_fn, firestore_fn
from firebase_admin import initialize_app, firestore, credentials, auth, messaging
import google.cloud.firestore
from google.cloud import firestore
import requests
from flask import Request
import re
import os
import sys
import json
import logging


# ============================================================================
# MODULE IMPORTS WITH PATH FIXING
# Firebase emulator runs from project root, deployed functions run from /functions
# This handles both cases to ensure imports work correctly
# ============================================================================

logging.info(f"Python version: {sys.version}")
logging.info(f"Current working directory: {os.getcwd()}")

# Detect environment and fix import path
if os.path.exists('functions') and os.path.isdir('functions'):
    # Running from project root (Firebase emulator)
    functions_dir = os.path.abspath('functions')
    sys.path.insert(0, functions_dir)
    logging.info(f"Running from project root, added functions to path: {functions_dir}")
    logging.info(f"Files in functions directory: {os.listdir('functions')}")
else:
    # Running from functions directory (deployed)
    logging.info(f"Running from functions directory")
    logging.info(f"Files in current directory: {os.listdir('.')}")

# Import attendance sheet modules (optional - may not be available in all environments)
try:
    from attendance_sheets import set_up_sheets
    from servants_attendance_sheets import set_up_sheets_servants
    logging.info("✅ Successfully imported attendance_sheets")
    ATTENDANCE_AVAILABLE = True
except ImportError as e:
    logging.info(f"❌ Failed to import attendance_sheets: {e}")
    logging.info(f"Current sys.path: {sys.path}")
    ATTENDANCE_AVAILABLE = False
    def set_up_sheets():
        raise NotImplementedError("attendance_sheets module not available")
    
# Import core modules with availability flags for graceful degradation
try:
    from files.schedule_generation import *
    SCHEDULE_AVSAILABLE = True
    logging.info("✅ Successfully imported schedule_generation")
except ImportError as e:
    SCHEDULE_AVSAILABLE = False
    logging.info(f"❌ Failed to import schedule_generation: {e}")    

try:
    from files.user_updates import *
    USER_UPDATES_AVAILABLE = True
    logging.info("✅ Successfully imported user_updates")
except ImportError as e:
    USER_UPDATES_AVAILABLE = False
    logging.info(f"❌ Failed to import user_updates: {e}")

try:
    from files.notification_manager import *
    NOTIFICATION_MANAGER_AVAILABLE = True
    logging.info("✅ Successfully imported notification_manager")
except ImportError as e:
    NOTIFICATION_MANAGER_AVAILABLE = False
    logging.info(f"❌ Failed to import notification_manager: {e}")

try:
    from files.utility import *
    UTILITY_AVAILABLE = True
    logging.info("✅ Successfully imported utility")
except ImportError as e:
    UTILITY_AVAILABLE = False
    logging.info(f"❌ Failed to import utility: {e}")

try:
    from files.new_years import *
    NEW_YEARS_AVAILABLE = True
    logging.info("✅ Successfully imported new_years")
except ImportError as e:
    NEW_YEARS_AVAILABLE = False
    logging.info(f"❌ Failed to import new_years: {e}")

# Initialize Firebase Admin SDK
initialize_app()


# ============================================================================
# SCHEDULE GENERATION ENDPOINTS
# ============================================================================

@https_fn.on_request()
def force_generate_schedule(req: https_fn.Request) -> https_fn.Response:
    asyncio.run(my_async_scheduled_function())
    return https_fn.Response(
        response="Schedule generation triggered successfully.",
        status=200
    )



@scheduler_fn.on_schedule(
    schedule="0 16 * * 0",  # Every Sunday at 4:00 PM Eastern
    timezone=scheduler_fn.Timezone("America/New_York"),
)
def generate_schedule(event: scheduler_fn.ScheduledEvent):
    """
    Weekly scheduled job: Generates next week's schedule for all churches.
    Runs Sunday 4PM after services conclude.
    """
    return asyncio.run(my_async_scheduled_function())


# ============================================================================
# USER MANAGEMENT ENDPOINTS
# ============================================================================

@https_fn.on_request()
def update_user(req: https_fn.Request) -> https_fn.Response:
    """
    Updates a user's church membership and syncs data across the system.
    
    Called when user profile changes. Handles:
    - Removing from old church
    - Calculating age from DOB
    - Adding to new church's deacon/servant lists
    - Updating children's ages
    - Syncing name across all schedules
    """
    try:
        request_data = req.get_json()
        if request_data is None:
            return https_fn.Response("Missing JSON body", status=400)
    except Exception as e:
        return https_fn.Response(f"Invalid JSON: {str(e)}", status=400)

    user_id = request_data.get("uid")
    if not user_id:
        return https_fn.Response("Missing 'uid' parameter", status=400)

    # Optional auth verification
    id_token = req.headers.get("Authorization")
    if id_token:
        try:
            decoded_token = auth.verify_id_token(id_token.split("Bearer ")[-1])
        except Exception as e:
            return https_fn.Response(f"Token verification failed: {str(e)}", status=401)

    firestore_client = firestore.Client()

    # Fetch user data
    try:
        doc_ref = firestore_client.collection("users").document(user_id)
        doc = doc_ref.get()
        if not doc.exists:
            return https_fn.Response("User document not found", status=404)
        user_data = doc.to_dict()
    except Exception as e:
        return https_fn.Response(f"Error retrieving user data: {str(e)}", status=500)

    # Recalculate ages and write only if something changed
    age_update = {}
    if "DOB" in user_data:
        current_age = calc_age(user_data["DOB"])
        if user_data.get("age") != current_age:
            user_data["age"] = current_age
            age_update["age"] = current_age
    if "children" in user_data:
        children_changed = False
        for child in user_data["children"]:
            if "DOB" in child:
                new_age = calc_age(child["DOB"])
                if child.get("age") != new_age:
                    child["age"] = new_age
                    children_changed = True
        if children_changed:
            age_update["children"] = user_data["children"]
    if age_update:
        doc_ref.update(age_update)

    church_id = user_data.get("church")
    if not church_id:
        return https_fn.Response("User update completed successfully", status=200)

    # Check what the church doc currently has for this user
    church_doc = firestore_client.collection("churches").document(church_id).get()
    church_data = church_doc.to_dict() if church_doc.exists else {}
    existing_deacon = next(
        (d for d in church_data.get("deacons", []) if d.get("uid") == user_id),
        None
    )
    servant_doc = (
        firestore_client.collection("churches")
        .document(church_id)
        .collection("Servants Meeting")
        .document(user_id)
        .get()
    )
    is_deacon = bool(user_data.get("isDeacon"))
    is_ss_teacher = bool(user_data.get("isSSTeacher"))

    # Membership is correct if:
    # - isDeacon matches whether user is in deacons[] with up-to-date name/age
    # - isSSTeacher matches whether user is in Servants Meeting
    deacon_ok = (
        (is_deacon and existing_deacon is not None
         and existing_deacon.get("name") == user_data.get("name")
         and existing_deacon.get("age") == user_data.get("age"))
        or (not is_deacon and existing_deacon is None)
    )
    servant_ok = (is_ss_teacher == servant_doc.exists)

    needs_membership_sync = not (deacon_ok and servant_ok)
    needs_name_sync = (
        existing_deacon is not None
        and existing_deacon.get("name") != user_data.get("name")
    )

    if needs_membership_sync:
        remove_user_from_churches(user_id)
        add_user_to_churches(user_data)

    if needs_name_sync:
        update_names(user_id, user_data["name"], church_id)

    return https_fn.Response("User update completed successfully", status=200)


@https_fn.on_request()
def update_user_frequency(req: https_fn.Request) -> https_fn.Response:
    """
    Decays frequency score for all users (batch operation).
    Frequency affects scheduling priority - higher = more likely to be scheduled.
    """
    id_token = req.headers.get("Authorization")
    if id_token:
        try:
            decoded_token = auth.verify_id_token(id_token.split("Bearer ")[-1])
        except Exception as e:
            return https_fn.Response(f"Token verification failed: {str(e)}", status=401)

    firestore_client = firestore.Client()
    users_docs = firestore_client.collection("users").stream()
    
    for user in users_docs:
        user_data = user.reference.get().to_dict()
        church_ref = firestore_client.collection("churches").document(user_data["church"])
        church_data = church_ref.get().to_dict()
        frequency = user_data["frequency"]
        church_location = church_data["location"]
        user_location = user_data["location"]
        
        if not user_location:
            return https_fn.Response(f"No location found for user", status=500)
        else:
            # Decay by 10%, floor at 0.5
            frequency *= 0.9
            if frequency < 0.1:
                frequency = 0.5

        user_data["frequency"] = frequency
        user.reference.update(user_data)
        
        # Sync to children
        mock_request = Request.from_values(
            headers={"Authorization": ""},
            json={"uid": user_data["uid"]},
        )
        sync_child_params(mock_request)
        update_user(mock_request)
        
    return https_fn.Response(
        f"Successfully updated user' frequency and synced with chidlren", status=200
    )


@https_fn.on_request()
def sync_child_params(req: https_fn.Request) -> https_fn.Response:
    """
    Syncs parent's frequency and church to all their children.
    Called when parent settings change to keep family in sync.
    """
    try:
        request_data = req.get_json()
        if request_data is None:
            return https_fn.Response("Missing JSON body", status=400)
    except Exception as e:
        return https_fn.Response(f"Invalid JSON: {str(e)}", status=400)

    user_id = request_data.get("uid")
    if not user_id:
        return https_fn.Response("Missing 'uid' parameter", status=400)

    id_token = req.headers.get("Authorization")
    if id_token:
        try:
            decoded_token = auth.verify_id_token(id_token.split("Bearer ")[-1])
        except Exception as e:
            return https_fn.Response(f"Token verification failed: {str(e)}", status=401)

    sync_child(user_id)

    return https_fn.Response(
        "Children frequency and church synced properly", status=200
    )


@https_fn.on_request()
def delete_child(req: https_fn.Request) -> https_fn.Response:
    """Removes a child from church rosters and all future schedules."""
    try:
        request_data = req.get_json()
        if request_data is None:
            return https_fn.Response("Missing JSON body", status=400)
    except Exception as e:
        return https_fn.Response(f"Invalid JSON: {str(e)}", status=400)

    user_id = request_data.get("uid")
    church_id = request_data.get("church")
    if not user_id or not church_id:
        return https_fn.Response("Missing 'uid' or 'church' parameter", status=400)

    id_token = req.headers.get("Authorization")
    if id_token:
        try:
            decoded_token = auth.verify_id_token(id_token.split("Bearer ")[-1])
        except Exception as e:
            return https_fn.Response(f"Token verification failed: {str(e)}", status=401)

    remove_user_from_churches(user_id)
    
    # Remove from all scheduled weeks
    for week in get_weeks(church_id):
        mock_request = Request.from_values(
            headers={"Authorization": ""},
            json={"church": church_id, "week": week, "uid": user_id, "family": False},
        )
        unavailable_for_week(mock_request)

    return https_fn.Response("child deleted", status=200)


@https_fn.on_request()
def delete_user(req: https_fn.Request) -> https_fn.Response:
    """
    Deletes a user and all their children from the system.
    Removes from church rosters, servants meetings, and schedules.
    """
    try:
        request_data = req.get_json()
        if request_data is None:
            return https_fn.Response("Missing JSON body", status=400)
    except Exception as e:
        return https_fn.Response(f"Invalid JSON: {str(e)}", status=400)

    user_id = request_data.get("uid")
    if not user_id:
        return https_fn.Response("Missing 'uid' parameter", status=400)

    id_token = req.headers.get("Authorization")
    if id_token:
        try:
            decoded_token = auth.verify_id_token(id_token.split("Bearer ")[-1])
        except Exception as e:
            return https_fn.Response(f"Token verification failed: {str(e)}", status=401)

    firestore_client = firestore.Client()
    user_doc_ref = firestore_client.collection("users").document(user_id)
    user_doc = user_doc_ref.get()

    if user_doc.exists:
        user_data = user_doc.to_dict()
        
        # Remove from servants meeting if applicable
        if user_data.get("isSSTeacher"):
            if user_data.get("church"):
                church_ref = firestore_client.collection("churches").document(
                    user_data["church"]
                )
                church_ref.collection("Servants Meeting").document(user_id).delete()
        
        # Remove all children first
        if "children" in user_data:
            for child in user_data["children"]:
                remove_user_from_churches(child.get("uid"))
        
        # Remove the user
        remove_user_from_churches(user_id)
        
    return https_fn.Response("user and children deleted", status=200)


# ============================================================================
# SCHEDULE MODIFICATION ENDPOINTS
# ============================================================================

@https_fn.on_request()
def switch_server(req: https_fn.Request) -> https_fn.Response:
    """
    Swaps two servers' positions in a schedule.
    Used by admins to manually adjust assignments.
    Sends notifications if swap affects upcoming Sunday.
    """
    try:
        request_data = req.get_json()
        if not request_data:
            return https_fn.Response("Missing JSON body", status=400)
    except Exception as e:
        return https_fn.Response(f"Invalid JSON: {str(e)}", status=400)

    church_id = request_data.get("church")
    week_id = request_data.get("week")
    first_server_uid = request_data.get("firstServer")
    second_server_uid = request_data.get("secondServer")
    
    if not all([church_id, week_id, first_server_uid, second_server_uid]):
        return https_fn.Response("Missing required parameters", status=400)

    id_token = req.headers.get("Authorization")
    if id_token:
        try:
            decoded_token = auth.verify_id_token(id_token.split("Bearer ")[-1])
        except Exception as e:
            return https_fn.Response(f"Token verification failed: {str(e)}", status=401)

    try:
        firestore_client = firestore.Client()
        schedule_ref = (
            firestore_client.collection("churches")
            .document(church_id)
            .collection("schedule")
            .document(week_id)
        )
        schedule_doc = schedule_ref.get()
        
        if not schedule_doc.exists:
            return https_fn.Response("Schedule not found", status=404)

        schedule_data = schedule_doc.to_dict()

        # Find both servers in the schedule
        first_location, first_server = find_server(schedule_data, first_server_uid)
        second_location, second_server = find_server(schedule_data, second_server_uid)
        
        if not first_location or not second_location:
            return https_fn.Response("One or both servers not found", status=404)

        # Perform the swap
        if len(first_location) == 2:
            schedule_data[str(first_location[0])][int(first_location[1])] = second_server
        else:
            schedule_data[str(first_location[0])] = second_server

        if len(second_location) == 2:
            schedule_data[str(second_location[0])][int(second_location[1])] = first_server
        else:
            schedule_data[str(second_location[0])] = first_server

        schedule_ref.update(schedule_data)
        
        # Notify if this affects upcoming Sunday
        if is_today_or_upcoming_sunday(week_id):
            handle_switch_server_notification(
                first_server, second_server, first_location, second_location
            )

        # Update nextWeekServe fields in background
        trigger_async_function(
            "https://set-next-week-serve-async-hy6oofbihq-uc.a.run.app",
            {"church": church_id},
        )

        return https_fn.Response("Servers swapped successfully", status=200)

    except Exception as e:
        return https_fn.Response(f"Error: {str(e)}", status=500)


@https_fn.on_request()
def remove_server(req: https_fn.Request) -> https_fn.Response:
    """
    Removes a server from altar and moves them to extras list.
    Used by admins to reduce altar server count for a week.
    """
    try:
        request_data = req.get_json()
        if not request_data:
            return https_fn.Response("Missing JSON body", status=400)
    except Exception as e:
        return https_fn.Response(f"Invalid JSON: {str(e)}", status=400)

    church_id = request_data.get("church")
    week_id = request_data.get("week")
    server_uid = request_data.get("server")

    if not all([church_id, week_id, server_uid]):
        return https_fn.Response("Missing required parameters", status=400)

    id_token = req.headers.get("Authorization")
    if id_token:
        try:
            decoded_token = auth.verify_id_token(id_token.split("Bearer ")[-1])
        except Exception as e:
            return https_fn.Response(f"Token verification failed: {str(e)}", status=401)

    firestore_client = firestore.Client()
    schedule_ref = (
        firestore_client.collection("churches")
        .document(church_id)
        .collection("schedule")
        .document(week_id)
    )
    schedule_doc = schedule_ref.get()

    if not schedule_doc.exists:
        return https_fn.Response("Schedule not found", status=404)

    schedule_data = schedule_doc.to_dict()
    if not schedule_data:
        return https_fn.Response("Invalid schedule data", status=500)

    altar_servers = schedule_data.get("altar", [])
    extra_servers = schedule_data.get("extra", [])
    
    # Filter out the server and track who was removed
    updated_altar_servers = [s for s in altar_servers if s["uid"] != server_uid]
    removed_servers = [s for s in altar_servers if s["uid"] == server_uid]

    if not removed_servers:
        return https_fn.Response("Server not found in 'altar' list", status=404)

    # Move to front of extras list
    extra_servers.insert(0, removed_servers[0])

    schedule_ref.update({"altar": updated_altar_servers, "extra": extra_servers})
    
    # Notify if upcoming
    if is_today_or_upcoming_sunday(week_id):
        update_notification(
            server_uid,
            "An admin has removed you from serving in the altar this Sunday. Check the app for details.",
            "Your son has been removed from serving in the altar this Sunday. Check the app for details.",
            "Schedule Update!",
        )

    # Propagate changes to future schedules
    update_future_schedules(church_id)

    trigger_async_function(
        "https://set-next-week-serve-async-hy6oofbihq-uc.a.run.app",
        {"church": church_id},
    )

    return https_fn.Response("User removed from altar and moved to extra", status=200)


@https_fn.on_request()
def add_server(req: https_fn.Request) -> https_fn.Response:
    """
    Moves first available extra to altar servers.
    Used by admins to add more altar servers for a week.
    """
    try:
        request_data = req.get_json()
        if not request_data:
            return https_fn.Response("Missing JSON body", status=400)
    except Exception as e:
        return https_fn.Response(f"Invalid JSON: {str(e)}", status=400)

    church_id = request_data.get("church")
    week_id = request_data.get("week")

    if not all([church_id, week_id]):
        return https_fn.Response("Missing required parameters", status=400)

    id_token = req.headers.get("Authorization")
    if id_token:
        try:
            decoded_token = auth.verify_id_token(id_token.split("Bearer ")[-1])
        except Exception as e:
            return https_fn.Response(f"Token verification failed: {str(e)}", status=401)

    firestore_client = firestore.Client()
    schedule_ref = (
        firestore_client.collection("churches")
        .document(church_id)
        .collection("schedule")
        .document(week_id)
    )
    schedule_doc = schedule_ref.get()

    if not schedule_doc.exists:
        return https_fn.Response("Schedule not found", status=404)

    schedule_data = schedule_doc.to_dict()
    if not schedule_data:
        return https_fn.Response("Invalid schedule data", status=500)

    altar_servers = schedule_data.get("altar", [])
    extra_servers = schedule_data.get("extra", [])

    if extra_servers:
        # Move first extra to altar
        altar_servers.append(extra_servers[0])
        
        if is_today_or_upcoming_sunday(week_id):
            update_notification(
                extra_servers[0]["uid"],
                f"{extra_servers[0]['name'].split()[0]}! You have been moved to serve in the altar this Sunday! Check the app for details.",
                f"Your son {extra_servers[0]['name'].split()[0]} has been moved to serve in the altarr this Sunday! Check the app for details.",
                "Schedule Update!",
            )
        
        updated_extra_servers = extra_servers[1:]
        schedule_ref.update({"altar": altar_servers, "extra": updated_extra_servers})

        update_future_schedules(church_id)

        trigger_async_function(
            "https://set-next-week-serve-async-hy6oofbihq-uc.a.run.app",
            {"church": church_id},
        )

        return https_fn.Response("User moved from extra to altar", status=200)
    else:
        # No extras available - add placeholder
        altar_servers.append({"name": "N/A", "uid": str(uuid.uuid4())})
        schedule_ref.update({"altar": altar_servers})
        update_future_schedules(church_id)

        return https_fn.Response("No extra servers available to move", status=400)


@https_fn.on_request()
def unavailable_for_week(req: https_fn.Request) -> https_fn.Response:
    try:
        request_data = req.get_json()
        if not request_data:
            return https_fn.Response("Missing JSON body", status=400)
    except Exception as e:
        return https_fn.Response(f"Invalid JSON: {str(e)}", status=400)

    church_id = request_data.get("church")
    week_id = request_data.get("week")
    user_id = request_data.get("uid")
    logging.warning(request_data)
    if not all([church_id, week_id, user_id]):
        return https_fn.Response("Missing required parameters", status=400)

    id_token = req.headers.get("Authorization")
    if id_token:
        try:
            decoded_token = auth.verify_id_token(id_token.split("Bearer ")[-1])
        except Exception as e:
            return https_fn.Response(f"Token verification failed: {str(e)}", status=401)
        
    unavailable(request_data)

    return https_fn.Response("User removed and replacement scheduled", status=200)


@https_fn.on_request()
def handle_unavailable_requests(req: https_fn.Request) -> https_fn.Response:
    
    try:
        request_data = req.get_json()
        if not request_data:
            return https_fn.Response("Missing JSON body", status=400)
    except Exception as e:
        return https_fn.Response(f"Invalid JSON: {str(e)}", status=400)

    church_id = request_data.get("church")
    week_id = request_data.get("week")
    name = request_data.get("name")
    uid = request_data.get("uid")
    role = request_data.get("role")
    unavailable_uid = request_data.get("unavailableUid")

    if not all([church_id, week_id, name, uid, role]):
        return https_fn.Response("Missing required parameters", status=400)
    
    id_token = req.headers.get("Authorization")
    if id_token:
        try:
            decoded_token = auth.verify_id_token(id_token.split("Bearer ")[-1])
        except Exception as e:
            return https_fn.Response(f"Token verification failed: {str(e)}", status=401)
        
    firestore_client = firestore.Client()
    schedule_ref = (
        firestore_client.collection("churches")
        .document(church_id)
        .collection("schedule")
        .document(week_id)
    )
    schedule_doc = schedule_ref.get()
    
    if not schedule_doc.exists:
        return https_fn.Response("Schedule not found", status=404)
    
    schedule_data = schedule_doc.to_dict()

    # Remove the replacement (uid) from extras so they don't appear in both places
    schedule_data['extra'] = [d for d in schedule_data.get('extra', []) if d['uid'] != uid]

    if isinstance(role, list):
        schedule_data[role[0]][role[1]] = {'name': name, 'uid': uid}
        handle_unavailable_notification(uid, week_id, role[0], name)
    else:
        schedule_data[role] = {'name': name, 'uid': uid}
    
    schedule_ref.update(schedule_data)
    
    return https_fn.Response("Unavailable request handled", status=200)
        
        
@https_fn.on_request()
def set_next_week_serve_async(req: https_fn.Request) -> https_fn.Response:
    """
    Async endpoint for updating nextWeekServe fields.
    Called as fire-and-forget from other endpoints to avoid blocking.
    """
    try:
        request_data = req.get_json()
        church_id = request_data.get("church")

        if not church_id:
            return https_fn.Response("Missing 'church' parameter", status=400)

        set_next_week_serve(church_id)
        return https_fn.Response("set_next_week_serve completed", status=200)

    except Exception as e:
        return https_fn.Response(f"Error: {str(e)}", status=500)


@https_fn.on_request()
def remove_family_schedules(req: https_fn.Request) -> https_fn.Response:
    """
    Removes entire family from all schedules and teaching assignments.
    Used when family leaves the church or goes on extended leave.
    """
    try:
        request_data = req.get_json()
        if not request_data:
            return https_fn.Response("Missing JSON body", status=400)
    except Exception as e:
        return https_fn.Response(f"Invalid JSON: {str(e)}", status=400)

    church_id = request_data.get("church")
    user_id = request_data.get("uid")
    
    if not all([church_id, user_id]):
        return https_fn.Response("Missing required parameters", status=400)

    id_token = req.headers.get("Authorization")
    if id_token:
        try:
            decoded_token = auth.verify_id_token(id_token.split("Bearer ")[-1])
        except Exception as e:
            return https_fn.Response(f"Token verification failed: {str(e)}", status=401)

    firestore_client = firestore.Client()
    user_ref = firestore_client.collection("users").document(user_id)
    user_data = user_ref.get().to_dict()
    
    # Determine teaching assignments to remove
    alhan = "N/A"
    sunday_school = "N/A"
    if user_data["frequency"]:
        frequency = user_data["frequency"]
    if user_data["isAlhan"] and user_data["alhanSetUp"]:
        alhan = user_data["alhanGrades"]
    if user_data["isSSTeacher"] and user_data["ssSetUp"]:
        sunday_school = user_data["ssGrades"]
    
    remove_user_from_schedules(church_id, user_id, alhan, sunday_school, True)
    
    if user_ref.get().exists:
        user_ref.update({"nextWeekServe": "N/A", "frequency": frequency})

    return https_fn.Response("Family schedules removed", status=200)


# ============================================================================
# TEST/ADMIN UTILITIES
# ============================================================================

@https_fn.on_request()
def create_test_data(req: https_fn.Request) -> https_fn.Response:
    """Creates random test deacon data for development."""
    firestore_client = firestore.Client()
    church_ref = firestore_client.collection("churches").document("Test Data")
    test_data = generate_test_data(150)
    church_ref.update({"deacons": test_data})
    return https_fn.Response("Test data created", status=200)


# ============================================================================
# SCHEDULED MAINTENANCE JOBS
# ============================================================================

@scheduler_fn.on_schedule(
    schedule="0 0 11 9 *",  # September 11 at midnight (new school year)
    timezone=scheduler_fn.Timezone("America/New_York")
)
def new_years_cleanup(event: scheduler_fn.ScheduledEvent) -> None:
    """
    Annual job: Promotes students to next grade level.
    Runs September 11 to align with Coptic new year.
    """
    db = firestore.Client()
    church_count = 0

    for church_doc in db.collection("churches").stream():
        move_and_clean_students(church_doc.reference, "Hymns Class")
        move_and_clean_students(church_doc.reference, "Sunday School")
        church_count += 1


@scheduler_fn.on_schedule(
    schedule="0 0 * * 0",
    timezone=scheduler_fn.Timezone("America/New_York"),
)
def scheduled_update_ages(event: scheduler_fn.ScheduledEvent) -> None:
    asyncio.run(_update_ages_async())

async def _update_ages_async():
    firestore_client = firestore.Client()
    users_docs = firestore_client.collection("users").stream()
    tasks = [asyncio.to_thread(update_user_sync, doc) for doc in users_docs]
    await asyncio.gather(*tasks)

def update_user_sync(user_doc):
    """Helper: Updates a single user's age if it has changed.

    Only triggers a full update_user sync when the age crosses a threshold
    that affects church group assignment (e.g., 18 = adult, 12 = teen).
    Otherwise, just writes the age field directly to avoid unnecessary writes.
    """
    # Age thresholds that change which church group a user belongs to
    AGE_THRESHOLDS = {18, 12}  # adjust to match your group boundaries

    user_data = user_doc.to_dict()
    if "DOB" not in user_data:
        return

    current_age = calc_age(user_data["DOB"])
    stored_age = user_data.get("age")
    if stored_age is not None and int(stored_age) == current_age:
        return

    print(f"Updating age for user {user_data['name']}: {stored_age} -> {current_age}")
    update_dict = {"age": current_age}

    # Also update children ages in the same write
    if "children" in user_data:
        updated_children = []
        for child in user_data["children"]:
            if "DOB" in child:
                child = {**child, "age": calc_age(child["DOB"])}
            updated_children.append(child)
        update_dict["children"] = updated_children

    user_doc.reference.update(update_dict)

    # Only do the expensive full sync if the age crossed a group boundary
    crossed_threshold = (
        stored_age is not None and
        any(min(int(stored_age), current_age) < t <= max(int(stored_age), current_age)
            for t in AGE_THRESHOLDS)
    )
    if crossed_threshold or stored_age is None:
        mock_request = Request.from_values(
            headers={"Authorization": ""},
            json={"uid": user_data["uid"]},
        )
        update_user(mock_request)


async def update_all_users():
    """Batch updates all user ages (used by test endpoint)."""
    firestore_client = firestore.Client()
    users_ref = firestore_client.collection("users")
    users_docs = users_ref.stream()

    tasks = []
    for user_doc in users_docs:
        tasks.append(asyncio.to_thread(update_user_sync, user_doc))

    await asyncio.gather(*tasks)


@https_fn.on_request()
def test_update_ages(req: https_fn.Request) -> https_fn.Response:
    """HTTP endpoint to manually trigger age updates."""
    asyncio.run(update_all_users())
    return https_fn.Response("Manual age update completed", status=200)


# ============================================================================
# NOTIFICATION ENDPOINTS
# ============================================================================

@https_fn.on_request()
def testing_notifcations(req: https_fn.Request) -> https_fn.Response:
    """Test endpoint for debugging FCM notifications."""
    message = messaging.Message(
        token="fUdnk8uvSU4_mfpQihxUFu:APA91bH2SVMsjz8mhWAJtG3m2lEmmIskXBticQcvayhcNg0m-uyh2e3B3sRY84n-HeIjzL3WnD4K8IG0GjirF52jA204xpT9fakec0DO25ZoMJ1F6AJ9Ajw",
        notification=messaging.Notification(
            title="this is a test",
            body="I want to see if this works",
        ),
        android=messaging.AndroidConfig(priority="high"),
        apns=messaging.APNSConfig(
            payload=messaging.APNSPayload(
                aps=messaging.Aps(sound="default", content_available=True)
            )
        ),
    )

    try:
        response = messaging.send(message)
        return https_fn.Response(
            f"Notification sent successfully: {response}", status=200
        )
    except Exception as e:
        return https_fn.Response(f"Error sending notification: {str(e)}", status=500)


# Liturgy reminder schedule: Sunday 4:15 PM, Friday 8 PM, Saturday 9 AM
@scheduler_fn.on_schedule(
    schedule="15 16 * * 0",  # Sunday 4:15 PM
    timezone=scheduler_fn.Timezone("America/New_York"),
)
def first_reminder(event: scheduler_fn.ScheduledEvent) -> None:
    """First liturgy reminder - sent right after schedule generation."""
    asyncio.run(liturgy_notification())


@scheduler_fn.on_schedule(
    schedule="0 20 * * 5",  # Friday 8:00 PM
    timezone=scheduler_fn.Timezone("America/New_York"),
)
def second_reminder(event: scheduler_fn.ScheduledEvent) -> None:
    """Second liturgy reminder - Friday evening."""
    asyncio.run(liturgy_notification())


@scheduler_fn.on_schedule(
    schedule="0 9 * * 6",  # Saturday 9:00 AM
    timezone=scheduler_fn.Timezone("America/New_York"),
)
def third_reminder(event: scheduler_fn.ScheduledEvent) -> None:
    """Third liturgy reminder - Saturday morning."""
    asyncio.run(liturgy_notification())


@https_fn.on_request()
def test_liturgy_notification(req: https_fn.Request) -> https_fn.Response:
    """HTTP endpoint to manually trigger liturgy notifications."""
    try:
        print("Starting test liturgy notification...")
        asyncio.run(liturgy_notification())
        return https_fn.Response("Liturgy notification sent successfully", status=200)
    except Exception as e:
        print(f"Error in test liturgy notification: {str(e)}")
        return https_fn.Response(f"Error sending notification: {str(e)}", status=500)


@scheduler_fn.on_schedule(
    schedule="30 12 * * 0",  # Sunday 12:30 PM
    timezone=scheduler_fn.Timezone("America/New_York"),
)
def servants_meeting_notification(event: scheduler_fn.ScheduledEvent) -> None:
    """Reminder for servants meeting (sent just before typical meeting time)."""
    asyncio.run(process_servant_notifications())



@https_fn.on_request()
def traffic_notification(req: https_fn.Request) -> https_fn.Response:
    '''
    Send notification to user's parked incorrectly
    inputs user's tokens and message
    '''
    try:
        request_data = req.get_json()
        if request_data is None:
            return https_fn.Response("Missing JSON body", status=400)
    except Exception as e:
        return https_fn.Response(f"Invalid JSON: {str(e)}", status=400)

    tokens = request_data.get('tokens', [])
    message = request_data.get('message', "")
    title = request_data.get('title', "")
    if not tokens or not message or not title:
        return https_fn.Response("Missing parameters", status=400)

    # Optional auth verification
    id_token = req.headers.get("Authorization")
    if id_token:
        try:
            decoded_token = auth.verify_id_token(id_token.split("Bearer ")[-1])
        except Exception as e:
            return https_fn.Response(f"Token verification failed: {str(e)}", status=401)

    send_notification(tokens, message, title)
    return https_fn.Response(r"Successfully Notified Driver", status=200)


# ============================================================================
# ATTENDANCE SHEET GENERATION
# ============================================================================

@scheduler_fn.on_schedule(
    schedule="0 0 * * 1",  # Monday midnight
    timezone=scheduler_fn.Timezone("America/New_York"),
)
def generate_sheets(event: scheduler_fn.ScheduledEvent) -> None:
    """
    Weekly job: Generates Google Sheets/Excel attendance reports.
    Runs Monday after Sunday attendance is recorded.
    """
    try:
        set_up_sheets()
        set_up_sheets_servants()
    except Exception as e:
        raise


@https_fn.on_request()
def test_generate_sheets_http(req: https_fn.Request) -> https_fn.Response:
    """HTTP endpoint to manually trigger sheet generation."""
    try:
        set_up_sheets()
        set_up_sheets_servants()
        return https_fn.Response("Document generation completed successfully")
    except Exception as e:
        return https_fn.Response(f"Error: {str(e)}", status=500)


# ============================================================================
# LAST SERVE TRACKING
# ============================================================================

@https_fn.on_request()
def test_last_serve(req: https_fn.Request) -> https_fn.Response:
    """Test endpoint for updating lastServe fields."""
    firestore_client = firestore.Client()
    churches_ref = firestore_client.collection("churches")
    churches_docs = churches_ref.stream()
    
    for church_doc in churches_docs:
        schedules = firestore_client.collection("churches").document(church_doc.id).collection("schedule").stream()
        for schedule in schedules:
            print(f"Checking schedule {schedule.id} for church {church_doc.id}")
            if schedule.id == "08-31-25":
                print(f"Updating last serve for schedule {schedule.id} of church {church_doc.id}")
                update_last_serve(schedule.to_dict(), schedule.id)
                
    return https_fn.Response("Last serve update completed", status=200)


@scheduler_fn.on_schedule(
    schedule="45 15 * * 0",  # Sunday 3:45 PM (before schedule generation)
    timezone=scheduler_fn.Timezone("America/New_York"),
)
def update_last_week_serve(event: scheduler_fn.ScheduledEvent) -> None:
    """
    Weekly job: Records lastServe/lastRole for today's servers.
    Runs before schedule generation to capture current week's service.
    """
    firestore_client = firestore.Client()
    churches_ref = firestore_client.collection("churches")
    churches_docs = churches_ref.stream()
    
    for church_doc in churches_docs:
        schedules = firestore_client.collection("churches").document(church_doc.id).collection("schedule").stream()
        for schedule in schedules:
            print(f"Checking schedule {schedule.id} for church {church_doc.id}")
            # Only process today's schedule
            if schedule.id == datetime.datetime.now().strftime("%m-%d-%y"):
                print(f"Updating last serve for schedule {schedule.id} of church {church_doc.id}")
                update_last_serve(schedule.to_dict(), schedule.id)
    return


# ============================================================================
# MAINTENANCE ENDPOINTS
# ============================================================================

@https_fn.on_request()
def sync_all_users(req: https_fn.Request) -> https_fn.Response:
    """HTTP endpoint to sync all users' data."""
    fc = firestore.Client()
    users = fc.collection("users").stream()
    churches = fc.collection("churches").stream()
    
    # refresh entire deacon list and servants list for all churches
    deacons_info = {}
    
    
    # Loop through all users
    for user in users:
        user_data = user.to_dict()
        church_id = user_data.get("church")
        if not church_id:
            continue
        
        logging.info(f"Processing user {user_data['uid']}, {user_data['name']}for church {church_id}")
        
        if church_id not in deacons_info:
            deacons_info[church_id] = []
            
        # Update deacon list
        if user_data.get("isDeacon"):
            deacons_info[church_id].append({
                "name": user_data["name"],
                "uid": user_data["uid"],
                "age": user_data.get("age", None) or calc_age(user_data.get("DOB")) if user_data.get("DOB") else 0,
                "experience": user_data.get("experience", 0),
                "lastWeeksSince": user_data.get("lastWeeksSince", 0),
                "rank": user_data.get("rank", None),
                "weeksSince": user_data.get("weeksSince", 0),
                "frequency": user_data.get("frequency", 1.0),
            })
            
            # Sync name across all schedule documents
            update_names(user_data["uid"], user_data["name"], church_id)
            for week in fc.collection("churches").document(church_id).collection("schedule").stream():
                if find_server(week.to_dict(), user_data["uid"]) == (None, None):
                    logging.warning(f"Deacon {user_data['uid']} not found in schedule for week {week.id} of church {church_id}")
                    week.reference.update({
                        'extra': week.to_dict().get('extra', []) + [{
                            "name": user_data["name"],
                            "uid": user_data["uid"],
                        }]
                    })
            
        # Update children deacon list
        if "children" in user_data:
            for child in user_data["children"]:
                deacons_info[church_id].append({
                    "name": child["name"],
                    "uid": child["uid"],
                    "age": child.get("age", None) or calc_age(child.get("DOB")) if child.get("DOB") else 0,
                    "experience": child.get("experience", 0),
                    "lastWeeksSince": child.get("lastWeeksSince", 0),
                    "rank": child.get("rank", None),
                    "weeksSince": child.get("weeksSince", 0),
                    "frequency": child.get("frequency", 1.0),
                })
                
                # Sync name across all schedule documents
                update_names(child["uid"], child["name"], church_id)
                for week in fc.collection("churches").document(church_id).collection("schedule").stream():
                    if find_server(week.to_dict(), child["uid"]) == (None, None):
                        logging.warning(f"Deacon {child['uid']} not found in schedule for week {week.id} of church {church_id}")
                        week.reference.update({
                            'extra': week.to_dict().get('extra', []) + [{
                                "name": child["name"],
                                "uid": child["uid"],
                            }]
                        })

                
        # Update servants documents
        if user_data.get("isSSTeacher"):
            servants_ref = fc.collection("churches").document(church_id).collection("Servants Meeting")
            servant_doc = servants_ref.document(user_data["uid"])
            if not servant_doc.get().exists:
                logging.warning(f"Servant {user_data['uid']} not found in church {church_id}, creating new document.")
                servant_doc.set({
                    "name": user_data["name"],
                    "uid": user_data["uid"],
                })
    
    
    for church in churches:
        # Reverse update the servants documents (check the user docs for accuracy)
        servants_ref = fc.collection("churches").document(church.id).collection("Servants Meeting").stream()
        for servant in servants_ref:
            servant_data = servant.to_dict()
            user_ref = fc.collection("users").document(servant_data["uid"])
            if not user_ref.get().exists or church.id != user_ref.get().to_dict().get("church") or not user_ref.get().to_dict().get("isSSTeacher"):
                logging.info(f"Removing servant {servant_data['uid']} from church {church.id} servants meeting.")
                servant.reference.delete()
            
        # Update deacon list
        church.reference.update({
            "deacons": deacons_info.get(church.id, [])
        })
    
    
    return https_fn.Response("All users synced successfully", status=200)
            
        