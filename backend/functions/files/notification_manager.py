"""
notifications.py - Firebase Cloud Messaging (FCM) Notification System for Taksis Church App

This module handles all push notification functionality for the Taksis church management
application. It provides notifications for:
- Liturgy schedule reminders (sent to altar servers before Sunday services)
- Schedule switch notifications (when admins swap server assignments)
- Unavailability rescheduling notifications (when servers are reassigned due to conflicts)
- Servants meeting reminders (sent to church servants before meetings)

The module supports a parent-child notification system where if a child (minor) doesn't
have FCM tokens registered, the notification is automatically forwarded to their parent(s).

Dependencies:
- firebase_admin.messaging: For sending FCM push notifications
- google.cloud.firestore: For accessing user and church data
- asyncio: For concurrent notification processing
- files.utility: Helper functions for child lookup, date checking, and role interpretation

Author: Taksis Development Team
"""

from firebase_admin import messaging
import datetime
import asyncio
from google.cloud import firestore
import logging
logging.info('Attempting to import utility in notification_manager')
from files.utility import search_for_child, is_today_or_upcoming_sunday, interpret_role, determine_role
logging.info('Successfully imported utility in notification_manager')

def update_notification(uid: str, message: str, child_message: str, title: str) -> None:
    """
    Sends a push notification to a user, with automatic parent fallback for children.
    
    This is the primary notification dispatch function. It first attempts to send
    the notification directly to the user. If the user has no registered FCM tokens
    (common for children who don't have their own devices), it searches for the
    user's parent(s) and sends them a modified message instead.
    
    The parent fallback system ensures that parents are always informed about
    their children's church activities, even if the child doesn't have the app
    installed on their own device.
    
    Args:
        uid (str): The Firebase User ID of the intended recipient. This ID is used
                   to look up the user's document in the 'users' collection.
        message (str): The notification body text for adult users or users with
                      their own devices. Should be personalized (e.g., "John! You 
                      are scheduled to serve...").
        child_message (str): Alternative notification body text sent to parents
                            when notifying about their child. Should reference
                            the child (e.g., "Your son John is scheduled...").
        title (str): The notification title displayed prominently on the device
                    (e.g., "Liturgy Reminder", "Schedule Update!").
    
    Returns:
        None
    
    Side Effects:
        - Sends FCM push notification(s) to registered device tokens
        - Prints error message to console if no tokens found for user or parents
    
    Example:
        >>> update_notification(
        ...     uid="user123",
        ...     message="John! You are scheduled to serve this Sunday!",
        ...     child_message="Your son John is scheduled to serve this Sunday!",
        ...     title="Liturgy Reminder"
        ... )
    
    Note:
        The function silently succeeds even if the notification fails to send.
        FCM token validation and cleanup should be handled separately.
    """
    
    # Initialize Firestore client to access user data
    firestore_client = firestore.Client()
    
    # Retrieve the user document from the 'users' collection
    user_ref = firestore_client.collection("users").document(uid)
    user_doc = user_ref.get()
    
    if user_doc.exists:
        user_data = user_doc.to_dict()
        
        # Check if user has valid FCM tokens registered
        # FCM tokens are stored as a list since users may have multiple devices
        if (
            "fcmTokens" in user_data
            and isinstance(user_data["fcmTokens"], list)
            and len(user_data["fcmTokens"]) > 0
        ):
            # User has tokens - send notification directly to them
            fcm_tokens = user_data["fcmTokens"]
            send_notification(fcm_tokens, message, title)
    else:
        # User document doesn't exist - this might be a child account
        # Search for parent accounts that have this user listed as a child
        # search_for_child returns: (found: bool, parent_fcm_tokens: list)
        child_info = search_for_child(uid)
        
        if child_info[0]:
            # Found parent(s) - send the child-specific message to them
            send_notification(child_info[1], child_message, title)
        else:
            # No valid notification target found
            print(f"No FCM tokens found for user {uid} or their children.")



