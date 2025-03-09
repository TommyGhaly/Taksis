from typing import Any, List, Dict
import datetime
import random
import uuid
from firebase_functions import https_fn, scheduler_fn, firestore_fn
from firebase_admin import initialize_app, firestore, credentials, auth
import google.cloud.firestore
from google.cloud import firestore
import requests


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
def update_weeks(schedule, deacons, doc_ref):
    # Create a set of uids for deacons who served
    served_uids = []
    for deacon in schedule:
        if "uid" in deacon:
            served_uids.append(deacon["uid"])

    for deacon in deacons:
        if deacon["uid"] in served_uids:
            # Reset for those who served
            deacon["lastWeeksSince"] = deacon["weeksSince"]
            deacon["weeksSince"] = 0
        else:
            # Increment for those who did not serve
            deacon["weeksSince"] += 1
    doc_ref.update({"deacons": deacons})

# ensures the person added to the schedule isn't on there multiple times
def add_person(schedule_list, deacon_list):
    uids = []  # Collect UIDs
    for deacon in schedule_list:
        if "uid" in deacon:
            uids.append(deacon["uid"])
    added = False
    print("deacons list:", deacon_list, "\n\n\n\n")
    while not added:
        print(len(deacon_list))
        if len(deacon_list) == 0:  # Check if deacon_list is empty
            schedule_list.append("N/A")
            added = True
            break  # Exit the loop

        if deacon_list[0]["uid"] in uids:
            deacon_list = deacon_list[1:]  # Remove the first element
        else:
            schedule_list.append(deacon_list[0])
            print(deacon_list[0])
            added = True
        print("schedule list:", schedule_list, "\n\n\n")
    return schedule_list


# takes in all the deacons for a church (one at a time) sorts them based off how long it has been since they served and passes them into the other functions
def create_schedule(deacons, church_ref):

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
    print(all_lists)
    # adds one person that is not already in the schedule for each roll
    for list in all_lists:
        schedule = add_person(schedule, list)

    # adds the number of altar servers minus two because blood and wine are in the altar
    for i in range(8):
        schedule = add_person(schedule, altar_list)

    print("schedule:", schedule, "\n\n\n\n")

    schedule_dict = {
        "matins": (
            {"name": schedule[0]["name"], "uid": schedule[0]["uid"]}
            if schedule[0] != "N/A"
            else {"name": "N/A", "uid": "N/A"}
        ),
        "third": (
            {"name": schedule[1]["name"], "uid": schedule[1]["uid"]}
            if schedule[1] != "N/A"
            else {"name": "N/A", "uid": "N/A"}
        ),
        "sixth": (
            {"name": schedule[2]["name"], "uid": schedule[2]["uid"]}
            if schedule[2] != "N/A"
            else {"name": "N/A", "uid": "N/A"}
        ),
        "pauline": (
            {"name": schedule[3]["name"], "uid": schedule[3]["uid"]}
            if schedule[3] != "N/A"
            else {"name": "N/A", "uid": "N/A"}
        ),
        "catholic": (
            {"name": schedule[4]["name"], "uid": schedule[4]["uid"]}
            if schedule[4] != "N/A"
            else {"name": "N/A", "uid": "N/A"}
        ),
        "praxis": (
            {"name": schedule[5]["name"], "uid": schedule[5]["uid"]}
            if schedule[5] != "N/A"
            else {"name": "N/A", "uid": "N/A"}
        ),
        "gospel": (
            {"name": schedule[6]["name"], "uid": schedule[6]["uid"]}
            if schedule[6] != "N/A"
            else {"name": "N/A", "uid": "N/A"}
        ),
        "water": (
            {"name": schedule[7]["name"], "uid": schedule[7]["uid"]}
            if schedule[7] != "N/A"
            else {"name": "N/A", "uid": "N/A"}
        ),
        "wine": (
            {"name": schedule[8]["name"], "uid": schedule[8]["uid"]}
            if schedule[8] != "N/A"
            else {"name": "N/A", "uid": "N/A"}
        ),
        "altar": (
            [
                (
                    {"name": item["name"], "uid": item["uid"]}
                    if item != "N/A"
                    else {"name": "N/A", "uid": "N/A"}
                )
                for item in schedule[7:14]
            ]
            if len(schedule) > 7
            else [{"name": "N/A", "uid": "N/A"} for _ in range(6)]
        ),
        "extra": (
            [
                (
                    {"name": item["name"], "uid": item["uid"]}
                    if item != "N/A"
                    else {"name": "N/A", "uid": "N/A"}
                )
                for item in schedule[14:]
            ]
            if len(schedule) > 14
            else [{"name": "N/A", "uid": "N/A"} for _ in range(3)]
        ),
    }

    update_weeks(schedule, deacons, church_ref)

    return schedule_dict


