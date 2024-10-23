from typing import Any

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

    # Read from the "churches" collection, document "St. Philopater and St. Mina, Wayland, MA"
    doc_ref = firestore_client.collection("churches").document("St. Philopater and St. Mina, Wayland, MA")
    doc = doc_ref.get()

    if doc.exists:
        # Get the data from the document
        doc_data = doc.to_dict()

        # Push the document data into the "schedules" collection
        _, new_doc_ref = firestore_client.collection("schedules").add(doc_data)

        # Send back a message that we've successfully written the message
        return https_fn.Response(f"Document with ID {new_doc_ref.id} added to schedules.")
    else:
        # If the document does not exist, return an error message
        return https_fn.Response(f"Document not found in 'churches' collection.", status=404)