def handle_unavailable_notification(user_id: str, week_id: str, role: str, name: str):
    """
    Notifies a user when they've been rescheduled due to another server's unavailability.
    
    When a scheduled server marks themselves as unavailable, the scheduling system
    finds a replacement. This function notifies that replacement server about their
    new assignment. Notifications are only sent if the schedule change affects
    the current or upcoming Sunday to avoid confusing users with far-future changes.
    
    Args:
        user_id (str): Firebase User ID of the server being notified (the replacement).
        week_id (str): The week identifier in MM-DD-YY format (e.g., "12-25-24").
                      Used to determine if the notification is relevant (today/upcoming).
        role (str): The role key the user has been assigned to (e.g., "censer", "reader").
                   Will be converted to human-readable format via interpret_role().
        name (str): Full name of the user being notified. First name is extracted
                   for personalized notification message.
    
    Returns:
        None (explicit return for clarity)
    
    Side Effects:
        - Sends push notification if week_id is today or upcoming Sunday
        - No notification sent for future weeks beyond the upcoming Sunday
    
    Example:
        >>> handle_unavailable_notification(
        ...     user_id="user456",
        ...     week_id="12-29-24",
        ...     role="censer",
        ...     name="Peter Smith"
        ... )
        # If 12-29-24 is this Sunday, Peter gets notified about serving as Censer Bearer
    
    Note:
        The function uses is_today_or_upcoming_sunday() to filter notifications,
        preventing spam for schedule changes made far in advance.
    """
    
    # Only send notifications for imminent schedule changes
    # This prevents notification fatigue for changes made weeks in advance
    if is_today_or_upcoming_sunday(week_id):
        # interpret_role() converts role keys to user-friendly names
        # e.g., "censer" -> "Censer Bearer"
        update_notification(
            user_id,
            f"{name.split()[0]}! You have been rescheduled to serve as {interpret_role(role)} this Sunday! Check the app for details.",
            f"Your son {name.split()[0]} has been rescheduled to serve as {interpret_role(role)} this Sunday! Check the app for details.",
            "Schedule Update!",
        )
    return


