from typing import Any, List, Dict
import random
import uuid
from firebase_functions import https_fn, scheduler_fn, firestore_fn
from firebase_admin import initialize_app, firestore, credentials, auth
import google.cloud.firestore
from google.cloud import firestore
import requests
import datetime

initialize_app()



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
def update_weeks(schedule_dict, deacons, doc_ref):
    # Create a set of uids for deacons who served
    unused_deacons = []
    served_uids = []
    for key, value in schedule_dict.items():
        if key == "altar":
            for server in schedule_dict["altar"]:
                if "uid" in server:
                    served_uids.append(server["uid"])
        if isinstance(value, dict):
            for individual_key, individual_value in value.items():
                if individual_key == "uid" and individual_value != "N/A":
                    served_uids.append(individual_value)

    for deacon in deacons:
        if deacon["uid"] in served_uids:
            # Reset for those who served
            deacon["lastWeeksSince"] = deacon["weeksSince"]
            deacon["weeksSince"] = 0
        else:
            # Increment for those who did not serve
            deacon["weeksSince"] += 1
            unused_deacons.append(deacon)
    doc_ref.update({"deacons": deacons})
    extras = []
    for deacon in unused_deacons:
        extras.append({"name": deacon["name"], "uid": deacon["uid"]})
    schedule_dict["extra"] = extras

    return schedule_dict


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
def create_schedule(deacons, church_ref, num_altar_servers):

    sorted_deacons = sort_deacons(deacons)
    schedule = []

    matins_list = matins(sorted_deacons)
    third_list = third(sorted_deacons)
    sixth_list = sixth(sorted_deacons)
    pauline_list = pauline(sorted_deacons)
    catholic_list = catholic(sorted_deacons)
    praxis_list = praxis(sorted_deacons)
    gospel_list = gospel(sorted_deacons)
    water_list = water(sorted_deacons)
    wine_list = wine(sorted_deacons)
    altar_list = altar(sorted_deacons)

    # makes a list of all the lists besides altar_list
    all_lists = [
        gospel_list,
        wine_list,
        water_list,
        praxis_list,
        catholic_list,
        pauline_list,
        sixth_list,
        third_list,
        matins_list,
    ]
    print(all_lists)
    # adds one person that is not already in the schedule for each roll
    for list in all_lists:
        schedule = add_person(schedule, list)

    # adds the number of altar servers minus two because blood and wine are in the altar
    for i in range(9):
        schedule = add_person(schedule, altar_list)

    print("schedule:", schedule, "\n\n\n\n")

    schedule_dict = {
        "gospel": (
            {"name": schedule[0]["name"], "uid": schedule[0]["uid"]}
            if schedule[0] != "N/A"
            else {"name": "N/A", "uid": "1"}
        ),
        "wine": (
            {"name": schedule[1]["name"], "uid": schedule[1]["uid"]}
            if schedule[1] != "N/A"
            else {"name": "N/A", "uid": "2"}
        ),
        "water": (
            {"name": schedule[2]["name"], "uid": schedule[2]["uid"]}
            if schedule[2] != "N/A"
            else {"name": "N/A", "uid": "3"}
        ),
        "praxis": (
            {"name": schedule[3]["name"], "uid": schedule[3]["uid"]}
            if schedule[3] != "N/A"
            else {"name": "N/A", "uid": "4"}
        ),
        "catholic": (
            {"name": schedule[4]["name"], "uid": schedule[4]["uid"]}
            if schedule[4] != "N/A"
            else {"name": "N/A", "uid": "5"}
        ),
        "pauline": (
            {"name": schedule[5]["name"], "uid": schedule[5]["uid"]}
            if schedule[5] != "N/A"
            else {"name": "N/A", "uid": "6"}
        ),
        "sixth": (
            {"name": schedule[6]["name"], "uid": schedule[6]["uid"]}
            if schedule[6] != "N/A"
            else {"name": "N/A", "uid": "7"}
        ),
        "third": (
            {"name": schedule[7]["name"], "uid": schedule[7]["uid"]}
            if schedule[7] != "N/A"
            else {"name": "N/A", "uid": "8"}
        ),
        "matins": (
            {"name": schedule[8]["name"], "uid": schedule[8]["uid"]}
            if schedule[8] != "N/A"
            else {"name": "N/A", "uid": "9"}
        ),
        "altar": (
            [
                (
                    {"name": item["name"], "uid": item["uid"]}
                    if item != "N/A"
                    else {"name": "N/A", "uid": str(random.randint(1, 100))}
                )
                for item in schedule[9 : 9 + num_altar_servers]
            ]
            if len(schedule) > 7
            else [{"name": "N/A", "uid": str(_ + 20)} for _ in range(num_altar_servers)]
        ),
    }

    schedule_dict = update_weeks(schedule_dict, deacons, church_ref)
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
        church_doc = doc.reference.get()
        church_data = church_doc.to_dict()
        num_altar_servers = int(
            church_data.get("altarServers", 0)
        )  # Ensure it's an integer, defaulting to 0
        print("altar servers: ", num_altar_servers)
        schedule_ref = doc.reference.collection("schedule")
        schedules = list(schedule_ref.stream())

        if not schedules:
            start_date = datetime.datetime.now()

            for i in range(5):
                schedule = create_schedule(
                    get_deacons(doc.id), doc.reference, num_altar_servers
                )
                doc_date = start_date + datetime.timedelta(weeks=i)
                doc_date_str = doc_date.strftime("%m-%d-%y")
                schedule_doc = schedule_ref.document(doc_date_str)
                schedule_doc.set(schedule)
        else:
            schedule = create_schedule(
                get_deacons(doc.id), doc.reference, num_altar_servers
            )
            start_date = datetime.datetime.now()
            doc_delete_str = start_date.strftime("%m-%d-%y")
            delete_doc_ref = schedule_ref.document(doc_delete_str)
            delete_doc_ref.delete()
            doc_date = start_date + datetime.timedelta(weeks=5)
            doc_date_str = doc_date.strftime("%m-%d-%y")
            schedule_doc = schedule_ref.document(doc_date_str)
            schedule_doc.set(schedule)
        set_next_week_serve(doc.id)
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

        # Remove entire dictionary from "deacons" if it contains user_id
        for deacon in church_data.get("deacons", []):
            if deacon["uid"] == user_id:
                updated_data = True
            else:
                filtered_deacons.append(deacon)

        # Query only servants with the matching uid
        servants_ref = doc.reference.collection("Servants Meeting")
        servants_docs = servants_ref.where("uid", "==", user_id).stream()
        for servant in servants_docs:
            servant.reference.delete()
            updated_data = True

        church_data["deacons"] = filtered_deacons

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
        add_user_to_extra_servers(church_id, user_data["name"], user_id)
    else:
        remove_user_from_schedules(church_id, user_data["name"], user_id)

    # Delete existing servant record, if it exists (deletion is safe even if the document doesn’t exist)
    servant_ref = (
        firestore_client.collection("churches")
        .document(church_id)
        .collection("Servants Meeting")
        .document(user_data["uid"])
    )
    servant_ref.delete()

    # Conditionally add the user back if they are an SSTeacher
    if user_data.get("isSSTeacher"):
        new_servant = {
            "uid": user_data["uid"],
            "name": user_data["name"],
        }
        servant_doc_ref = church_doc_ref.collection("Servants Meeting").document(
            new_servant["uid"]
        )
        servant_doc_ref.set(new_servant, merge=True)
        # Write the updated data back to Firestore
    try:
        church_doc_ref.set(church_data, merge=True)
    except Exception as e:
        return https_fn.Response(f"Error updating church data: {str(e)}", status=500)

    return https_fn.Response("User successfully added to the church", status=200)



