"""
user_updates.py - User and Church Membership Management for Taksis

Handles user lifecycle events related to church membership:
- Adding/removing users from church deacon rosters
- Managing children accounts (linked to parent)
- Syncing user data across schedules when profiles change
- Tracking last serve dates and roles

Key relationships:
- Users belong to one church (user.church -> churches/{churchId})
- Users can have children (user.children[] -> linked accounts)
- Deacons are listed in church.deacons[] for scheduling
- Servants (SS teachers) are in churches/{id}/Servants Meeting subcollection
"""

import datetime
from google.cloud import firestore
from google.cloud.firestore_v1.base_query import FieldFilter
from firebase_functions import https_fn
import logging
logging.info(f'Attempting to import utility in user_updates')
from files.utility import (
    calc_age, interpret_role, commit_in_batches, carry_rotation_memory,
)
logging.info(f'Successfully imported utility in user_updates')
from firebase_admin import auth


def next_week_all_servants():
    """
    Scheduled function: Updates nextWeekServe for all servants across all churches.
    Typically runs after schedule generation to refresh user dashboards.
    
    Note: Imports set_next_week_serve locally to avoid circular import with schedule_generation.
    """
    # Local import to avoid circular dependency
    from files.schedule_generation import set_next_week_serve
    
    firestore_client = firestore.Client()
    church_docs = firestore_client.collection("churches").stream()
    for church_doc in church_docs:
        church_id = church_doc.id
        set_next_week_serve(church_id)


def handle_children(children):
    """
    Processes a parent's children list - removes from old churches and adds to current.
    Called when parent updates their profile to sync children's church membership.
    """
    for child in children:
        previous = remove_user_from_churches(child.get("uid"))
        add_user_to_churches(child, previous)
    return


def remove_user_from_churches(user_id):
    """
    Removes a user from ALL churches (deacon lists and servants meetings).
    Used before re-adding to ensure clean state when switching churches.

    Returns the roster entry that was removed (or None), so a paired
    `add_user_to_churches` can preserve the person's rotation history.

    The cross-church sweep is deliberate - it is what makes switching churches
    work - but the write is now scoped to the field that changed. It previously
    passed the whole church document to `update()`, which rewrote every field
    (including the entire deacons array) even when only a Servants Meeting
    document had been deleted, and clobbered any concurrent edit to the rest of
    the document.
    """
    firestore_client = firestore.Client()
    church_ref = firestore_client.collection("churches")
    church_docs = church_ref.stream()

    removed = None

    for doc in church_docs:
        church_data = doc.to_dict()

        existing_deacons = church_data.get("deacons", [])
        filtered_deacons = [d for d in existing_deacons if d.get("uid") != user_id]

        if len(filtered_deacons) != len(existing_deacons):
            # Hand the old entry back so the caller can carry the person's
            # rotation history across a re-add.
            removed = next(
                (d for d in existing_deacons if d.get("uid") == user_id), None
            )
            doc.reference.update({"deacons": filtered_deacons})

        # Remove from Servants Meeting subcollection
        servants_ref = doc.reference.collection("Servants Meeting")
        servants_docs = servants_ref.where(
            filter=FieldFilter("uid", "==", user_id)
        ).stream()
        for servant in servants_docs:
            servant.reference.delete()

    return removed


def filter_data(user_data):
    """
    Extracts only the fields needed for church membership.
    Prevents storing unnecessary user data in church documents.
    """
    filtered_data = {
        "name": user_data.get("name"),
        "uid": user_data.get("uid"),
        "age": user_data.get("age"),
        "church": user_data.get("church"),
        "isDeacon": user_data.get("isDeacon"),
        "experience": user_data.get("experience"),
        "frequency": user_data.get("frequency"),
        "rank": user_data.get("rank"),
        "weeksSince": user_data.get("weeksSince"),
        "isSSTeacher": user_data.get("isSSTeacher"),
    }
    return filtered_data