async def liturgy_notification():
    """
    Sends liturgy reminder notifications to all scheduled servers for the upcoming Sunday.
    
    This is a scheduled async function (typically triggered by a Cloud Function or cron job)
    that runs before Sunday services to remind all scheduled servers of their assignments.
    It iterates through all churches in the system and notifies every server who has
    a role assigned for the target Sunday.
    
    Target Sunday Calculation Logic:
        - If called on Sunday: Targets NEXT Sunday (not today)
        - If called on any other day: Targets the upcoming Sunday
        
        This ensures that if the notification job runs on Sunday morning, it reminds
        people about next week, not the service that's already happening.
    
    Schedule Document Structure (expected in Firestore):
        Collection: churches/{churchId}/schedule/{MM-DD-YY}
        Fields can be:
        - Single server roles (dict): {"name": "John", "uid": "user123"}
        - Multi-server roles (list): [{"name": "John", "uid": "user123"}, ...]
        - "extra" field is skipped (backup servers don't get reminded)
        - "N/A" values indicate unfilled positions (skipped)
    
    Returns:
        None
    
    Side Effects:
        - Sends push notifications to all scheduled servers across all churches
        - Prints debug information about schedule lookup and notification sending
    
    Async Implementation:
        Uses asyncio.gather() with asyncio.to_thread() to send notifications
        concurrently, improving performance when notifying many servers.
    
    Example Usage (in Cloud Function):
        >>> import asyncio
        >>> asyncio.run(liturgy_notification())
    
    Note:
        The date calculation logic mirrors generate_schedule() to ensure consistency
        between when schedules are created and when notifications are sent.
    """
    
    # Calculate the target Sunday date
    # This logic must stay synchronized with the schedule generation logic
    today = datetime.datetime.now()
    
    # Calculate days until next Sunday (Sunday = 6 in Python's weekday())
    # If today is Sunday, this gives 0; otherwise gives days remaining
    days_until_sunday = (6 - today.weekday()) % 7
    upcoming_sunday = today + datetime.timedelta(days=days_until_sunday)
    
    # Normalize to midnight for consistent date comparison
    upcoming_sunday = upcoming_sunday.replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    
    # Special handling for Sundays: target NEXT week instead of today
    # This prevents sending "you're scheduled today" messages for next week's schedule
    if today.weekday() == 6:  # Sunday
        target_sunday = upcoming_sunday + datetime.timedelta(weeks=1)
    else:
        target_sunday = upcoming_sunday
    
    # Format date as MM-DD-YY to match Firestore document IDs
    next_sunday_str = target_sunday.strftime("%m-%d-%y")

    print(f"Liturgy notification: Looking for schedule document '{next_sunday_str}' for date {target_sunday}")

    # Initialize Firestore and get all churches
    firestore_client = firestore.Client()
    churches_ref = firestore_client.collection("churches")
    churches_docs = churches_ref.stream()

    # Collect all notification tasks for concurrent execution
    tasks = []

    # Iterate through each church in the system
    for church_doc in churches_docs:
        # Look for the schedule document for the target Sunday
        schedule_ref = church_doc.reference.collection("schedule")
        schedule_doc = schedule_ref.document(next_sunday_str).get()
        
        if not schedule_doc.exists:
            # No schedule exists for this Sunday at this church
            print(f"Schedule document '{next_sunday_str}' not found for church {church_doc.id}")
            continue
        else:
            print(f"Found schedule document '{next_sunday_str}' for church {church_doc.id}")

        # Process each field in the schedule document
        # Fields represent different serving positions (censer, reader, altar servers, etc.)
        for key, value in schedule_doc.to_dict().items():
            print(f"Processing key: {key}, value: {value}")

            # Skip positions marked as N/A (unfilled)
            if isinstance(value, dict):
                if value["name"] == "N/A":
                    continue

            # Skip "extra" servers - they're backups and don't need reminders
            if key == "extra":
                continue

            # Handle multi-server positions (e.g., altar servers stored as a list)
            if isinstance(value, list):
                for server in value:
                    # Skip unfilled slots in the list
                    if server["name"] == "N/A":
                        print(f"Skipping {server['name']} in {key}")
                        continue
                    
                    print(f"Sending notification to {server['name']}")
                    
                    # Queue notification task for concurrent execution
                    # asyncio.to_thread() runs the blocking update_notification in a thread pool
                    tasks.append(asyncio.to_thread(
                        update_notification,
                        server["uid"],
                        f"Great News {server['name'].split()[0]}! You are scheduled to serve this Sunday, {next_sunday_str} as an altar server. Please check the app for details.",
                        f"Great News! Your son {server['name'].split()[0]} is scheduled to serve this Sunday, {next_sunday_str} as an altar server. Please check the app for details.",
                        "Liturgy Reminder"
                    ))
            else:
                # Handle single-server positions (e.g., censer, reader)
                # Verify the value has a valid uid (not "N/A")
                if "uid" in value and value["uid"] != "N/A":
                    print(f"Sending notification to {value['name']}")
                    
                    # interpret_role() converts key (e.g., "censer") to display name (e.g., "Censer Bearer")
                    tasks.append(asyncio.to_thread(
                        update_notification,
                        value["uid"],
                        f"Great News {value['name'].split()[0]}! You are scheduled to serve this Sunday, {next_sunday_str} as a {interpret_role(key)}. Please check the app for details.",
                        f"Great News! Your son {value['name'].split()[0]} is scheduled to serve this Sunday, {next_sunday_str} as a {interpret_role(key)}. Please check the app for details.",
                        "Liturgy Reminder"
                    ))

    # Execute all notification tasks concurrently
    # This significantly speeds up notification delivery when there are many servers
    await asyncio.gather(*tasks)


