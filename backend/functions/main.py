from typing import Any, List, Dict
import datetime
import random
import uuid
from firebase_functions import https_fn, scheduler_fn, firestore_fn
from firebase_admin import initialize_app, firestore, credentials, auth
import google.cloud.firestore


initialize_app()
# Uncomment to test locally
# db = firestore.client()

# takes in the 30 deacons and scores them based off best fit


# add like 5 extra deacons to the list for bakcups
def sort_values(deacons: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Sorts a list of deacons based on the 'value' attribute
    in descending order, with the greatest value first,
    and returns the top 25 deacons.

    Args:
        deacons (List[Dict[str, Any]]): A list of dictionaries where each dictionary represents
                                        a deacon with attributes such as 'age', 'experience',
                                        'frequency', 'name', 'rank', 'uid', 'weeksSince', and 'value'.

    Returns:
        List[Dict[str, Any]]: A sorted list of the top 25 deacons based on 'value'.
    """
    return sorted(deacons, key=lambda deacon: deacon["value"], reverse=True)


def matins(deacons):

    for deacon in deacons:
        value = 0
        value += deacon["weeksSince"] * 0.25

        if int(deacon["age"]) > 14 and int(deacon["age"]) < 22:
            value += 30

        value += (deacon["frequency"] - 3) * 0.13
        value += (deacon["experience"] - 4) * 0.12

        deacon["value"] = value
        # print(deacon)

    return sort_values(deacons)


def third(deacons):

    for deacon in deacons:
        value = 0
        value += deacon["weeksSince"] * 0.25

        if int(deacon["age"]) > 8 and int(deacon["age"]) < 18:
            value += 30

        value += (deacon["frequency"] - 3) * 0.13

        if deacon["rank"] == "Chanter (Epsaltos)":
            value += 12

        deacon["value"] = value
        # print(deacon)

    return sort_values(deacons)


def sixth(deacons):

    for deacon in deacons:
        value = 0
        value += deacon["weeksSince"] * 0.25

        if int(deacon["age"]) > 8 and int(deacon["age"]) < 18:
            value += 30

        value += (deacon["frequency"] - 3) * 0.13

        if deacon["rank"] == "Chanter (Epsaltos)":
            value += 12

        deacon["value"] = value
        # print(deacon)

    return sort_values(deacons)


def pauline(deacons):

    for deacon in deacons:

        value = 0
        value += deacon["weeksSince"] * 0.25

        if int(deacon["age"]) > 16 and int(deacon["age"]) < 35:

            value += 30

        value += (deacon["frequency"] - 3) * 0.13

        if deacon["rank"] == "Chanter (Epsaltos)":

            pass

        else:

            value += 2.4

        deacon["value"] = value
        # print(deacon)

    return sort_values(deacons)


def catholic(deacons):

    for deacon in deacons:

        value = 0
        value += deacon["weeksSince"] * 0.25

        if int(deacon["age"]) > 16 and int(deacon["age"]) < 35:

            value += 30

        value += (deacon["frequency"] - 3) * 0.13

        if deacon["rank"] == "Chanter (Epsaltos)":

            pass

        else:

            value += 2.4

        deacon["value"] = value
        # print(deacon)

    return sort_values(deacons)


def praxis(deacons):
    for deacon in deacons:

        value = 0
        value += deacon["weeksSince"] * 0.25

        if int(deacon["age"]) > 16 and int(deacon["age"]) < 35:

            value += 30

        value += (deacon["frequency"] - 3) * 0.13

        if deacon["rank"] == "Chanter (Epsaltos)":

            pass

        else:

            value += 2.4

        deacon["value"] = value
        # print(deacon)

    return sort_values(deacons)


def gospel(deacons):

    for deacon in deacons:

        value = 0
        value += deacon["weeksSince"] * 0.25

        if int(deacon["age"]) > 20 and int(deacon["age"]) < 40:

            value += 30

        value += (deacon["frequency"] - 5) * 0.13

        value += (deacon["experience"] - 5) * 0.3

        if deacon["rank"] == "Chanter (Epsaltos)":

            pass

        else:

            value += 5

        deacon["value"] = value
        # print(deacon)

    return sort_values(deacons)


def water(deacons):

    for deacon in deacons:

        value = 0
        value += deacon["weeksSince"] * 0.25

        if int(deacon["age"]) > 15 and int(deacon["age"]) < 40:

            value += 30

        value += (deacon["frequency"] - 6) * 0.13

        value += (deacon["experience"] - 7) * 0.23

        deacon["value"] = value
        # print(deacon)

    return sort_values(deacons)


def wine(deacons):

    for deacon in deacons:

        value = 0
        value += deacon["weeksSince"] * 0.25

        if int(deacon["age"]) > 25 and int(deacon["age"]) < 60:

            value += 30

        value += (deacon["frequency"] - 7) * 0.13

        value += (deacon["experience"] - 8.4) * 0.23

        deacon["value"] = value
        # print(deacon)

    return sort_values(deacons)


def altar(deacons):

    for deacon in deacons:

        value = 0
        value += deacon["weeksSince"] * 0.25

        if int(deacon["age"]) > 10 and int(deacon["age"]) < 25:

            value += 30

        value += (deacon["frequency"] - 4) * 0.13

        deacon["value"] = value
        # print(deacon)

    return sort_values(deacons)


def sort_deacons(deacons: List[Dict]) -> List[Dict]:
    """
    Sorts a list of deacons based on the 'weeksSince' attribute
    in descending order, with the greater number of weeks since serving first.

    Args:
        deacons (List[Dict]): A list of dictionaries where each dictionary represents
                              a deacon with attributes such as 'age', 'experience',
                              'frequency', 'name', 'rank', 'uid', and 'weeks_since_serve'.

    Returns:
        List[Dict]: A sorted list of deacons based on 'weeks_since_serve'.
    """
    if len(deacons) < 25:
        return sorted(deacons, key=lambda deacon: deacon["weeksSince"], reverse=True)
    return sorted(deacons, key=lambda deacon: deacon["weeksSince"], reverse=True)[:25]


# updates the user information to add one week to the people who had not served and restart the week count for the people who did serve
def update_weeks(schedule, deacons):
    # Create a set of uids for deacons who served
    served_uids = {deacon["uid"] for deacon in schedule}

    for deacon in deacons:
        if deacon["uid"] in served_uids:
            # Reset for those who served
            deacon["weeksSince"] = 0
        else:
            # Increment for those who did not serve
            deacon["weeksSince"] += 1


# ensures the person added to the schedule isn't on there multiple times
def add_person(schedule_list, deacon_list):
    uids = []
    for deacon in schedule_list:
        uids.append(deacon["uid"])

    added = False

    while not added:

        if deacon_list[0]["uid"] in uids:

            deacon_list = deacon_list[1:]

        else:

            schedule_list.append(deacon_list[0])
            added = True

    return schedule_list


# takes in all the deacons for a church (one at a time) sorts them based off how long it has been since they served and passes them into the other functions
def create_schedule(deacons, num_altar):

    deacons = sort_deacons(deacons)
    schedule = []

    matins_list = matins(deacons)
    third_list = third(deacons)
    sixth_list = sixth(deacons)
    pauline_list = pauline(deacons)
    catholic_list = catholic(deacons)
    praxis_list = praxis(deacons)
    gospel_list = gospel(deacons)
    water_list = water(deacons)
    wine_list = wine(deacons)
    altar_list = altar(deacons)

    # makes a list of all the lists besides altar_list
    all_lists = [
        matins_list,
        third_list,
        sixth_list,
        pauline_list,
        catholic_list,
        praxis_list,
        gospel_list,
        water_list,
        wine_list,
    ]

    # adds one person that is not already in the schedule for each roll
    for list in all_lists:
        schedule = add_person(schedule, list)

    # adds the number of altar servers minus two because blood and wine are in the altar
    for i in range(17):
        schedule = add_person(schedule, altar_list)

    schedule_dict = {
        "matins": schedule[0],
        "third": schedule[1],
        "sixth": schedule[2],
        "pauline": schedule[3],
        "catholic": schedule[4],
        "praxis": schedule[5],
        "gospel": schedule[6],
        "water": schedule[7],
        "wine": schedule[8],
        "altar": schedule[7:],
    }

    update_weeks(schedule, deacons)

    return schedule_dict


# uncomment on_request and comment on_schedule to test locally
# @https_fn.on_request()
# def my_scheduled_function(req: https_fn.Request) -> https_fn.Response:
@scheduler_fn.on_schedule(
    schedule="0 16 * * 0",  # Every Sunday at 4:00 PM
    timezone=scheduler_fn.Timezone("America/New_York"),
)
def my_scheduled_function(event: scheduler_fn.ScheduledEvent):
    firestore_client: google.cloud.firestore.Client = firestore.client()
    collection_ref = firestore_client.collection("churches")
    docs = collection_ref.stream()

    for doc in docs:
        # TODO: remove once we have enough real users
        if doc.id != "sample":
            continue
        doc_data = doc.to_dict()

        if "deacons" in doc_data:
            deacons = doc_data["deacons"]
        else:
            print("no deacons found in this church")
        # removes the current week
        if "schedule" in doc_data:
            doc_data["schedule"] = doc_data["schedule"][1:]
            while len(doc_data["schedule"]) > 5:
                create_schedule(deacons, 2)
        else:
            schedule_list = []
            for _ in range(5):
                schedule_list.append(create_schedule(deacons, 2))
            doc_data["schedule"] = schedule_list

    if schedule_list:
        start_date = datetime.datetime.now()

        response = []
        for i, s in enumerate(schedule_list):
            # Calculate the date for the current document
            doc_date = start_date + datetime.timedelta(weeks=i)
            # Convert the date to a string format
            doc_date_str = doc_date.strftime("%m-%d-%y")
            doc_name = f"{doc.id}-{doc_date_str}"
            # Push the document data into the "schedules" collection with the date as the document name
            new_doc_ref = (
                firestore_client.collection("schedules").document(doc_name).set(s)
            )
            response.append(new_doc_ref)

        # Send back a message that we've successfully written the message
        return https_fn.Response(
            f"Successfully wrote {len(schedule_list)} documents to 'schedules' collection."
        )
    else:
        # If the document does not exist, return an error message
        return https_fn.Response(
            f"Document not found in 'churches' collection.", status=404
        )
    # [END adminSdkPush]


def generate_test_data(num_people):
    ranks = ["Chanter (Epsaltos)", "Reader", "Subdeacon", "Full Deacon"]
    test_data = []

    for _ in range(num_people):
        person = {
            "age": str(random.randint(5, 60)),  # Random age between 10 and 60
            "experience": random.uniform(0, 10),  # Random experience between 0 and 10
            "frequency": random.uniform(0, 10),  # Random frequency between 0 and 10
            "name": f"Person {random.randint(1, 1000)}",  # Unique name based on random number
            "rank": random.choice(ranks),  # Randomly select a rank from the list
            "uid": str(uuid.uuid4()),  # Generate a unique user ID
            "weeksSince": random.randint(
                0, 5
            ),  # Random weeks since served between 0 and 52
        }
        test_data.append(person)

    return test_data


# Uncomment everything below to test locally
# def add_test_data_to_firestore(test_data):
#     # create churches collection
#     db.collection("churches").document("St. Philopater and St. Mina, Wayland, MA").set(
#         {"deacons": []}
#     )

#     for deacon in test_data:
#         # Add each deacon to the deacons array in the Firestore collection
#         db.collection("churches").document(
#             "St. Philopater and St. Mina, Wayland, MA"
#         ).update({"deacons": firestore.ArrayUnion([deacon])})


# test_data = generate_test_data(100)
# add_test_data_to_firestore(test_data)
def set_up_arrays():
    firestore_client: google.cloud.firestore.Client = firestore.client()
    church_ref = firestore_client.collection("churches")
    church_docs = church_ref.stream()

    for doc in church_docs:
        church_id = doc.id  # Get document ID
        church_data = doc.to_dict()  # Convert document to dictionary

        # Ensure required arrays exist
        updated_data = False  # Track if updates are needed
        if "deacons" not in church_data or not isinstance(church_data["deacons"], list):
            church_data["deacons"] = []
            updated_data = True

        if "servants" not in church_data or not isinstance(
            church_data["servants"], list
        ):
            church_data["servants"] = []
            updated_data = True

        if "schedules" not in church_data or not isinstance(
            church_data["schedules"], list
        ):
            church_data["schedules"] = []
            updated_data = True

        # If any updates were made, update the Firestore document
        if updated_data:
            church_ref.document(church_id).update(church_data)
            print(f"Updated church document: {church_id}")

    print("Validation complete.")


def remove_user_from_churches(user_id):
    # Reference the "church_data" collection
    firestore_client: google.cloud.firestore.Client = firestore.client()
    church_ref = firestore_client.collection("churches")

    # Fetch all church documents
    church_docs = church_ref.stream()

    for doc in church_docs:
        church_id = doc.id  # Get document ID
        church_data = doc.to_dict()  # Convert document to dictionary
        updated_data = False  # Track if updates are needed

        # Remove user from "deacons" if present
        if "deacons" in church_data and user_id in church_data["deacons"]:
            church_data["deacons"].remove(user_id)
            updated_data = True

        # Remove user from "servants" if present
        if "servants" in church_data and user_id in church_data["servants"]:
            church_data["servants"].remove(user_id)
            updated_data = True

        # Update Firestore only if changes were made
        if updated_data:
            church_ref.document(church_id).update(church_data)
            print(f"Updated church document: {church_id} (Removed user {user_id})")

    print("User removed from all relevant churches.")


# split this into multiple functions


@https_fn.on_request()
def update_user(req: https_fn.Request) -> https_fn.Response:
    try:
        request_data = req.get_json()
        if request_data is None:
            return https_fn.Response("Missing JSON body", status=400)
    except Exception as e:
        return https_fn.Response(f"Invalid JSON: {str(e)}", status=400)

    # Extract the user_id from the payload
    user_id = request_data.get("uid")
    if not user_id:
        return https_fn.Response("Missing 'uid' parameter", status=400)

    # Optional: Verify Firebase Auth token if provided
    id_token = req.headers.get("Authorization")
    if id_token:
        try:
            decoded_token = auth.verify_id_token(id_token.split("Bearer ")[-1])
            # You can now use decoded_token to get user details if needed
        except Exception as e:
            return https_fn.Response(f"Token verification failed: {str(e)}", status=401)

    set_up_arrays()
    firestore_client: google.cloud.firestore.Client = firestore.client()
    collection_ref = firestore_client.collection("churches")
    church_docs = collection_ref.stream()

    try:
        doc_ref = firestore_client.collection("users").document(user_id)
        doc = doc_ref.get()
        if not doc.exists:
            return https_fn.Response("User document not found", status=404)
        user_data = doc.to_dict()
    except Exception as e:
        return https_fn.Response(f"Error retrieving user data: {str(e)}", status=500)

    firestore_client: google.cloud.firestore.Client = firestore.client()
    church_ref = firestore_client.collection("churches")
    church_docs = church_ref.stream()

    for doc in church_docs:
        church_data = doc.to_dict()  # Convert document to dictionary

    # Prepare the filtered user data
    filtered_user_data = {
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

    if "children" in user_data:
        handle_children(user_data["children"])

    # Call helper functions (assumed to be defined elsewhere)
    remove_user_from_churches(filtered_user_data["uid"])
    reschedule_user(filtered_user_data["uid"])

    # Retrieve the specific church document based on the user's church ID
    church_id = filtered_user_data["church"]
    church_doc_ref = firestore_client.collection("churches").document(church_id)
    church_doc = church_doc_ref.get()
    if church_doc.exists:
        church_data = church_doc.to_dict()
    else:
        return https_fn.Response(
            f"Church document not found for church id: {church_id}", status=404
        )

    # Update deacons list if the user is a deacon
    if filtered_user_data["isDeacon"]:
        deacons = church_data.get("deacons", [])
        # Check if the user is already listed (assuming each deacon is a dict with a "uid" key)
        if not any(
            deacon.get("uid") == filtered_user_data["uid"] for deacon in deacons
        ):
            new_deacon = {
                "uid": filtered_user_data["uid"],
                "name": filtered_user_data["name"],
                "age": filtered_user_data["age"],
                "experience": filtered_user_data["experience"],
                "frequency": filtered_user_data["frequency"],
                "rank": filtered_user_data["rank"],
                "weeksSince": 4,
            }
            deacons.append(new_deacon)
            church_data["deacons"] = deacons

    # Update servants list if the user is a servant
    if filtered_user_data["isSSTeacher"]:
        servants = church_data.get("servants", [])
        if not any(
            servant.get("uid") == filtered_user_data["uid"] for servant in servants
        ):
            new_servant = {
                "uid": filtered_user_data["uid"],
                "name": filtered_user_data["name"],
            }
            servants.append(new_servant)
            church_data["servants"] = servants

    # Write the updated church_data back to Firestore
    try:
        # Using merge=True so we only update the fields that have changed
        church_doc_ref.set(church_data, merge=True)
    except Exception as e:
        return https_fn.Response(f"Error updating church data: {str(e)}", status=500)

    return 


def handle_children(children):
    for child in children:
        update_user(child["uid"])


@scheduler_fn.on_schedule(
    schedule="0 9 * * 0",  # Every Sunday at 9:00 AM
    timezone=scheduler_fn.Timezone("America/New_York"),
)
def locate_for_liturgy(event: scheduler_fn.ScheduledEvent):
    pass


def update_user_frequency(uid):
    pass


# adjust weeks since
@https_fn.on_request()
def reschedule_user(req: https_fn.Request) -> https_fn.Response:
    pass


def notify_new_servant(uid):
    pass


@scheduler_fn.on_schedule(
    schedule="30 12 * * 0",  # Every Sunday at 12:30 AM
    timezone=scheduler_fn.Timezone("America/New_York"),
)
def locate_for_servants(event: scheduler_fn.ScheduledEvent):
    pass


# Handles deleting a user and all their children
@https_fn.on_request()
def delete_user(req: https_fn.Request) -> https_fn.Response:
    pass
