"""
schedule.py - Deacon Scheduling System for Taksis Church App

This module implements an automated scheduling algorithm for assigning deacons
to various liturgical roles during Sunday services. The system uses a weighted
scoring algorithm that considers factors like time since last service, age
appropriateness, experience level, and rank.

Key Features:
- Automated weekly schedule generation for all churches
- Role-specific scoring algorithms (different criteria for each liturgical role)
- Support for "full deacon" churches with ordained deacons
- Unavailability handling with automatic replacement assignment
- Family-aware scheduling (parents can mark children unavailable)

Liturgical Roles (in order of priority):
- Wine Bearer: Highest responsibility, requires ordained deacon or experienced server
- Gospel Reader: Reads the Gospel, requires strong reading skills
- Water Bearer: Assists with communion preparation
- Praxis Reader: Reads from Acts of the Apostles
- Catholic Epistle Reader: Reads Catholic epistles
- Pauline Epistle Reader: Reads Pauline epistles
- Sixth Hour Reader: Reads during 6th hour prayers
- Third Hour Reader: Reads during 3rd hour prayers
- Matins Reader: Reads during morning prayers
- Altar Servers: General altar service duties
"""

from typing import *
import asyncio
import uuid
import datetime
import logging
from google.cloud import firestore
import random
from firebase_admin import auth
import requests
logging.info('Attempting to import utility and notification_manager in schedule_generation')
from files.utility import *
from files.notification_manager import *
logging.info('Successfully imported utility and notification_manager in schedule_generation')
import firebase_functions as https_fn


# ============================================================================
# SCORING ALGORITHM FUNCTIONS
# Each function calculates a priority score for deacons based on role-specific
# criteria. Higher scores = higher priority for assignment.
#
# Common factors across all roles:
# - weeksSince: Weeks since last service (higher = more priority)
# - frequency: How often they typically serve (affects scheduling balance)
# - Minimum cooldown: Most roles require at least 2 weeks between assignments
#
# Role-specific factors:
# - Age ranges: Each role has an ideal age range (+30 bonus points)
# - Experience: Some roles weight experience more heavily
# - Rank: Chanters (Epsaltos) get bonuses/penalties based on role
# ============================================================================