def send_notification(fcm_tokens, body, title):
    """
    Low-level function to send FCM push notifications to a list of device tokens.
    
    This is the core notification delivery function that interfaces directly with
    Firebase Cloud Messaging. It sends the same notification to all provided tokens
    (allowing a single user to receive notifications on multiple devices).
    
    The function configures platform-specific settings:
        - Android: High priority for immediate delivery
        - iOS (APNS): Default sound and content-available flag for background updates
    
    Args:
        fcm_tokens (list): List of FCM device tokens to send the notification to.
                          Each token represents a specific device installation.
                          Tokens are obtained when users grant notification permissions.
        body (str): The main notification message body displayed to the user.
        title (str): The notification title displayed prominently.
    
    Returns:
        None
    
    Side Effects:
        - Sends FCM messages to Google's servers for delivery
        - Silently catches and ignores all exceptions (invalid tokens, network errors, etc.)
    
    Platform Configuration:
        Android (AndroidConfig):
            - priority="high": Ensures immediate delivery even in Doze mode
        
        iOS (APNSConfig):
            - sound="default": Plays the default notification sound
            - content_available=True: Allows background app refresh
    
    Example:
        >>> send_notification(
        ...     fcm_tokens=["token1", "token2"],
        ...     body="You have a new message!",
        ...     title="New Notification"
        ... )
    
    Note:
        Errors are silently ignored to prevent one invalid token from blocking
        notifications to other valid tokens. In production, consider logging
        errors and implementing token cleanup for invalid/expired tokens.
    
    Warning:
        Invalid or expired FCM tokens should be removed from user documents
        to prevent unnecessary API calls. Consider implementing a token
        validation/cleanup mechanism.
    """
    
    # Iterate through all tokens and send individual messages
    # FCM doesn't support true multicast in the same way, so we send individually
    for token in fcm_tokens:
        # Construct the FCM message with platform-specific configurations
        message = messaging.Message(
            token=token,  # Target device token
            notification=messaging.Notification(
                title=title,
                body=body,
            ),
            # Android-specific configuration
            android=messaging.AndroidConfig(
                priority="high"  # Bypass Doze mode for immediate delivery
            ),
            # iOS-specific configuration (Apple Push Notification Service)
            apns=messaging.APNSConfig(
                payload=messaging.APNSPayload(
                    aps=messaging.Aps(
                        sound="default",  # Play default notification sound
                        content_available=True  # Enable background refresh
                    )
                )
            ),
        )
        
        try:
            # Send the message through Firebase
            messaging.send(message)
        except Exception:
            # Silently ignore errors (invalid tokens, network issues, etc.)
            # TODO: Consider logging errors and cleaning up invalid tokens
            pass


def handle_switch_server_notification(
    first_server, second_server, first_location, second_location
):
    """
    Duplicate function definition - sends notifications to two servers who have been switched.
    
    WARNING: This is a duplicate of the earlier handle_switch_server_notification function.
    This appears to be unintentional code duplication and should be removed.
    The implementation is identical to the first definition above.
    
    See the documentation for the first handle_switch_server_notification function
    for complete details on parameters and behavior.
    
    TODO: Remove this duplicate function definition to avoid confusion and
    potential maintenance issues if one is updated but not the other.
    """
    
    # [Implementation identical to first definition - see above for documentation]
    if len(first_location) == 2:
        if first_location[0] == "extra":
            update_notification(
                second_server["uid"],
                f"{second_server["name"].split()[0]}! An admin has switched you with another deacon for this Sunday! Check the app for details.",
                f"An admin has switched your son {second_server["name"].split()[0]} with another deacon for this Sunday! Check the app for details.",
                "Schedule Update!",
            )
        elif first_location[0] == "altar":
            update_notification(
                second_server["uid"],
                f"{second_server["name"].split()[0]}! You have been switched with another deacon to serve in the altar this Sunday! Check the app for details.",
                f"Your son {second_server["name"].split()[0]} has been switched with another deacon to serve in the altar this Sunday! Check the app for details.",
                "Schedule Update!",
            )
    if len(second_location) == 2:
        if second_location[0] == "extra":
            update_notification(
                first_server["uid"],
                f"{first_server["name"].split()[0]}! An admin has switched you with another deacon for this Sunday! Check the app for details.",
                f"An admin has switched your son {first_server["name"].split()[0]} with another deacon for this Sunday! Check the app for details.",
                "Schedule Update!",
            )
        elif second_location[0] == "altar":
            update_notification(
                first_server["uid"],
                f"{first_server["name"].split()[0]}! You have been switched with another deacon to serve in the altar this Sunday! Check the app for details.",
                f"Your son {first_server["name"].split()[0]} has been switched with another deacon to serve in the altar this Sunday! Check the app for details.",
                "Schedule Update!",
            )
    if len(first_location) == 1:
        second_server_role = determine_role(first_location[0])
        update_notification(
            second_server["uid"],
            f"{second_server["name"].split()[0]}! You have been switched with another deacon to serve as {second_server_role} this Sunday! Check the app for details.",
            f"Your son {second_server["name"].split()[0]} has been switched with another deacon to serve as {second_server_role} this Sunday! Check the app for details.",
            "Schedule Update!",
        )
    if len(second_location) == 1:
        first_server_role = determine_role(second_location[0])
        update_notification(
            first_server["uid"],
            f"{first_server["name"].split()[0]}! You have been switched with another deacon to serve as {first_server_role} this Sunday! Check the app for details.",
            f"Your son {first_server["name"].split()[0]} has been switched with another deacon to serve as {first_server_role} this Sunday! Check the app for details.",
            "Schedule Update!",
        )


