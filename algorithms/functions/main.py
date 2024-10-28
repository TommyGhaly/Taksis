from typing import Any
from datetime import datetime

# [START v2imports]
# Dependencies for callable functions.
from firebase_functions import https_fn, scheduler_fn, firestore_fn

# Dependencies for writing to Firestore.
from firebase_admin import initialize_app, firestore
import google.cloud.firestore

initialize_app()

@scheduler_fn.on_schedule(
    schedule="5 21 * * *",  # Run every day at 9:05 PM
    timezone=scheduler_fn.Timezone("America/New_York"),
)
def my_scheduled_function(event: scheduler_fn.ScheduledEvent) -> https_fn.Response:
    # [START adminSdkPush]
    firestore_client: google.cloud.firestore.Client = firestore.client()

    # Read from the "churches" collection
    doc_ref = firestore_client.collection("churches").document("sample")
    doc = doc_ref.get()

    if doc.exists:
        # Get the data from the document
        doc_data = doc.to_dict()

        # Check if 'deacons' array exists in the document data
        deacons = doc_data.get("deacons", [])

        # Define the schedule template with deacon roles
        schedule_template = [
            "matins", "third", "sixth", "pauline", "catholic", "praxis", "gospel",
            "water", "wine", "altar server 1", "altar server 2"
        ]

        # Map each deacon's name to a role in the schedule template
        schedule_data = {}
        for i, role in enumerate(schedule_template):
            # Use deacons[i].get("name") to get the name if it exists, otherwise set to "Unassigned"
            schedule_data[role] = deacons[i].get("name", "Unassigned") if i < len(deacons) else "Unassigned"

        # Generate the document ID as the current date in YYYY-MM-DD format
        current_date = datetime.now().strftime("%Y-%m-%d")

        # Push the schedule data into the "schedules" collection with the current date as document ID
        firestore_client.collection("schedules").document(current_date).set(schedule_data)

        # Send back a message that we've successfully written the schedule
        return https_fn.Response(f"Schedule document for {current_date} added.")
    else:
        # If the document does not exist, return an error message
        return https_fn.Response(f"Document not found in 'churches' collection.", status=404)
    # [END adminSdkPush]