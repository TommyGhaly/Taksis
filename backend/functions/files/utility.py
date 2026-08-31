"""
utility.py - Shared Helper Functions for Taksis

Contains common utilities used across multiple modules:
- Date/age calculations
- Child-parent relationship lookups
- Role name formatting
- User field resets
"""

import datetime
from google.cloud import firestore
# Positional `where(field, op, value)` emits a UserWarning on every call in
# google-cloud-firestore 2.x. These run per request, so use the supported form.
from google.cloud.firestore_v1.base_query import FieldFilter

# Firestore caps a write batch at 500 operations.
BATCH_LIMIT = 500

# Fields on churches/{id}.deacons[] that represent a servant's accumulated
# scheduling history, as opposed to profile data copied from their user doc.
#
# These must survive a roster rebuild. Re-adding someone - which happens on a
# church switch, or on any membership change - used to reset them, so a servant
# who was overdue to serve silently went back to the middle of the queue.
# Anything added here is automatically carried across by add_user_to_churches.
ROTATION_MEMORY_DEFAULTS = {
    "weeksSince": 4,       # start partway up the queue so newcomers serve soon
    "lastWeeksSince": 4,
    "assignedCount": 0,    # times put on a schedule
    "declinedCount": 0,    # times they then dropped out
    "roleHistory": [],     # most recent roles first, newest at index 0
}


def carry_rotation_memory(previous):
    """Rotation fields to use for a roster entry, given the prior entry (or None)."""
    if not previous:
        return dict(ROTATION_MEMORY_DEFAULTS)
    return {
        key: previous.get(key, default)
        for key, default in ROTATION_MEMORY_DEFAULTS.items()
    }


def commit_in_batches(client, writes):
    """Apply `writes` in chunks of BATCH_LIMIT, returning the number applied.

    `writes` is an iterable of (doc_ref, payload) pairs applied with `update`.
    `update` is deliberate rather than `set(merge=True)`: these call sites all
    patch documents that must already exist, and a merge-set would silently
    create one instead. Callers are responsible for filtering to live docs -
    a batch containing an update to a missing document fails as a unit.
    """
    writes = list(writes)
    applied = 0
    for start in range(0, len(writes), BATCH_LIMIT):
        batch = client.batch()
        for doc_ref, payload in writes[start:start + BATCH_LIMIT]:
            batch.update(doc_ref, payload)
        batch.commit()
        applied += len(writes[start:start + BATCH_LIMIT])
    return applied



def calc_age(dob_str):
    """
    Calculates age from a date of birth string.
    
    Args:
        dob_str: Date string in MM-DD-YYYY format
    
    Returns:
        Integer age, or None if invalid/missing
    """
    if dob_str:
        try:
            dob = datetime.datetime.strptime(dob_str, "%m-%d-%Y")
            today = datetime.datetime.now()
            # Subtract 1 if birthday hasn't occurred yet this year
            age = (
                today.year
                - dob.year
                - ((today.month, today.day) < (dob.month, dob.day))
            )
            return age
        except Exception as e:
            return None
    return None


def search_for_child(uid):
    """
    Finds a parent's FCM tokens for a given child UID.
    
    Used by notification system to send notifications to parents
    when the child doesn't have their own device/tokens.
    
    Args:
        uid: The child's user ID
    
    Returns:
        (True, fcm_tokens[]) if parent found with tokens
        (False, None) if no parent found or parent has no tokens
    """
    firestore_client = firestore.Client()
    users_ref = firestore_client.collection("users")
    
    # Scan all users (Firestore can't query inside array of maps)
    all_users = users_ref.stream()

    for user in all_users:
        user_data = user.to_dict()
        children = user_data.get("children", [])
        
        if children and isinstance(children, list):
            for child in children:
                if isinstance(child, dict) and child.get("uid") == uid:
                    # Found the parent - check for FCM tokens
                    if (
                        "fcmTokens" in user_data
                        and isinstance(user_data["fcmTokens"], list)
                        and len(user_data["fcmTokens"]) > 0
                    ):
                        return (True, user_data["fcmTokens"])
                    else:
                        return (False, None)

    return (False, None)