def add_user_to_churches(user_data, previous=None):
    """
    Adds a user to their church's deacon roster and/or servants meeting list.
    
    Handles:
    - Age calculation from DOB if age not provided
    - Adding to deacons list (if isDeacon=True)
    - Adding to Servants Meeting (if isSSTeacher=True)
    - Adding to all schedule extras lists (new deacons available for substitution)
    - Processing children recursively
    - Setting default experience/frequency for new deacons

    `previous` is the roster entry from a preceding `remove_user_from_churches`.
    Passing it preserves the person's place in the rotation; omitting it treats
    them as brand new.
    """
    firestore_client = firestore.Client()
    user_id = user_data["uid"]

    # Recursively handle children first
    if "children" in user_data:
        handle_children(user_data["children"])
    
    user_data = filter_data(user_data)

    # Ensure age is available (calculate from DOB if needed)
    if "age" not in user_data and "DOB" not in user_data:
        return https_fn.Response("User does not have age or DOB")
    elif not (isinstance(user_data.get("DOB"), type(None))) and isinstance(
        user_data.get("age"), type(None)
    ):
        user_data["age"] = calc_age(user_data["DOB"])
    elif not isinstance(user_data.get("age"), type(None)):
        pass
    else:
        return f"user: {user_data['name']} does not have age or DOB"
    
    # Validate church association
    church_id = user_data.get("church")
    if not church_id:
        return https_fn.Response("User has no associated church ID")

    church_doc_ref = firestore_client.collection("churches").document(church_id)
    church_doc = church_doc_ref.get()

    if not church_doc.exists:
        return https_fn.Response(
            f"Church document not found for church id: {church_id}", status=404
        )

    church_data = church_doc.to_dict() or {}
    church_data.setdefault("deacons", [])

    # Add to deacons list if user is a deacon
    if user_data.get("isDeacon"):
        user_ref = firestore_client.collection("users").document(user_data["uid"])
        
        # Only add if not already in list
        if not any(
            deacon.get("uid") == user_data["uid"] for deacon in church_data["deacons"]
        ):
            # Set defaults for new deacons
            if "experience" not in user_data:
                user_data["experience"] = 2
                user_ref.update({"experience": 2})
            if "frequency" not in user_data:
                user_data["frequency"] = 2
                user_ref.update({"frequency": 2})
            
            new_deacon = {
                "uid": user_data["uid"],
                "name": user_data["name"],
                "age": int(user_data["age"]),
                "experience": float(user_data["experience"]),
                "frequency": float(user_data["frequency"]),
                "rank": user_data["rank"],
            }
            # Carries weeksSince et al from the entry we just removed, falling
            # back to the newcomer defaults. This was hardcoded, so any
            # membership change wiped the person's rotation history.
            new_deacon.update(carry_rotation_memory(previous))
            church_data["deacons"].append(new_deacon)
        
        # Add to extras in all future schedules
        add_user_to_extra_servers(church_id, user_data["name"], user_id)
    else:
        # Not a deacon - remove from any existing schedules
        remove_user_from_schedules(church_id, user_id, "N/A", "N/A", False)

    # Handle Servants Meeting membership (for SS teachers)
    servant_ref = (
        firestore_client.collection("churches")
        .document(church_id)
        .collection("Servants Meeting")
        .document(user_data["uid"])
    )
    servant_ref.delete()  # Remove first (clean slate)

    if user_data.get("isSSTeacher"):
        new_servant = {
            "uid": user_data["uid"],
            "name": user_data["name"],
        }
        servant_doc_ref = church_doc_ref.collection("Servants Meeting").document(
            new_servant["uid"]
        )
        servant_doc_ref.set(new_servant, merge=True)

    try:
        church_doc_ref.set(church_data, merge=True)
    except Exception as e:
        return https_fn.Response(f"Error updating church data: {str(e)}", status=500)

    return https_fn.Response("User successfully added to the church", status=200)


def add_user_to_extra_servers(church, name, uid):
    """
    Adds a new deacon to the 'extra' list in all existing schedules.
    This makes them available as replacements when someone marks unavailable.
    Skips if user is already scheduled in any role for that week.
    """
    firestore_client = firestore.Client()
    schedules_ref = (
        firestore_client.collection("churches").document(church).collection("schedule")
    )
    schedules_docs = schedules_ref.stream()

    for schedule in schedules_docs:
        schedule_data = schedule.to_dict()
        add_user = True

        # Check if user already exists anywhere in this schedule
        for key, value in schedule_data.items():
            if isinstance(value, list):
                for deacon in value:
                    if isinstance(deacon, dict) and deacon.get("uid") == uid:
                        add_user = False
                        break
            if isinstance(value, dict) and value.get("uid") == uid:
                add_user = False
                break
            if not add_user:
                break

        # Add to extras if not already scheduled
        if add_user:
            extras = schedule_data.get("extra", [])
            extras.append({"name": name, "uid": uid})
            schedule.reference.update({"extra": extras})


def get_weeks(church):
    """Returns list of all schedule week IDs (MM-DD-YY format) for a church."""
    firestore_client = firestore.Client()
    weeks = []
    schedule_docs = (
        firestore_client.collection("churches")
        .document(church)
        .collection("schedule")
        .stream()
    )
    for schedule in schedule_docs:
        weeks.append(str(schedule.id))
    return weeks