def add_user_to_extra_servers(church, name, uid):
    firestore_client = firestore.Client()
    schedules_ref = firestore_client.collection("churches").document(church).collection("schedule")
    schedules_docs = schedules_ref.stream()

    # Iterate over each schedule
    for schedule in schedules_docs:
        schedule_data = schedule.to_dict()
        add_user = True  # Assume the user should be added unless found

        # Check all fields to see if the user already exists (in any field)
        for key, value in schedule_data.items():
            if isinstance(value, list):  # Check list fields (e.g., 'extra', 'altar', etc.)
                for deacon in value:
                    if isinstance(deacon, dict):
                        if deacon.get("uid") == uid:
                            add_user = False
                            break  # Stop checking if user is found

            if isinstance(value, dict):  # Check dict fields (if any)
                if value.get("uid") == uid:
                    add_user = False
                    break  # Stop checking if user is found

            if not add_user:
                break  # Stop checking other fields if user is found

        # If user not found, append the user to the 'extra' field
        if add_user:
            extras = schedule_data.get("extra", [])  # Get the existing 'extra' list, or an empty list
            extras.append({"name": name, "uid": uid})  # Add the new user
            schedule.reference.update({"extra": extras})  # Update the 'extra' field in Firestore



def remove_user_from_schedules(church, name, uid):
    pass


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