def is_today_or_upcoming_sunday(week_id_str):
    """
    Checks if a week ID represents today or the next upcoming Sunday.
    
    Used to determine if notifications should be sent for schedule changes
    (only notify for imminent changes, not far-future ones).
    
    Args:
        week_id_str: Date string in MM-DD-YY format
    
    Returns:
        True if date is today or next Sunday, False otherwise
    """
    try:
        week_id_date = datetime.datetime.strptime(week_id_str, "%m-%d-%y").date()
    except ValueError:
        return False

    today = datetime.datetime.today().date()
    weekday = today.weekday()  # Monday=0, Sunday=6
    days_until_sunday = (6 - weekday)

    # If today is Sunday, target next Sunday instead
    if days_until_sunday == 0:
        days_until_sunday = 7

    next_sunday = today + datetime.timedelta(days=days_until_sunday)

    result = (week_id_date == today or week_id_date == next_sunday)

    return result


def interpret_role(role):
    """
    Converts internal role keys to user-friendly display names.
    Used in UI and notifications.
    
    Args:
        role: Internal key (e.g., "gospel", "wine", "altar")
    
    Returns:
        Human-readable role name (e.g., "Gospel Reader", "Wine Bearer")
    """
    if role == "N/A":
        return "Not Yet Scheduled"
    elif role == "matins":
        return "Matins Gospel Reader"
    elif role == "third":
        return "Third Hour Gospel Reader"
    elif role == "sixth":
        return "Sixth Hour Gospel Reader"
    elif role == "pauline":
        return "Pauline Epistle Reader"
    elif role == "catholic":
        return "Catholic Epistle Reader"
    elif role == "praxis":
        return "Praxis Reader"
    elif role == "gospel":
        return "Gospel Reader"
    elif role == "water":
        return "Water Bearer"
    elif role == "wine":
        return "Wine Bearer"
    elif role == "altar":
        return "Altar Server"
    
    
def determine_role(location):
    """
    Converts role key to natural language phrase for notifications.
    Similar to interpret_role but formatted for sentence context.
    
    Args:
        location: Internal role key
    
    Returns:
        Phrase like "the Gospel reader" or "a wine server"
    """
    if location == "gospel":
        return "the Gospel reader"
    elif location == "wine":
        return "a wine server"
    elif location == "water":
        return "a water server"
    elif location == "praxis":
        return "the Praxis reader"
    elif location == "catholic":
        return "the Catholic Epistle reader"
    elif location == "pauline":
        return "the Pauline Epistle reader"
    elif location == "sixth":
        return "the Sixth Hour Gospel reader"
    elif location == "third":
        return "the Third Hour Gospel reader"
    elif location == "matins":
        return "the Matins Gospel reader"
    else:
        return None
    
    

def reset_next_dates(church_id):
    """
    Resets nextWeekServe and nextRole for all users in a church.

    Called before recalculating next serve dates to ensure clean state.
    Sets both fields to "Not Yet Scheduled".

    This used to stream the *entire* users collection - every user of every
    church - and filter in Python. It runs on the critical path of every
    schedule generation, every swap and every unavailability request, so the
    query is now scoped to the church and the writes go out in batches.
    """
    firestore_client = firestore.Client()
    users_ref = firestore_client.collection("users")
    users_docs = users_ref.where(filter=FieldFilter("church", "==", church_id)).stream()

    reset = {"nextWeekServe": "Not Yet Scheduled", "nextRole": "Not Yet Scheduled"}
    commit_in_batches(firestore_client, ((user.reference, reset) for user in users_docs))
    return


def get_next_sunday(base_date: datetime.date) -> datetime.date:
    """
    Calculates the next Sunday from a given date.
    
    If base_date is Sunday, returns the following Sunday (not today).
    
    Args:
        base_date: Starting date for calculation
    
    Returns:
        datetime.date of the next Sunday
    """
    days_ahead = (6 - base_date.weekday()) % 7
    # If today is Sunday, we want next Sunday (7 days), not today
    days_ahead = 7 if days_ahead == 0 else days_ahead
    return base_date + datetime.timedelta(days=days_ahead)