def remove_user_from_schedules(church, uid, alhan_class, sunday_school_class, family):
    """
    Removes a user from all future schedules and optionally from teaching assignments.
    
    Args:
        church: Church ID
        uid: User ID to remove
        alhan_class: Hymns class to remove from, or "N/A" to skip
        sunday_school_class: SS class to remove from, or "N/A" to skip
        family: If True, also marks user as non-servant
    
    Note: Imports unavailable locally to avoid circular import with schedule_generation.
    """
    # Local import to avoid circular dependency
    from files.schedule_generation import unavailable
    
    firestore_client = firestore.Client()
    church_ref = firestore_client.collection("churches").document(church)
    user_ref = firestore_client.collection("users").document(uid)
    
    if user_ref.get().exists:
        user_data = user_ref.get().to_dict()
        if family:
            user_data["isServant"] = False
            user_ref.update(user_data)

    # Remove from all scheduled weeks using unavailable
    for week in get_weeks(church):
        request_data = {
            'church': church,
            'week': week,
            'uid': uid,
            'family': False
        }
        unavailable(request_data)

    # Remove from Alhan (Hymns) class if specified
    if not alhan_class == "N/A":
        alhan_class_doc = church_ref.collection("Hymns Class").document(alhan_class)
        alhan_class_data = alhan_class_doc.get().to_dict()
        if alhan_class_data:
            servants = alhan_class_data.get("servants", [])
            updated_servants = [
                servant for servant in servants if servant.get("uid") != uid
            ]
            alhan_class_doc.update({"servants": updated_servants})
            user_data["alhanSetUp"] = False
            user_data["alhanGrades"] = None
            user_ref.update(user_data)

    # Remove from Sunday School class if specified
    if not sunday_school_class == "N/A":
        sunday_school_class_doc = church_ref.collection("Sunday School").document(
            sunday_school_class
        )
        sunday_school_class_data = sunday_school_class_doc.get().to_dict()
        if sunday_school_class_data:
            servants = sunday_school_class_data.get("servants", [])
            updated_servants = [
                servant for servant in servants if servant.get("uid") != uid
            ]
            sunday_school_class_doc.update({"servants": updated_servants})
            user_data["ssSetUp"] = False
            user_data["ssGrades"] = None
            user_ref.update(user_data)

    return


def update_names(user_id, name, church):
    """
    Updates a user's name across all schedule documents.
    Called when user changes their display name.
    """
    firestore_client = firestore.Client()
    schedules_docs = (
        firestore_client.collection("churches")
        .document(church)
        .collection("schedule")
        .stream()
    )
    
    for schedule in schedules_docs:
        schedule_data = schedule.to_dict()
        for key, value in schedule_data.items():
            if isinstance(value, list):
                for deacon in value:
                    if isinstance(deacon, dict) and deacon.get("uid") == user_id:
                        deacon["name"] = name
            elif isinstance(value, dict):
                if value.get("uid") == user_id:
                    value["name"] = name
        schedule.reference.update(schedule_data)


def update_last_serve(schedule_data, schedule_id=None):
    """
    Updates lastServe and lastRole fields for all users in a completed schedule.
    Called after a Sunday service to record who served and in what role.
    Skips users in 'extra' list (they didn't actually serve).

    Was 4 reads + 1 write per server: an existence check, the update, then two
    more reads that existed only to feed debug `print()` calls. Now one
    `get_all` for the whole schedule plus batched writes.
    """
    firestore_client = firestore.Client()
    users_ref = firestore_client.collection("users")

    pending = {}
    for key, value in schedule_data.items():
        if key == "extra":
            continue

        entries = value if isinstance(value, list) else [value]
        for individual in entries:
            if not isinstance(individual, dict):
                continue
            if individual.get("name") in (None, "N/A"):
                continue
            uid = individual.get("uid")
            if uid:
                pending[uid] = {
                    "lastServe": schedule_id,
                    "lastRole": interpret_role(key),
                }

    if not pending:
        return

    uids = list(pending)
    refs = [users_ref.document(uid) for uid in uids]
    # Unfilled slots and child profiles have no user document; `update` inside a
    # batch fails the whole batch if the target is missing, so filter first.
    live = {doc.id for doc in firestore_client.get_all(refs) if doc.exists}

    written = commit_in_batches(
        firestore_client,
        ((users_ref.document(uid), pending[uid]) for uid in uids if uid in live),
    )
    logging.info(
        f"update_last_serve({schedule_id}): {written} of {len(pending)} servers updated"
    )