def get_deacons(church):
    firestore_client = firestore.Client()
    collection_ref = firestore_client.collection("churches")
    doc_ref = collection_ref.document(church)
    doc_snapshot = doc_ref.get()  # Use .get() instead of .stream()

    if doc_snapshot.exists:  # Check if document exists
        doc_data = doc_snapshot.to_dict()  # Convert to dictionary
        return doc_data.get(
            "deacons", "No deacon array"
        )  # Use .get() to avoid KeyError
    else:
        return "Document does not exist"


# @scheduler_fn.on_schedule(
#   schedule="0 16 * * 0",  # Every Sunday at 4:00 PM
#   timezone=scheduler_fn.Timezone("America/New_York"),
# )
# def generate_schedule(event: scheduler_fn.ScheduledEvent):
# uncomment on_request and comment on_schedule to test locally
@https_fn.on_request()
def my_scheduled_function(req: https_fn.Request) -> https_fn.Response:
    firestore_client = firestore.Client()
    collection_ref = firestore_client.collection("churches")
    docs = collection_ref.stream()

    for doc in docs:

        schedule_ref = doc.reference.collection("schedule")
        schedules = list(schedule_ref.stream())

        if not schedules:
            start_date = datetime.datetime.now()

            for i in range(5):
                schedule = create_schedule(get_deacons(doc.id), doc.reference)
                doc_date = start_date + datetime.timedelta(weeks=i)
                doc_date_str = doc_date.strftime("%m-%d-%y")
                schedule_doc = schedule_ref.document(doc_date_str)
                schedule_doc.set(schedule)
        else:
            schedule = create_schedule(get_deacons(doc.id), doc.reference)
            start_date = datetime.datetime.now()
            doc_delete_str = start_date.strftime("%m-%d-%y")
            delete_doc_ref = schedule_ref.document(doc_delete_str)
            delete_doc_ref.delete()
            doc_date = start_date + datetime.timedelta(weeks=5)
            doc_date_str = doc_date.strftime("%m-%d-%y")
            schedule_doc = schedule_ref.document(doc_date_str)
            schedule_doc.set(schedule)

    return https_fn.Response(f"Successfully wrote documents to 'schedules' collection.")


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


def handle_children(children):
    for child in children:
        print(child)
        remove_user_from_churches(child.get("uid"))
        add_user_to_churches(child)
    return


def remove_user_from_churches(user_id):

    # Fetch all church documents
    firestore_client = firestore.Client()
    church_ref = firestore_client.collection("churches")
    church_docs = church_ref.stream()
    for doc in church_docs:
        church_id = doc.id  # Get document ID
        church_data = doc.to_dict()  # Convert document to dictionary
        updated_data = False  # Track if updates are needed
        filtered_deacons = []
        filtered_servants = []
        # Remove entire dictionary from "deacons" if it contains user_id
        for deacon in church_data["deacons"]:
            if deacon["uid"] == user_id:
                updated_data = True
            else:
                filtered_deacons.append(deacon)

        # Remove entire dictionary from "servants" if it contains user_id
        for servant in church_data["servants"]:
            if servant["uid"] == user_id:
                updated_data = True
            else:
                filtered_servants.append(servant)

        church_data["deacons"] = filtered_deacons
        church_data["servants"] = filtered_servants

        # Update Firestore only if changes were made
        if updated_data:
            church_ref.document(church_id).update(church_data)
            print(f"Updated church document: {church_id} (Removed user {user_id})")

    print("User removed from all relevant churches.")


def filter_data(user_data):
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