# removes
def remove_servant_from_attendance(user_id):
    firestore_client = firestore.Client()
    church_docs = firestore_client.collection("churches").stream()

    for church_doc in church_docs:
        # Process Alhan collection
        alhan_ref = church_doc.reference.collection("alhan")
        alhan_docs = alhan_ref.stream()

        for alhan_doc in alhan_docs:
            alhan_data = alhan_doc.to_dict()
            if "servants" in alhan_data:
                updated_servants = [
                    s for s in alhan_data["servants"] if s["uid"] != user_id
                ]

                if updated_servants != alhan_data["servants"]:
                    alhan_doc.reference.update({"servants": updated_servants})

        # Process Sunday School collection
        ss_ref = church_doc.reference.collection("sunday school")
        ss_docs = ss_ref.stream()

        for ss_doc in ss_docs:
            ss_data = ss_doc.to_dict()
            if "servants" in ss_data:
                updated_servants = [
                    s for s in ss_data["servants"] if s["uid"] != user_id
                ]

                if updated_servants != ss_data["servants"]:
                    ss_doc.reference.update({"servants": updated_servants})


def check_classes():
    firestore_client = firestore.Client()
    church_docs = firestore_client.collection("churches").stream()

    for church_doc in church_docs:
        # Process Alhan collection
        alhan_ref = church_doc.reference.collection("alhan")
        alhan_docs = alhan_ref.stream()

        for alhan_doc in alhan_docs:
            alhan_data = alhan_doc.to_dict()
            if "servants" not in alhan_data or len(alhan_data["servants"]) == 0:
                alhan_doc.reference.delete()

        # Process Sunday School collection
        ss_ref = church_doc.reference.collection("sunday school")
        ss_docs = ss_ref.stream()

        for ss_doc in ss_docs:
            ss_data = ss_doc.to_dict()
            if "servants" not in ss_data or len(ss_data["servants"]) == 0:
                ss_doc.reference.delete()


@https_fn.on_request()
def set_up_attendance(req: https_fn.Request) -> https_fn.Response:
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
        except Exception as e:
            return https_fn.Response(f"Token verification failed: {str(e)}", status=401)

    firestore_client = firestore.Client()
    user_doc_ref = firestore_client.collection("users").document(user_id)
    user_doc = user_doc_ref.get()

    if not user_doc.exists:
        return https_fn.Response("User not found", status=404)

    user_data = user_doc.to_dict()

    # Remove user from attendance
    remove_servant_from_attendance(user_data["uid"])

    church_doc_ref = firestore_client.collection("churches").document(
        user_data["church"]
    )

    # Check and update Alhan setup
    if user_data.get("alhanSetUp"):
        alhan_ref = church_doc_ref.collection("alhan")
        existing_alhan_classes = {
            doc.id for doc in alhan_ref.stream()
        }  # Get existing classes

        for grade in user_data.get("alhanGrades", []):
            if grade not in existing_alhan_classes:
                alhan_ref.document(grade).set({"students": [user_id]})
            else:
                alhan_ref.document(grade).update(
                    {"students": firestore.ArrayUnion([user_id])}
                )

    # Check and update Sunday School setup
    if user_data.get("ssSetUp"):
        ss_ref = church_doc_ref.collection("sunday school")
        existing_ss_classes = {
            doc.id for doc in ss_ref.stream()
        }  # Get existing classes

        for grade in user_data.get("ssGrades", []):
            if grade not in existing_ss_classes:
                ss_ref.document(grade).set({"students": [user_id]})
            else:
                ss_ref.document(grade).update(
                    {"students": firestore.ArrayUnion([user_id])}
                )
    check_classes()
    return https_fn.Response("Attendance setup completed successfully", status=200)