def sort_values(deacons: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Sorts deacons by their calculated 'value' score in descending order."""
    return sorted(deacons, key=lambda deacon: deacon["value"], reverse=True)


def matins(deacons: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Scores deacons for the Matins (morning prayer) reading role.
    Ideal age: 13-24, values experience. 2-week minimum cooldown.
    """
    for deacon in deacons:
        value = 0
        value += deacon["weeksSince"] * 4  # Primary factor: time since last service

        # Age bonus: teenagers and young adults preferred
        if int(deacon["age"]) > 12 and int(deacon["age"]) < 25:
            value += 30

        value += (deacon["frequency"] - 3) * 0.4
        value += (deacon["experience"] - 4) * 0.12
        
        # Enforce 2-week cooldown between assignments
        if deacon['weeksSince'] < 2:
            value = 0

        deacon["value"] = value
    return sort_values(deacons)


def third(deacons: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Scores deacons for Third Hour reading.
    Ideal age: 9-17, chanters get bonus. 2-week cooldown.
    """
    for deacon in deacons:
        value = 0
        value += deacon["weeksSince"] * 4

        if int(deacon["age"]) > 8 and int(deacon["age"]) < 18:
            value += 30

        value += (deacon["frequency"] - 3) * 0.4

        # Chanters (Epsaltos) are preferred for hour readings
        if deacon["rank"] == "Chanter (Epsaltos)":
            value += 12
        
        if deacon['weeksSince'] < 2:
            value = 0

        deacon["value"] = value
    return sort_values(deacons)


def sixth(deacons: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Scores deacons for Sixth Hour reading.
    Same criteria as Third Hour - ideal age 9-17, chanters preferred.
    """
    for deacon in deacons:
        value = 0
        value += deacon["weeksSince"] * 4

        if int(deacon["age"]) > 8 and int(deacon["age"]) < 18:
            value += 30

        value += (deacon["frequency"] - 3) * 0.4

        if deacon["rank"] == "Chanter (Epsaltos)":
            value += 12
        
        if deacon['weeksSince'] < 2:
            value = 0

        deacon["value"] = value
    return sort_values(deacons)


def pauline(deacons: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Scores deacons for Pauline Epistle reading.
    Ideal age: 14-44, non-chanters slightly preferred, minimum age 12.
    """
    for deacon in deacons:
        value = 0
        value += deacon["weeksSince"] * 4

        if int(deacon["age"]) > 13 and int(deacon["age"]) < 45:
            value += 30

        value += (deacon["frequency"] - 3) * 0.4

        # Non-chanters get small bonus (chanters should focus on responses)
        if deacon["rank"] == "Chanter (Epsaltos)":
            pass
        else:
            value += 2.4

        # Too young - significant penalty
        if int(deacon["age"]) < 12:
            value = -40
        
        if deacon['weeksSince'] < 2:
            value = 0

        deacon["value"] = value
    return sort_values(deacons)


def catholic(deacons: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Scores deacons for Catholic Epistle reading.
    Same criteria as Pauline - ideal age 14-44, minimum age 12.
    """
    for deacon in deacons:
        value = 0
        value += deacon["weeksSince"] * 4

        if int(deacon["age"]) > 13 and int(deacon["age"]) < 45:
            value += 30

        value += (deacon["frequency"] - 3) * 0.4

        if deacon["rank"] == "Chanter (Epsaltos)":
            pass
        else:
            value += 2.4

        if int(deacon["age"]) < 12:
            value = -40
        
        if deacon['weeksSince'] < 2:
            value = 0

        deacon["value"] = value
    return sort_values(deacons)


def praxis(deacons: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Scores deacons for Praxis (Acts) reading.
    Ideal age: 16-44, minimum age 12. Requires 3-week cooldown (longer reading).
    """
    for deacon in deacons:
        value = 0
        value += deacon["weeksSince"] * 4

        if int(deacon["age"]) > 15 and int(deacon["age"]) < 45:
            value += 30

        value += (deacon["frequency"] - 3) * 0.4

        if deacon["rank"] == "Chanter (Epsaltos)":
            pass
        else:
            value += 2.4

        if int(deacon["age"]) < 12:
            value = -40
        
        # Longer cooldown for Praxis due to length/difficulty
        if deacon['weeksSince'] < 3:
            value = 0

        deacon["value"] = value
    return sort_values(deacons)


def gospel(deacons: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Scores deacons for Gospel reading - high responsibility role.
    Ideal age: 19-54, minimum age 16. Heavily weights experience.
    """
    for deacon in deacons:
        value = 0
        value += deacon["weeksSince"] * 4

        if int(deacon["age"]) >= 18 and int(deacon["age"]) < 55:
            value += 30

        # Higher frequency/experience thresholds for Gospel
        value += (deacon["frequency"] - 5) * 5
        value += (deacon["experience"] - 5) * 5

        # Non-chanters preferred (significant bonus)
        if deacon["rank"] == "Chanter (Epsaltos)":
            pass
        else:
            value += 5

        if int(deacon["age"]) < 15:
            value = -20
        
        if deacon['weeksSince'] < 3:
            value = 0

        deacon["value"] = value
        
    return sort_values(deacons)


def water(deacons: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Scores deacons for Water Bearer role (communion preparation).
    Ideal age: 16-39, minimum age 10. Values experience.
    """
    for deacon in deacons:
        value = 0
        value += deacon["weeksSince"] * 4

        if int(deacon["age"]) > 15 and int(deacon["age"]) < 40:
            value += 30

        value += (deacon["frequency"] - 6) * 0.4
        value += (deacon["experience"] - 7) * 0.23

        if int(deacon["age"]) < 10:
            value = -40
        
        if deacon['weeksSince'] < 2:
            value = 0

        deacon["value"] = value
    return sort_values(deacons)


def wine(deacons: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Scores deacons for Wine Bearer role - highest responsibility.
    Ideal age: 26-59, minimum age 18. Highest experience requirements.
    In "full deacon" churches, this is reserved for ordained deacons.
    """
    for deacon in deacons:
        value = 0
        value += deacon["weeksSince"] * 4

        if int(deacon["age"]) > 25 and int(deacon["age"]) < 60:
            value += 30

        # Highest frequency/experience thresholds
        value += (deacon["frequency"] - 7) * 0.4
        value += (deacon["experience"] - 8.4) * 0.23

        # Must be adult
        if int(deacon["age"]) < 18:
            value = -40
        
        if deacon['weeksSince'] < 2:
            value = 0

        deacon["value"] = value
    return sort_values(deacons)


def altar(deacons: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Scores deacons for general Altar Server duty.
    Ideal age: 11-24. Simpler criteria - mainly based on rotation fairness.
    """
    for deacon in deacons:
        value = 0
        value += deacon["weeksSince"] * 4

        if int(deacon["age"]) > 10 and int(deacon["age"]) < 25:
            value += 30

        value += (deacon["frequency"] - 4) * 0.4
    
        if deacon['weeksSince'] < 2:
            value = 0

        deacon["value"] = value
    return sort_values(deacons)


# ============================================================================
# SCHEDULE GENERATION FUNCTIONS
# ============================================================================

def sort_deacons(deacons: List[Dict]) -> List[Dict]:
    """
    Pre-sorts deacons by weeksSince for initial processing.
    Limits to top 25 candidates if pool is large (performance optimization).
    """
    if len(deacons) < 25:
        return sorted(deacons, key=lambda deacon: deacon["weeksSince"], reverse=True)
    return sorted(deacons, key=lambda deacon: deacon["weeksSince"], reverse=True)[:25]


async def update_weeks(schedule_dict: Dict[str, Any], deacons: List[Dict[str, Any]], doc_ref: firestore.DocumentReference) -> Dict[str, Any]:
    """
    Updates deacon weeksSince counters after schedule generation.
    - Resets to 0 for those who were scheduled
    - Increments by 1 for those who weren't
    - Adds non-scheduled deacons to the "extra" list as potential replacements
    """
    unused_deacons = []
    served_uids = []

    # Collect UIDs of all scheduled servers
    for key, value in schedule_dict.items():
        if key == "altar":
            for server in schedule_dict["altar"]:
                if "uid" in server:
                    served_uids.append(server["uid"])
        if isinstance(value, dict):
            for individual_key, individual_value in value.items():
                if individual_key == "uid" and individual_value != "N/A":
                    served_uids.append(individual_value)

    # Update counters based on whether they served
    for deacon in deacons:
        if deacon["uid"] in served_uids:
            deacon["lastWeeksSince"] = deacon["weeksSince"]
            deacon["weeksSince"] = 0
        else:
            deacon["weeksSince"] += 1
            unused_deacons.append(deacon)

    # Persist updated deacon data
    await asyncio.to_thread(doc_ref.update, {"deacons": deacons})

    # Build extras list for potential replacements
    extras = []
    for deacon in unused_deacons:
        extras.append({"name": deacon["name"], "uid": deacon["uid"]})
    schedule_dict["extra"] = extras

    return schedule_dict


def add_person(schedule_list: List[Dict], deacon_list: List[Dict]) -> List[Dict]:
    """
    Adds the best candidate from deacon_list to schedule_list.
    Ensures no duplicate assignments (same person can't serve multiple roles).
    Returns "N/A" placeholder if no valid candidates remain.
    """
    uids = []
    for deacon in schedule_list:
        if "uid" in deacon:
            uids.append(deacon["uid"])
    
    added = False
    while not added:
        if len(deacon_list) == 0:
            schedule_list.append("N/A")
            added = True
            break

        # Skip if already scheduled, otherwise add
        if deacon_list[0]["uid"] in uids:
            deacon_list = deacon_list[1:]
        else:
            schedule_list.append(deacon_list[0])
            added = True
    return schedule_list


def sort_full_deacons(deacons: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Sorts ordained (full) deacons by weeksSince for wine bearer selection."""
    return sorted(deacons, key=lambda x: x.get("weeksSince", 0), reverse=True)


async def create_schedule(deacons: List[Dict[str, Any]], church_ref: firestore.DocumentReference, num_altar_servers: int, fullDeacons: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Main schedule generation function.
    
    Algorithm:
    1. Sort all deacons by weeksSince (who's "due" to serve)
    2. Generate role-specific priority lists using scoring functions
    3. Assign roles in priority order (wine -> gospel -> water -> ... -> altar)
    4. Ensure no duplicate assignments across roles
    5. Update weeksSince counters and create extras list
    
    Args:
        deacons: List of all deacons for this church
        church_ref: Firestore reference for updating deacon data
        num_altar_servers: How many altar servers this church needs
        fullDeacons: List of ordained deacons (for wine bearer), or None
    
    Returns:
        Complete schedule dict ready for Firestore storage
    """
    
    # Check if church uses ordained deacons for wine
    fullDeacon = not isinstance(fullDeacons, type(None))
    fullDeacon = fullDeacon and len(fullDeacons) > 0
    
    sorted_deacons = sort_deacons(deacons)
    schedule = []

    # Generate priority-sorted lists for each role
    matins_list = matins(sorted_deacons)
    third_list = third(sorted_deacons)
    sixth_list = sixth(sorted_deacons)
    pauline_list = pauline(sorted_deacons)
    catholic_list = catholic(sorted_deacons)
    praxis_list = praxis(sorted_deacons)
    gospel_list = gospel(sorted_deacons)
    water_list = water(sorted_deacons)
    altar_list = altar(sorted_deacons)
    
    # Wine bearer: use full deacons if available, otherwise regular scoring
    if fullDeacon:
        wine_list = sort_full_deacons(fullDeacons)
        altar_list.insert(0, wine(sorted_deacons)[0])
    else:
        wine_list = wine(sorted_deacons)

    # Role assignment order (highest responsibility first)
    all_lists = [
        wine_list,
        gospel_list,
        water_list,
        praxis_list,
        catholic_list,
        pauline_list,
        sixth_list,
        third_list,
        matins_list,
    ]
    
    # Assign one person per role, avoiding duplicates
    for list in all_lists:
        schedule = add_person(schedule, list)

    # Fill altar server slots
    for i in range(9):
        schedule = add_person(schedule, altar_list)

    # Build final schedule dictionary with proper structure
    schedule_dict = {
        "gospel": (
            {"name": schedule[1]["name"], "uid": schedule[1]["uid"]}
            if schedule[1] != "N/A"
            else {"name": "N/A", "uid": str(uuid.uuid4())}
        ),
        "wine": (
            {"name": schedule[0]["name"], "uid": schedule[0]["uid"]}
            if schedule[0] != "N/A"
            else {"name": "N/A", "uid": str(uuid.uuid4())}
        ),
        "water": (
            {"name": schedule[2]["name"], "uid": schedule[2]["uid"]}
            if schedule[2] != "N/A"
            else {"name": "N/A", "uid": str(uuid.uuid4())}
        ),
        "praxis": (
            {"name": schedule[3]["name"], "uid": schedule[3]["uid"]}
            if schedule[3] != "N/A"
            else {"name": "N/A", "uid": str(uuid.uuid4())}
        ),
        "catholic": (
            {"name": schedule[4]["name"], "uid": schedule[4]["uid"]}
            if schedule[4] != "N/A"
            else {"name": "N/A", "uid": str(uuid.uuid4())}
        ),
        "pauline": (
            {"name": schedule[5]["name"], "uid": schedule[5]["uid"]}
            if schedule[5] != "N/A"
            else {"name": "N/A", "uid": str(uuid.uuid4())}
        ),
        "sixth": (
            {"name": schedule[6]["name"], "uid": schedule[6]["uid"]}
            if schedule[6] != "N/A"
            else {"name": "N/A", "uid": str(uuid.uuid4())}
        ),
        "third": (
            {"name": schedule[7]["name"], "uid": schedule[7]["uid"]}
            if schedule[7] != "N/A"
            else {"name": "N/A", "uid": str(uuid.uuid4())}
        ),
        "matins": (
            {"name": schedule[8]["name"], "uid": schedule[8]["uid"]}
            if schedule[8] != "N/A"
            else {"name": "N/A", "uid": str(uuid.uuid4())}
        ),
        "altar": (
            [
                (
                    {"name": item["name"], "uid": item["uid"]}
                    if item != "N/A"
                    else {"name": "N/A", "uid": str(uuid.uuid4())}
                )
                for item in schedule[9 : 9 + num_altar_servers]
            ]
            if len(schedule) > 7
            else [
                {"name": "N/A", "uid": str(uuid.uuid4())}
                for _ in range(num_altar_servers)
            ]
        ),
    }

    # Update deacon counters and add extras list
    schedule_dict = await update_weeks(schedule_dict, deacons, church_ref)
    return schedule_dict


async def get_deacons(church: str) -> Union[List[Dict[str, Any]], str]:
    """Fetches the deacons list for a given church from Firestore."""
    firestore_client = firestore.Client()
    collection_ref = firestore_client.collection("churches")
    doc_ref = collection_ref.document(church)

    doc_snapshot = await asyncio.to_thread(doc_ref.get)

    if doc_snapshot.exists:
        doc_data = doc_snapshot.to_dict()
        return doc_data.get("deacons", [])
    else:
        return "Document does not exist"


async def my_async_scheduled_function():
    """
    Main scheduled function - generates/rotates schedules for all churches.
    
    Runs weekly (typically Sunday evening) to:
    1. Delete the just-completed Sunday's schedule
    2. Generate a new schedule for 5 weeks ahead
    3. Maintain a rolling 5-week schedule window
    
    On first run (< 5 schedules exist), creates all 5 weeks at once.
    """
    
    firestore_client = firestore.Client()
    churches_ref = firestore_client.collection("churches")
    churches_docs = list(churches_ref.stream())

    for church_doc in churches_docs:
        church_data = church_doc.to_dict()
        num_altar_servers = int(church_data.get("altarServers", 0))
        full_deacon_enabled = church_data.get("fullDeacon", None)

        # Filter for ordained deacons if church uses them
        full_deacons = (
            [
                d
                for d in church_data.get("deacons", [])
                if d.get("rank") == "Deacon (Full Deacon)"
            ]
            if full_deacon_enabled
            else None
        )

        schedule_ref = church_doc.reference.collection("schedule")
        schedules = list(schedule_ref.stream())

        # Calculate target Sunday (next Sunday, or following Sunday if today is Sunday)
        today = datetime.datetime.now()
        days_until_sunday = (6 - today.weekday()) % 7
        upcoming_sunday = today + datetime.timedelta(days=days_until_sunday)
        upcoming_sunday = upcoming_sunday.replace(
            hour=0, minute=0, second=0, microsecond=0
        )

        if today.weekday() == 6:  # If today is Sunday, target next week
            first_schedule_date = upcoming_sunday + datetime.timedelta(weeks=1)
        else:
            first_schedule_date = upcoming_sunday

        if len(schedules) < 5:
            # Initial setup: create 5 weeks of schedules
            for i in range(5):
                schedule_date = first_schedule_date + datetime.timedelta(weeks=i)
                schedule_id = schedule_date.strftime("%m-%d-%y")

                deacons = await get_deacons(church_doc.id)
                schedule = await create_schedule(
                    deacons, church_doc.reference, num_altar_servers, full_deacons
                )

                schedule_ref.document(schedule_id).set(schedule)
        else:
            # Normal rotation: delete old, add new
            to_delete = upcoming_sunday.strftime("%m-%d-%y")
            schedule_ref.document(to_delete).delete()

            new_schedule_date = upcoming_sunday + datetime.timedelta(weeks=5)
            new_schedule_id = new_schedule_date.strftime("%m-%d-%y")

            deacons = await get_deacons(church_doc.id)
            new_schedule = await create_schedule(
                deacons, church_doc.reference, num_altar_servers, full_deacons
            )

            schedule_ref.document(new_schedule_id).set(new_schedule)

        # Update user nextWeekServe fields
        set_next_week_serve(church_doc.id)


def generate_test_data(num_people: int) -> List[Dict[str, Any]]:
    """Generates random test deacon data for development/testing."""
    ranks = ["Chanter (Epsaltos)", "Reader", "Subdeacon", "Full Deacon"]
    test_data = []

    for _ in range(num_people):
        person = {
            "age": str(random.randint(5, 60)),
            "experience": random.uniform(0, 10),
            "frequency": random.uniform(0, 10),
            "name": f"Person {random.randint(1, 1000)}",
            "rank": random.choice(ranks),
            "uid": str(uuid.uuid4()),
            "weeksSince": random.randint(0, 5),
        }
        test_data.append(person)

    return test_data


# ============================================================================
# UNAVAILABILITY HANDLING
# Cloud Function endpoint for when a server marks themselves unavailable
# ============================================================================
def unavailable(request_data: dict):
    """
    Marks a user (and optionally family) as unavailable for a specific week.
    
    This function:
    1. Finds the best replacement using the role-appropriate scoring algorithm
    2. Records the unavailability in churches/{churchId}/unavailable/{weekId}
       with both original server and suggested replacement
    3. Updates the schedule to show "N/A" for the vacated role (until admin approves)
    4. Removes the user from the extras list
    5. Leaves the suggested replacement in extras (until admin approves)
    6. Does NOT send notifications - that happens when admin processes the request
    
    Args:
        request_data: Dict containing:
            - church: Church ID
            - week: Week ID (MM-DD-YY format)
            - uid: User ID marking themselves unavailable
            - family: Boolean - if True, also process children with roles (not extras)
    
    Unavailable Collection Structure:
        churches/{churchId}/unavailable/{weekId}
        {
            "gospel": {
                "original": { "name": "John Smith", "uid": "abc123" },
                "replacement": { "name": "Mark Jones", "uid": "def456" }
            },
            "altar": {
                "0": {
                    "original": { "name": "Peter Paul", "uid": "ghi789" },
                    "replacement": { "name": "James Adam", "uid": "jkl012" }
                }
            }
        }
    """
    logging.info("Unavailable function triggered.")

    church_id = request_data.get("church")
    week_id = request_data.get("week")
    user_id = request_data.get("uid")
    family = request_data.get("family")

    firestore_client = firestore.Client()
    user_ref = firestore_client.collection("users").document(user_id)
    user_doc = user_ref.get()
    
    # Build list of UIDs to process (user + children if family mode)
    all_uids = [user_id]
    if user_doc.exists:
        user_data = user_doc.to_dict()
        if "children" in user_data and family:
            for child in user_data["children"]:
                all_uids.append(child["uid"])
        # Decrease frequency score for marking unavailable
        update_attendance(user_ref)

    # Get the schedule document
    schedule_ref = (
        firestore_client.collection("churches")
        .document(church_id)
        .collection("schedule")
        .document(week_id)
    )
    schedule_doc = schedule_ref.get()
    
    if not schedule_doc.exists:
        logging.error(f"Schedule not found for week {week_id}")
        return

    schedule_data = schedule_doc.to_dict()
    
    # Get or create the unavailable document for this week
    unavailable_ref = (
        firestore_client.collection("churches")
        .document(church_id)
        .collection("unavailable")
        .document(week_id)
    )
    unavailable_doc = unavailable_ref.get()
    
    if unavailable_doc.exists:
        unavailable_data = unavailable_doc.to_dict()
    else:
        unavailable_data = {}
    
    # Get extra deacons with full data for scoring
    extra_deacons = create_extra_deacons(church_id, schedule_data.get("extra", []))
    
    # Process each UID
    for uid in all_uids:
        key, server_data = find_server(schedule_data, uid)
        
        if key is None:
            # User not found in schedule - skip (they might only be in extras)
            continue
        
        # Skip if user is in extras (only process those with actual roles)
        if len(key) == 2 and key[0] == "extra":
            continue
        
        # Store original server info
        original_server = {
            "name": server_data.get("name"),
            "uid": server_data.get("uid")
        }
        
        # Find suggested replacement using role-appropriate scoring
        suggested_replacement = find_replacement(key, extra_deacons)
        
        # Create N/A placeholder for the schedule
        na_placeholder = {
            "name": "N/A",
            "uid": str(uuid.uuid4())
        }
        
        # Handle based on role type
        if len(key) == 2 and key[0] == "altar":
            # This is an altar server (key is tuple like ("altar", index))
            role_name = str(key[0])
            index = str(key[1])
            
            # Initialize altar dict if not exists
            if role_name not in unavailable_data:
                unavailable_data[role_name] = {}
            
            # Record the unavailability with index
            unavailable_data[role_name][index] = {
                "original": original_server,
                "replacement": suggested_replacement
            }
            
            # Update schedule to show N/A (until admin approves)
            schedule_data[role_name][key[1]] = na_placeholder
            
        else:
            # This is a single-person role (key is tuple like ("gospel",))
            role_name = str(key[0])
            
            # Record the unavailability
            unavailable_data[role_name] = {
                "original": original_server,
                "replacement": suggested_replacement
            }
            
            # Update schedule to show N/A (until admin approves)
            schedule_data[role_name] = na_placeholder
        
        # Remove the unavailable user from extras list
        extras = schedule_data.get("extra", [])
        schedule_data["extra"] = [e for e in extras if e.get("uid") != uid]

    # Save the unavailable record
    unavailable_ref.set(unavailable_data, merge=True)
    
    # Update the schedule with N/A placeholders
    schedule_ref.update(schedule_data)
    
    # Trigger async update of nextWeekServe fields
    trigger_async_function(
        "https://set-next-week-serve-async-hy6oofbihq-uc.a.run.app",
        {"church": church_id},
    )
    
    logging.info(f"Unavailability recorded for week {week_id}")


def find_replacement(key, extra_deacons: List[Dict[str, Any]]) -> Dict[str, str]:
    """
    Finds the best replacement for a role using the appropriate scoring algorithm.
    
    Args:
        key: Tuple identifying the role - ("gospel",) or ("altar", index)
        extra_deacons: List of available deacons with full data for scoring
    
    Returns:
        Dict with "name" and "uid" of suggested replacement, or N/A if none available
    """
    if not extra_deacons:
        return {"name": "N/A", "uid": str(uuid.uuid4())}
    
    # Map roles to their scoring functions
    scoring_functions = {
        "matins": matins,
        "third": third,
        "sixth": sixth,
        "pauline": pauline,
        "catholic": catholic,
        "praxis": praxis,
        "gospel": gospel,
        "water": water,
        "wine": wine,
        "altar": altar,
    }
    
    # Determine the role name
    if len(key) == 2:
        role_name = key[0]  # "altar"
    else:
        role_name = key[0]  # "gospel", "wine", etc.
    
    # Get the appropriate scoring function
    scoring_func = scoring_functions.get(role_name)
    
    if not scoring_func:
        # Unknown role, return first available
        return {
            "name": extra_deacons[0].get("name"),
            "uid": extra_deacons[0].get("uid")
        }
    
    # Score and sort the extra deacons
    scored_deacons = scoring_func(extra_deacons.copy())
    
    if not scored_deacons:
        return {"name": "N/A", "uid": str(uuid.uuid4())}
    
    # Return the best candidate
    best_candidate = scored_deacons[0]
    return {
        "name": best_candidate.get("name"),
        "uid": best_candidate.get("uid")
    }
    


def update_attendance(user_ref: firestore.DocumentReference):
    """
    Decreases user's frequency score when they mark unavailable.
    This affects their future scheduling priority (frequent unavailability = lower priority).
    """
    firestore_client = firestore.Client()
    user_doc = user_ref.get()
    user_data = user_doc.to_dict()
    
    church_ref = firestore_client.collection("churches").document(user_data["church"])
    church_data = church_ref.get().to_dict()
    deacons = church_data.get("deacons", [])
    
    # Decay frequency by 5% (penalty for unavailability)
    if "frequency" in user_data:
        user_data["frequency"] *= 0.95
        if user_data["frequency"] < 0.1:
            user_data["frequency"] = 0.5
    
    # Update in church deacons list
    for deacon in deacons:
        if deacon["uid"] == user_data["uid"]:
            deacon["frequency"] = user_data["frequency"]
            break
    
    church_ref.update({"deacons": deacons})
    user_ref.update(user_data)
    sync_child(user_data["uid"])
    return


def find_server(schedule_data: Dict[str, Any], target_uid: str) -> Tuple[Union[Tuple[str, int], None], Union[Dict[str, Any], None]]:
    """
    Locates a server in the schedule by UID.
    Returns: ((key, [index]), server_dict) or (None, None) if not found.
    """
    for key, value in schedule_data.items():
        if isinstance(value, list):
            for i in range(len(value)):
                if isinstance(value[i], dict) and value[i].get("uid") == target_uid:
                    return ((key, i), value[i])
        elif isinstance(value, dict):
            if value.get("uid") == target_uid:
                return ((key,), value)
    return (None, None)


def create_extra_deacons(church_id: str, extra_deacons: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Enriches extra deacon list with full deacon data from church document.
    Needed because extras list only stores name/uid, but scoring needs age/experience/etc.
    """
    firestore_client = firestore.Client()
    church_ref = firestore_client.collection("churches").document(church_id)
    church_doc = church_ref.get()
    church_data = church_doc.to_dict()
    
    deacons = []
    for deacon in church_data["deacons"]:
        for extra_deacon in extra_deacons:
            if deacon["uid"] == extra_deacon["uid"]:
                deacons.append(deacon)
    return deacons


def trigger_async_function(endpoint_url: str, payload: dict):
    """Fire-and-forget HTTP call to trigger async Cloud Function."""
    try:
        requests.post(endpoint_url, json=payload, timeout=1)
    except requests.exceptions.ReadTimeout:
        pass  # Expected - we don't wait for response


def update_future_schedules(church: str):
    """
    Rebalances altar/extra assignments when church changes altarServers count.
    Redistributes servers across all future schedules.
    """
    firestore_client = firestore.Client()
    church_ref = firestore_client.collection("churches").document(church)
    church_doc = church_ref.get()

    if not church_doc.exists:
        return

    church_data = church_doc.to_dict()
    num_altar_servers = int(church_data.get("altarServers", 0))

    schedule_ref = (
        firestore_client.collection("churches").document(church).collection("schedule")
    )

    docs = schedule_ref.stream()
    for doc in docs:
        schedule_data = doc.to_dict()
        altar_list = schedule_data.get("altar", [])
        extra_list = schedule_data.get("extra", [])

        # Combine and redistribute
        servers = altar_list + extra_list
        updated_altar_servers = servers[:num_altar_servers]
        updated_extra_servers = servers[num_altar_servers:]

        doc.reference.update(
            {"altar": updated_altar_servers, "extra": updated_extra_servers}
        )

    return


# ============================================================================
# CHILD PARAMETER SYNC
# Ensures children inherit parent's frequency and church settings
# ============================================================================

def sync_child(user_id):
    """
    Syncs a user's children to have the same church and frequency settings
    as the parent user.
    Also updates the church's deacons list accordingly.
    """
    firestore_client = firestore.Client()
    user_doc_ref = firestore_client.collection("users").document(user_id)
    user_doc = user_doc_ref.get()
    updated_children = []

    if user_doc.exists:
        user_data = user_doc.to_dict()
    
    church_ref = firestore_client.collection("churches").document(user_data["church"])
    church_data = church_ref.get().to_dict()
    deacons = church_data.get("deacons", [])
    
    # Update each child with parent's church and frequency
    if "children" in user_data:
        for child in user_data["children"]:
            child["church"] = user_data["church"]
            child["frequency"] = user_data["frequency"]
            updated_children.append(child)
            # Also update in church deacons list
            for deacon in deacons:
                if deacon.get("uid") == child.get("uid"):
                    deacon["frequency"] = child.get("frequency", 0)
    
    church_ref.update({"deacons": deacons})
    user_data["children"] = updated_children
    user_doc_ref.update(user_data)



# ============================================================================
# NEXT WEEK SERVE TRACKING
# Updates each user's "nextWeekServe" field showing their next scheduled date
# ============================================================================

def set_next_week_serve(church_id):
    """
    Scans all schedules and updates each user's nextWeekServe field
    with their earliest upcoming service date and role.
    """
    reset_next_dates(church_id)

    firestore_client = firestore.Client()
    schedules_ref = (
        firestore_client.collection("churches")
        .document(church_id)
        .collection("schedule")
    )
    schedules = list(schedules_ref.stream())

    for schedule in schedules:
        schedule_id = schedule.id
        schedule_data = schedule.to_dict()

        for key, value in schedule_data.items():
            if key == "extra":
                continue

            if key == "altar":
                for altar_server in value:
                    for individual_key, individual_value in altar_server.items():
                        if individual_key == "uid" and individual_value != "N/A":
                            set_user_next_week(individual_value, str(schedule_id), key)

            if isinstance(value, dict):
                for individual_key, individual_value in value.items():
                    if individual_key == "uid" and individual_value != "N/A":
                        set_user_next_week(individual_value, str(schedule_id), key)

    return


def set_user_next_week(user_id, week, role):
    """
    Updates a user's nextWeekServe/nextRole if this date is earlier
    than their current next scheduled date.
    """
    firestore_client = firestore.Client()
    user_ref = firestore_client.collection("users").document(user_id)
    role = interpret_role(role)
    
    user_data = user_ref.get()
    if user_data.exists:
        user_info = user_data.to_dict()
        next_week_serve = user_info.get("nextWeekServe")
        
        # Set if no current value
        if next_week_serve == "N/A" or next_week_serve == "Not Yet Scheduled" or not next_week_serve:
            user_info["nextWeekServe"] = week
            user_info["nextRole"] = role
            user_ref.set(user_info)
            return

        if not week:
            return

        # Only update if new date is earlier
        try:
            new_date = datetime.datetime.strptime(week, "%m-%d-%y")
            existing_date = datetime.datetime.strptime(next_week_serve, "%m-%d-%y")
            if new_date < existing_date:
                user_info["nextWeekServe"] = week
                user_info["nextRole"] = role
                user_ref.set(user_info)
        except ValueError as e:
            return https_fn.Response(f"Invalid date format: {str(e)}", status=400)
    else:
        return