def add_user_to_churches(user_data):
    firestore_client = firestore.Client()

    user_id = user_data["uid"]

    print(user_data)

    # Handle children if present
    if "children" in user_data:
        print(user_data["children"])
        handle_children(user_data["children"])
    # Ensure user_data is properly filtered
    user_data = filter_data(user_data)

    # Call helper function (assumed to be defined elsewhere)
    reschedule_user(user_id)

    # Retrieve the specific church document based on the user's church ID
    church_id = user_data.get("church")
    if not church_id:
        return https_fn.Response("User has no associated church ID", status=400)

    church_doc_ref = firestore_client.collection("churches").document(church_id)
    church_doc = church_doc_ref.get()

    if not church_doc.exists:
        return https_fn.Response(
            f"Church document not found for church id: {church_id}", status=404
        )

    church_data = church_doc.to_dict() or {}  # Ensure church_data is a dictionary

    # Initialize lists if missing
    church_data.setdefault("deacons", [])
    church_data.setdefault("servants", [])

    # Add user to deacons list if applicable
    if user_data.get("isDeacon"):
        if not any(
            deacon.get("uid") == user_data["uid"] for deacon in church_data["deacons"]
        ):
            new_deacon = {
                "uid": user_data["uid"],
                "name": user_data["name"],
                "age": int(user_data["age"]),
                "experience": float(user_data["experience"]),
                "frequency": float(user_data["frequency"]),
                "rank": user_data["rank"],
                "weeksSince": 4,
                "lastWeeksSince": 4,
            }
            church_data["deacons"].append(new_deacon)

    # Add user to servants list if applicable
    if user_data.get("isSSTeacher"):
        if not any(
            servant.get("uid") == user_data["uid"]
            for servant in church_data["servants"]
        ):
            new_servant = {
                "uid": user_data["uid"],
                "name": user_data["name"],
            }
            church_data["servants"].append(new_servant)

    # Write the updated data back to Firestore
    try:
        church_doc_ref.set(church_data, merge=True)
    except Exception as e:
        return https_fn.Response(f"Error updating church data: {str(e)}", status=500)

    return https_fn.Response("User successfully added to the church", status=200)


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

    remove_user_from_churches(user_id)
    firestore_client = firestore.Client()

    # Retrieve the user document from Firestore
    try:
        doc_ref = firestore_client.collection("users").document(user_id)
        doc = doc_ref.get()
        if not doc.exists:
            return https_fn.Response("User document not found", status=404)
        user_data = doc.to_dict()
    except Exception as e:
        return https_fn.Response(f"Error retrieving user data: {str(e)}", status=500)
    add_user_to_churches(user_data)
    return https_fn.Response("User update completed successfully", status=200)


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


# call this function with the parameter of the uid update the children then call update user on the original user
@https_fn.on_request()
def sync_child_params(req: https_fn.Request) -> https_fn.Response:
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

    firestore_client = firestore.Client()
    user_doc_ref = firestore_client.collection("users").document(user_id)
    user_doc = user_doc_ref.get()
    updated_children = []

    if user_doc.exists:
        user_data = user_doc.to_dict()

    if "children" in user_data:
        print("children", user_data["children"])
        for child in user_data["children"]:
            child["church"] = user_data["church"]
            child["frequency"] = user_data["frequency"]
            print("child", child)
            print("child uid", child["uid"])
            updated_children.append(child)

    user_data["children"] = updated_children
    user_doc_ref.update(user_data)

    return https_fn.Response(
        "Children frequency and church synced properly", status=200
    )


@https_fn.on_request()
def delete_child(req: https_fn.Request) -> https_fn.Response:
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
    remove_user_from_churches(user_id)
    return https_fn.Response("child deleted", status=200)


@https_fn.on_request()
def delete_user(req: https_fn.Request) -> https_fn.Response:
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

    firestore_client = firestore.Client()
    user_doc_ref = firestore_client.collection("users").document(user_id)
    user_doc = user_doc_ref.get()

    if user_doc.exists:
        user_data = user_doc.to_dict()

    if "children" in user_data:
        print("children", user_data["children"])
        for child in user_data["children"]:
            remove_user_from_churches(child.get("uid"))

    remove_user_from_churches(user_id)
    return https_fn.Response("user and children deleted", status=200)