def find_server(schedule_data, target_uid):
    """Search schedule_data for a server with the given uid.
    Returns a tuple (location, server) where location is a tuple like (key, i) for list items or (key,) for dict items.
    Returns (None, None) if not found.
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


@https_fn.on_request()
def switch_server(req: https_fn.Request) -> https_fn.Response:
    try:
        request_data = req.get_json()
        if not request_data:
            return https_fn.Response("Missing JSON body", status=400)
    except Exception as e:
        return https_fn.Response(f"Invalid JSON: {str(e)}", status=400)

    # Extract required parameters
    church_id = request_data.get("church")
    week_id = request_data.get("week")
    first_server_uid = request_data.get("firstServer")
    second_server_uid = request_data.get("secondServer")

    if not all([church_id, week_id, first_server_uid, second_server_uid]):
        return https_fn.Response("Missing required parameters", status=400)

    # Optional: Verify Firebase Auth token
    id_token = req.headers.get("Authorization")
    if id_token:
        try:
            decoded_token = auth.verify_id_token(id_token.split("Bearer ")[-1])
        except Exception as e:
            return https_fn.Response(f"Token verification failed: {str(e)}", status=401)

    try:
        # Reference to the week's schedule
        firestore_client = firestore.Client()
        schedule_ref = (
            firestore_client.collection("churches")
            .document(church_id)
            .collection("schedules")
            .document(week_id)
        )
        schedule_doc = schedule_ref.get()

        if not schedule_doc.exists:
            return https_fn.Response("Schedule not found", status=404)

        schedule_data = schedule_doc.to_dict()

        # Locate the two servers
        first_location, first_server = find_server(schedule_data, first_server_uid)
        second_location, second_server = find_server(schedule_data, second_server_uid)

        if not first_location or not second_location:
            return https_fn.Response("One or both servers not found", status=404)

        # Swap the server objects in schedule_data
        # For a location stored as (key, i) or (key,), use the first element for dict access.
        if len(first_location) == 2:
            schedule_data[first_location[0]][first_location[1]] = second_server
        else:
            schedule_data[first_location[0]] = second_server

        if len(second_location) == 2:
            schedule_data[second_location[0]][second_location[1]] = first_server
        else:
            schedule_data[second_location[0]] = first_server

        schedule_ref.update(schedule_data)
            
        return https_fn.Response("Servers swapped successfully", status=200)

    except Exception as e:
        return https_fn.Response(f"Error: {str(e)}", status=500)


@https_fn.on_request()
def remove_server(req: https_fn.Request) -> https_fn.Response:
    try:
        request_data = req.get_json()
        if not request_data:
            return https_fn.Response("Missing JSON body", status=400)
    except Exception as e:
        return https_fn.Response(f"Invalid JSON: {str(e)}", status=400)

    # Extract required parameters
    church_id = request_data.get("church")
    week_id = request_data.get("week")
    server_uid = request_data.get("server")

    if not all([church_id, week_id, server_uid]):
        return https_fn.Response("Missing required parameters", status=400)

    # Optional: Verify Firebase Auth token
    id_token = req.headers.get("Authorization")
    if id_token:
        try:
            decoded_token = auth.verify_id_token(id_token.split("Bearer ")[-1])
        except Exception as e:
            return https_fn.Response(f"Token verification failed: {str(e)}", status=401)

    # Firestore setup
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
    print(altar_servers)
    updated_altar_servers = [s for s in altar_servers if s["uid"] != server_uid]
    print(updated_altar_servers)
    removed_servers = [s for s in altar_servers if s["uid"] == server_uid]

    if not removed_servers:
        return https_fn.Response("Server not found in 'altar' list", status=404)

    # Insert the server at the first index of the extra list
    extra_servers.insert(0, removed_servers[0])

    # Update Firestore
    schedule_ref.update({"altar": updated_altar_servers, "extra": extra_servers})
    update_future_schedules(church_id)
    set_next_week_serve(church_id)
    return https_fn.Response("User removed from altar and moved to extra", status=200)


@https_fn.on_request()
def add_server(req: https_fn.Request) -> https_fn.Response:
    try:
        request_data = req.get_json()
        if not request_data:
            return https_fn.Response("Missing JSON body", status=400)
    except Exception as e:
        return https_fn.Response(f"Invalid JSON: {str(e)}", status=400)

    # Extract required parameters
    church_id = request_data.get("church")
    week_id = request_data.get("week")

    if not all([church_id, week_id]):
        return https_fn.Response("Missing required parameters", status=400)

    # Optional: Verify Firebase Auth token
    id_token = req.headers.get("Authorization")
    if id_token:
        try:
            decoded_token = auth.verify_id_token(id_token.split("Bearer ")[-1])
        except Exception as e:
            return https_fn.Response(f"Token verification failed: {str(e)}", status=401)

    # Firestore setup
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

    print("Before update:")
    print("Altar Servers:", altar_servers)
    print("Extra Servers:", extra_servers)

    # Ensure extra_servers is not empty before accessing index 0
    if extra_servers:
        altar_servers.append(extra_servers[0])  # Move first extra server to altar
        updated_extra_servers = extra_servers[
            1:
        ]  # Remove first element from extra list

        # Update Firestore
        schedule_ref.update({"altar": altar_servers, "extra": updated_extra_servers})

        print("After update:")
        print("Altar Servers:", altar_servers)
        print("Extra Servers:", updated_extra_servers)
        update_future_schedules(church_id)
        set_next_week_serve(church_id)

        return https_fn.Response("User moved from extra to altar", status=200)
    else:
        return https_fn.Response("No extra servers available to move", status=400)


def update_future_schedules(church):
    firestore_client = firestore.Client()
    church_ref = firestore_client.collection("churches").document(church)
    church_doc = church_ref.get()

    # Check if the church document exists
    if not church_doc.exists:
        print(f"Church document for {church} does not exist.")
        return

    church_data = church_doc.to_dict()
    num_altar_servers = int(
        church_data.get("altarServers", 0)
    )  # Ensure it's an integer, defaulting to 0

    schedule_ref = (
        firestore_client.collection("churches").document(church).collection("schedule")
    )

    docs = schedule_ref.stream()
    for doc in docs:
        schedule_data = doc.to_dict()
        # Ensure default values if keys are missing
        altar_list = schedule_data.get("altar", [])
        extra_list = schedule_data.get("extra", [])

        servers = []
        for server in altar_list:
            servers.append(server)
        for extra in extra_list:
            servers.append(extra)

        updated_altar_servers = servers[: num_altar_servers + 1]
        updated_extra_servers = servers[num_altar_servers + 1 :]

        doc.reference.update(
            {"altar": updated_altar_servers, "extra": updated_extra_servers}
        )

    return


@https_fn.on_request()
def unavailable_for_week():
    pass


def reset_next_dates():
    firestore_client = firestore.Client()
    users_ref = firestore_client.collection("users")
    users_docs = users_ref.stream()
    for user in users_docs:
        user.reference.update({"nextWeekServe": "N/A"})
    return


def set_user_next_week(user_id, week):
    firestore_client = firestore.Client()
    user_ref = firestore_client.collection("users").document(user_id)
    user_data = user_ref.get()

    if user_data.exists:
        user_info = user_data.to_dict()
        next_week_serve = user_info.get("nextWeekServe")  # May be None

        if next_week_serve == "N/A":
            user_ref.update({"nextWeekServe": week})

        try:
            new_date = datetime.datetime.strptime(
                week, "%m-%d-%y"
            )  # Convert input date

            if next_week_serve:
                existing_date = datetime.datetime.strptime(next_week_serve, "%m-%d-%y")

                # Update only if the new date is earlier
                if new_date < existing_date:
                    user_ref.update({"nextWeekServe": week})
            else:
                # If nextWeekServe doesn't exist, set it
                user_ref.update({"nextWeekServe": week})
        except ValueError:
            print(f"Invalid date format: {week}")
    else:
        print(f"User {user_id} not found.")


def set_next_week_serve(church_id):
    reset_next_dates()

    firestore_client = firestore.Client()
    schedules_ref = (
        firestore_client.collection("churches")
        .document(church_id)
        .collection("schedule")
    )
    schedules = schedules_ref.stream()

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
                            print(f"{individual_value} individual value")
                            set_user_next_week(individual_value, str(schedule_id))

            if isinstance(value, dict):
                for individual_key, individual_value in value.items():
                    if individual_key == "uid" and individual_value != "N/A":
                        print(f"{individual_value} individual value")
                        set_user_next_week(individual_value, str(schedule_id))

    return