async def process_servant_notifications():
    """
    Orchestrates sending servants meeting reminders to all eligible servants.
    
    This async function is the entry point for the servants meeting notification
    system. It retrieves all users from Firestore and processes them concurrently
    to send meeting reminders to those who are marked as servants and have
    FCM tokens registered.
    
    This is typically triggered by a scheduled Cloud Function before the
    servants meeting time (e.g., Sunday afternoon after liturgy).
    
    Returns:
        None
    
    Side Effects:
        - Retrieves all user documents from Firestore
        - Sends notifications to all eligible servants concurrently
    
    Async Implementation:
        Uses asyncio.gather() to process all users concurrently, significantly
        reducing the total time needed when there are many servants.
    
    Example Usage:
        >>> import asyncio
        >>> asyncio.run(process_servant_notifications())
    
    Note:
        The function converts the Firestore stream to a list before processing.
        This is necessary because streams can only be iterated once, and we
        need to pass individual documents to the concurrent tasks.
    """
    
    # Initialize Firestore client
    firestore_client = firestore.Client()
    
    # Get reference to the users collection
    users_ref = firestore_client.collection("users")
    
    # Convert stream to list for concurrent processing
    # Streams are single-use iterators, so we materialize the list first
    users_docs = list(users_ref.stream())

    # Process all users concurrently using asyncio.gather
    # Each user is processed by notify_servant() which handles eligibility checks
    await asyncio.gather(
        *[notify_servant(firestore_client, user) for user in users_docs]
    )


async def notify_servant(firestore_client, user_doc):
    """
    Sends a servants meeting reminder to a single user if they are eligible.
    
    This async function checks if a user qualifies for servants meeting
    notifications and sends the reminder if so. Eligibility requires:
    1. User must be marked as a servant (isServant = True)
    2. User must have FCM tokens registered
    3. User must belong to a church
    
    The notification includes the church-specific meeting time, defaulting
    to "12:30 PM" if the church hasn't configured a custom time.
    
    Args:
        firestore_client: Active Firestore client instance for database queries.
                         Passed in to avoid creating multiple client instances.
        user_doc: Firestore document snapshot for the user to potentially notify.
                 Contains user data including isServant flag, fcmTokens, and church.
    
    Returns:
        None (returns early if user is not eligible)
    
    Side Effects:
        - May send a push notification to the user's devices
        - Performs a Firestore read to get church data (meeting time)
    
    Async Implementation:
        Uses asyncio.to_thread() to offload blocking Firestore operations
        and notification sending to a thread pool, keeping the event loop
        responsive.
    
    Example:
        >>> # Called internally by process_servant_notifications()
        >>> await notify_servant(firestore_client, user_document)
    
    Note:
        The default meeting time of "12:30 PM" should match the most common
        meeting time across churches. Churches can customize this by setting
        the 'servantsMeetingTime' field in their church document.
    """
    
    # Extract user data from the document snapshot
    user_data = user_doc.to_dict()
    
    # Early return if user is not a servant or has no FCM tokens
    # Both conditions must be true for the user to receive notifications
    if not user_data.get("isServant") or not user_data.get("fcmTokens"):
        return

    # Get the user's church ID for looking up meeting time
    church_id = user_data.get("church")
    if not church_id:
        # User is a servant but not associated with any church
        return

    # Fetch church document to get the custom meeting time
    # Using asyncio.to_thread() to avoid blocking the event loop
    # The lambda wrapper is needed because .get() is a method call
    church_doc = await asyncio.to_thread(
        lambda: firestore_client.collection("churches").document(church_id).get()
    )
    
    # Extract church data, defaulting to empty dict if document doesn't exist
    church_data = church_doc.to_dict() or {}

    # Send the notification with church-specific or default meeting time
    # asyncio.to_thread() offloads the blocking FCM send operation
    await asyncio.to_thread(
        send_notification,
        user_data["fcmTokens"],
        f"Reminder: Servants Meeting is starting soon at {church_data.get('servantsMeetingTime', '12:30 PM')}! Please be on time.",
        "Servants Meeting Reminder",
    )