from typing import Any, List, Dict
import random
import uuid
import asyncio
import math
from firebase_functions import https_fn, scheduler_fn, firestore_fn
from firebase_admin import initialize_app, firestore, credentials, auth
import google.cloud.firestore
from google.cloud import firestore
import requests
import datetime
from flask import Request

initialize_app()


# takes in the 30 deacons and scores them based off best fit


# add like 5 extra deacons to the list for bakcups
def sort_values(deacons: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    return sorted(deacons, key=lambda deacon: deacon["value"], reverse=True)


def matins(deacons):

    for deacon in deacons:
        value = 0
        value += deacon["weeksSince"] * 4

        if int(deacon["age"]) > 14 and int(deacon["age"]) < 22:
            value += 30

        value += (deacon["frequency"] - 3) * 0.4
        value += (deacon["experience"] - 4) * 0.12

        deacon["value"] = value
    return sort_values(deacons)


def third(deacons):

    for deacon in deacons:
        value = 0
        value += deacon["weeksSince"] * 4

        if int(deacon["age"]) > 8 and int(deacon["age"]) < 18:
            value += 30

        value += (deacon["frequency"] - 3) * 0.4

        if deacon["rank"] == "Chanter (Epsaltos)":
            value += 12

        deacon["value"] = value
    return sort_values(deacons)


def sixth(deacons):

    for deacon in deacons:
        value = 0
        value += deacon["weeksSince"] * 4

        if int(deacon["age"]) > 8 and int(deacon["age"]) < 18:
            value += 30

        value += (deacon["frequency"] - 3) * 0.4

        if deacon["rank"] == "Chanter (Epsaltos)":
            value += 12

        deacon["value"] = value
    return sort_values(deacons)


def pauline(deacons):

    for deacon in deacons:

        value = 0
        value += deacon["weeksSince"] * 4

        if int(deacon["age"]) > 16 and int(deacon["age"]) < 35:

            value += 30

        value += (deacon["frequency"] - 3) * 0.4

        if deacon["rank"] == "Chanter (Epsaltos)":

            pass

        else:

            value += 2.4

        deacon["value"] = value
    return sort_values(deacons)


def catholic(deacons):

    for deacon in deacons:

        value = 0
        value += deacon["weeksSince"] * 4

        if int(deacon["age"]) > 16 and int(deacon["age"]) < 35:

            value += 30

        value += (deacon["frequency"] - 3) * 0.4

        if deacon["rank"] == "Chanter (Epsaltos)":

            pass

        else:

            value += 2.4

        deacon["value"] = value
    return sort_values(deacons)


def praxis(deacons):
    for deacon in deacons:

        value = 0
        value += deacon["weeksSince"] * 4

        if int(deacon["age"]) > 16 and int(deacon["age"]) < 35:

            value += 30

        value += (deacon["frequency"] - 3) * 0.4

        if deacon["rank"] == "Chanter (Epsaltos)":

            pass

        else:

            value += 2.4

        deacon["value"] = value
    return sort_values(deacons)


def gospel(deacons):

    for deacon in deacons:

        value = 0
        value += deacon["weeksSince"] * 4

        if int(deacon["age"]) > 20 and int(deacon["age"]) < 40:

            value += 30

        value += (deacon["frequency"] - 5) * 0.4

        value += (deacon["experience"] - 5) * 0.3

        if deacon["rank"] == "Chanter (Epsaltos)":

            pass

        else:

            value += 5

        deacon["value"] = value
    return sort_values(deacons)


def water(deacons):

    for deacon in deacons:

        value = 0
        value += deacon["weeksSince"] * 4

        if int(deacon["age"]) > 15 and int(deacon["age"]) < 40:

            value += 30

        value += (deacon["frequency"] - 6) * 0.4

        value += (deacon["experience"] - 7) * 0.23

        deacon["value"] = value
    return sort_values(deacons)


def wine(deacons):

    for deacon in deacons:

        value = 0
        value += deacon["weeksSince"] * 4

        if int(deacon["age"]) > 25 and int(deacon["age"]) < 60:

            value += 30

        value += (deacon["frequency"] - 7) * 0.4

        value += (deacon["experience"] - 8.4) * 0.23

        deacon["value"] = value
    return sort_values(deacons)


def altar(deacons):

    for deacon in deacons:

        value = 0
        value += deacon["weeksSince"] * 4

        if int(deacon["age"]) > 10 and int(deacon["age"]) < 25:

            value += 30

        value += (deacon["frequency"] - 4) * 0.4

        deacon["value"] = value
    return sort_values(deacons)


def sort_deacons(deacons: List[Dict]) -> List[Dict]:
    if len(deacons) < 25:
        return sorted(deacons, key=lambda deacon: deacon["weeksSince"], reverse=True)
    return sorted(deacons, key=lambda deacon: deacon["weeksSince"], reverse=True)[:25]


async def update_weeks(schedule_dict, deacons, doc_ref):
    # Create a list for deacons who did not serve
    unused_deacons = []
    served_uids = []

    # Build a list of served uids
    for key, value in schedule_dict.items():
        if key == "altar":
            for server in schedule_dict["altar"]:
                if "uid" in server:
                    served_uids.append(server["uid"])
        if isinstance(value, dict):
            for individual_key, individual_value in value.items():
                if individual_key == "uid" and individual_value != "N/A":
                    served_uids.append(individual_value)

    # Update deacons information based on served status
    for deacon in deacons:
        if deacon["uid"] in served_uids:
            # Reset for those who served
            deacon["lastWeeksSince"] = deacon["weeksSince"]
            deacon["weeksSince"] = 0
        else:
            # Increment for those who did not serve
            deacon["weeksSince"] += 1
            unused_deacons.append(deacon)

    # Wrap the Firestore update in asyncio.to_thread to run it asynchronously
    await asyncio.to_thread(doc_ref.update, {"deacons": deacons})

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
    while not added:
        if len(deacon_list) == 0:  # Check if deacon_list is empty
            schedule_list.append("N/A")
            added = True
            break  # Exit the loop

        if deacon_list[0]["uid"] in uids:
            deacon_list = deacon_list[1:]  # Remove the first element
        else:
            schedule_list.append(deacon_list[0])
            added = True
    return schedule_list


# takes in all the deacons for a church (one at a time) sorts them based off how long it has been since they served and passes them into the other functions
async def create_schedule(deacons, church_ref, num_altar_servers):

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
    # adds one person that is not already in the schedule for each roll
    for list in all_lists:
        schedule = add_person(schedule, list)

    # adds the number of altar servers minus two because blood and wine are in the altar
    for i in range(9):
        schedule = add_person(schedule, altar_list)

    schedule_dict = {
        "gospel": (
            {"name": schedule[0]["name"], "uid": schedule[0]["uid"]}
            if schedule[0] != "N/A"
            else {"name": "N/A", "uid": str(uuid.uuid4())}
        ),
        "wine": (
            {"name": schedule[1]["name"], "uid": schedule[1]["uid"]}
            if schedule[1] != "N/A"
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

    schedule_dict = await update_weeks(schedule_dict, deacons, church_ref)
    return schedule_dict


async def get_deacons(church):
    firestore_client = firestore.Client()
    collection_ref = firestore_client.collection("churches")
    doc_ref = collection_ref.document(church)

    # Wrap the synchronous get() call in asyncio.to_thread
    doc_snapshot = await asyncio.to_thread(doc_ref.get)

    if doc_snapshot.exists:
        doc_data = doc_snapshot.to_dict()
        return doc_data.get("deacons", [])
    else:
        return "Document does not exist"


@scheduler_fn.on_schedule(
    schedule="0 16 * * 0",  # Every Sunday at 4:00 PM
    timezone=scheduler_fn.Timezone("America/New_York"),
)
def generate_schedule(event: scheduler_fn.ScheduledEvent):
    return asyncio.run(my_async_scheduled_function(event))


async def my_async_scheduled_function(event: scheduler_fn.ScheduledEvent):
    firestore_client = firestore.Client()
    collection_ref = firestore_client.collection("churches")
    docs = list(collection_ref.stream())  # using synchronous stream for now

    for doc in docs:
        church_doc = doc.reference.get()
        church_data = church_doc.to_dict()
        num_altar_servers = int(church_data.get("altarServers", 0))
        schedule_ref = doc.reference.collection("schedule")
        schedules = list(schedule_ref.stream())

        start_date = datetime.datetime.now()

        if not schedules:
            for i in range(1,6):
                deacons = await get_deacons(doc.id)
                schedule = await create_schedule(
                    deacons, doc.reference, num_altar_servers
                )
                doc_date = start_date + datetime.timedelta(weeks=i)
                doc_date_str = doc_date.strftime("%m-%d-%y")
                schedule_doc = schedule_ref.document(doc_date_str)
                schedule_doc.set(schedule)
        else:
            deacons = await get_deacons(doc.id)
            schedule = await create_schedule(deacons, doc.reference, num_altar_servers)
            # Delete the oldest schedule
            doc_delete_str = start_date.strftime("%m-%d-%y")
            delete_doc_ref = schedule_ref.document(doc_delete_str)
            delete_doc_ref.delete()
            # Add a new schedule for the future
            doc_date = start_date + datetime.timedelta(weeks=6)
            doc_date_str = doc_date.strftime("%m-%d-%y")
            schedule_doc = schedule_ref.document(doc_date_str)
            schedule_doc.set(schedule)

        set_next_week_serve(doc.id)

    return https_fn.Response("Successfully wrote documents to 'schedules' collection.")


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


def next_week_all_servants():
    firestore_client = firestore.Client()
    church_docs = firestore_client.collection("churches").stream()
    for church_doc in church_docs:
        church_id = church_doc.id
        set_next_week_serve(church_id)


def handle_children(children):
    for child in children:
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

    # Handle children if present
    if "children" in user_data:
        handle_children(user_data["children"])
    # Ensure user_data is properly filtered
    user_data = filter_data(user_data)

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
        remove_user_from_schedules(church_id, user_id, "N/A", "N/A", False)

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
    schedules_ref = (
        firestore_client.collection("churches").document(church).collection("schedule")
    )
    schedules_docs = schedules_ref.stream()

    # Iterate over each schedule
    for schedule in schedules_docs:
        schedule_data = schedule.to_dict()
        add_user = True  # Assume the user should be added unless found

        # Check all fields to see if the user already exists (in any field)
        for key, value in schedule_data.items():
            if isinstance(
                value, list
            ):  # Check list fields (e.g., 'extra', 'altar', etc.)
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
            extras = schedule_data.get(
                "extra", []
            )  # Get the existing 'extra' list, or an empty list
            extras.append({"name": name, "uid": uid})  # Add the new user
            schedule.reference.update(
                {"extra": extras}
            )  # Update the 'extra' field in Firestore


def get_weeks(church):
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
    firestore_client = firestore.Client()
    church_ref = firestore_client.collection("churches").document(church)
    user_ref = firestore_client.collection("users").document(uid)
    if user_ref.get().exists:
        user_data = user_ref.get().to_dict()

        if family:
            user_data["isServant"] = False
            user_ref.update(user_data)

    # Remove user from all schedules
    for week in get_weeks(church):
        mock_request = Request.from_values(
            headers={"Authorization": ""},
            json={"church": church, "week": week, "uid": uid, "family": family},
        )
        unavailable_for_week(mock_request)

    # Remove user from Alhan Class
    if not alhan_class == "N/A":
        alhan_class_doc = church_ref.collection("Hymns Class").document(alhan_class)
        alhan_class_data = alhan_class_doc.get().to_dict()
        servants = alhan_class_data.get("servants", [])
        updated_servants = [
            servant for servant in servants if servant.get("uid") != uid
        ]
        alhan_class_doc.update({"servants": updated_servants})
        user_data["alhanSetUp"] = False
        user_data["alhanGrades"] = None
        user_ref.update(user_data)

    # Remove user from Sunday School Class
    if not sunday_school_class == "N/A":
        sunday_school_class_doc = church_ref.collection("Sunday School").document(
            sunday_school_class
        )
        sunday_school_class_data = sunday_school_class_doc.get().to_dict()
        servants = sunday_school_class_data.get("servants", [])
        updated_servants = [
            servant for servant in servants if servant.get("uid") != uid
        ]
        sunday_school_class_doc.update({"servants": updated_servants})
        user_data["ssSetUp"] = False
        user_data["ssGrades"] = None
        user_ref.update(user_data)

    # Simulate an internal request to call check_classes
    mock_request = Request.from_values(headers={"Authorization": ""})

    check_classes(mock_request)
    return


def update_names(user_id, name, church):
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
    update_names(user_id, user_data["name"], user_data["church"])

    return https_fn.Response("User update completed successfully", status=200)


@https_fn.on_request()
def update_user_frequency(req: https_fn.Request) -> https_fn.Response:
    id_token = req.headers.get("Authorization")
    if id_token:
        try:
            decoded_token = auth.verify_id_token(id_token.split("Bearer ")[-1])
            # You can now use decoded_token to get user details if needed
        except Exception as e:
            return https_fn.Response(f"Token verification failed: {str(e)}", status=401)
    firestore_client = firestore.Client()
    users_docs = firestore_client.collection("users").stream()
    for user in users_docs:
        user_data = user.reference.get().to_dict()
        church_ref = firestore_client.collection("churches").document(
            user_data["church"]
        )
        church_data = church_ref.get().to_dict()
        frequency = user_data["frequency"]
        church_location = church_data["location"]
        user_location = user_data["location"]
        if not user_location:
            return https_fn.Response(f"No location found for user", status=500)
        if at_church(user_location, church_location):
            frequency *= 1.1
            if frequency > 10:
                frequency = 10
        else:
            frequency *= 0.9
            if frequency < 0.1:
                frequency = 0.5

        user_data["frequency"] = frequency
        user.reference.update(user_data)
        mock_request = Request.from_values(
            headers={"Authorization": ""},
            json={"uid": user_data["uid"]},
        )
        sync_child_params(mock_request)
        update_user(mock_request)
    return https_fn.Response(
         f"Successfully updated user' frequency and synced with chidlren", status=200
    )


def at_church(user_location, church_location):
    return (haversine_formula(user_location, church_location)) < 6000


def haversine_formula(user, church):
    user_lat = math.radians(user["latitude"])
    user_long = math.radians(user["longitude"])
    church_lat = math.radians(church[0])
    church_long = math.radians(church[1])
    lat_dif = user_lat - church_lat
    long_dif = user_long - church_long

    # Haversine formula components
    a = (
        math.sin(lat_dif / 2) ** 2
        + math.cos(church_lat) * math.cos(user_lat) * math.sin(long_dif / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    # Earth radius in feet (approximately 20,902,260 feet)
    R_feet = 20902260
    distance_feet = R_feet * c
    return distance_feet


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
        for child in user_data["children"]:
            child["church"] = user_data["church"]
            child["frequency"] = user_data["frequency"]
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
    church_id = request_data.get("church")
    if not user_id or not church_id:
        return https_fn.Response("Missing 'uid' or 'church' parameter", status=400)

    # Optional: Verify Firebase Auth token if provided
    id_token = req.headers.get("Authorization")
    if id_token:
        try:
            decoded_token = auth.verify_id_token(id_token.split("Bearer ")[-1])
            # You can now use decoded_token to get user details if needed
        except Exception as e:
            return https_fn.Response(f"Token verification failed: {str(e)}", status=401)
    remove_user_from_churches(user_id)
    for week in get_weeks(church_id):
        mock_request = Request.from_values(
            headers={"Authorization": ""},
            json={"church": church_id, "week": week, "uid": user_id, "family": False},
        )
        unavailable_for_week(mock_request)

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
            for child in user_data["children"]:
                remove_user_from_churches(child.get("uid"))
        remove_user_from_churches(user_id)
    return https_fn.Response("user and children deleted", status=200)


@https_fn.on_request()
def check_classes(req: https_fn.Request) -> https_fn.Response:
    # Verify Firebase Auth token if provided
    id_token = req.headers.get("Authorization")
    if id_token:
        try:
            decoded_token = auth.verify_id_token(id_token.split("Bearer ")[-1])
        except Exception as e:
            return https_fn.Response(f"Token verification failed: {str(e)}", status=401)

    firestore_client = firestore.Client()
    church_docs = firestore_client.collection("churches").stream()

    for church_doc in church_docs:
        delete_empty_classes(church_doc.reference, "Hymns Class")
        delete_empty_classes(church_doc.reference, "Sunday School")

    return https_fn.Response("Cleanup completed successfully", status=200)


def delete_empty_classes(church_ref, collection_name):
    """Deletes documents from the specified collection if they have no servants."""
    collection_ref = church_ref.collection(collection_name)
    docs = collection_ref.stream()

    for doc in docs:
        data = doc.to_dict()
        if not data.get("servants"):  # Checks if "servants" key is missing or empty
            doc.reference.delete()


def find_server(schedule_data, target_uid):

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
            .collection("schedule")
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
            schedule_data[str(first_location[0])][
                int(first_location[1])
            ] = second_server

        else:
            schedule_data[str(first_location[0])] = second_server

        if len(second_location) == 2:
            schedule_data[str(second_location[0])][
                int(second_location[1])
            ] = first_server
        else:
            schedule_data[str(second_location[0])] = first_server

        schedule_ref.update(schedule_data)
        set_next_week_serve(church_id)
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
    updated_altar_servers = [s for s in altar_servers if s["uid"] != server_uid]
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

    # Ensure extra_servers is not empty before accessing index 0
    if extra_servers:
        altar_servers.append(extra_servers[0])  # Move first extra server to altar
        updated_extra_servers = extra_servers[
            1:
        ]  # Remove first element from extra list

        # Update Firestore
        schedule_ref.update({"altar": altar_servers, "extra": updated_extra_servers})

        update_future_schedules(church_id)
        set_next_week_serve(church_id)

        return https_fn.Response("User moved from extra to altar", status=200)
    else:
        altar_servers.append({"name": "N/A", "uid": str(uuid.uuid4())})
        schedule_ref.update({"altar": altar_servers})
        update_future_schedules(church_id)
        return https_fn.Response("No extra servers available to move", status=400)


def update_future_schedules(church):
    firestore_client = firestore.Client()
    church_ref = firestore_client.collection("churches").document(church)
    church_doc = church_ref.get()

    # Check if the church document exists
    if not church_doc.exists:
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

        updated_altar_servers = servers[:num_altar_servers]
        updated_extra_servers = servers[num_altar_servers:]

        doc.reference.update(
            {"altar": updated_altar_servers, "extra": updated_extra_servers}
        )

    return


def create_extra_deacons(church_id, extra_deacons):
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


@https_fn.on_request()
def unavailable_for_week(req: https_fn.Request) -> https_fn.Response:
    try:
        request_data = req.get_json()
        if not request_data:
            return https_fn.Response("Missing JSON body", status=400)
    except Exception as e:
        return https_fn.Response(f"Invalid JSON: {str(e)}", status=400)

    # Extract required parameters
    church_id = request_data.get("church")
    week_id = request_data.get("week")
    user_id = request_data.get("uid")
    family = request_data.get("family")

    if not all([church_id, week_id, user_id]):
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
    user_ref = firestore_client.collection("users").document(user_id)
    user_doc = user_ref.get()
    all_uids = [user_id]
    if user_doc.exists:
        user_data = user_doc.to_dict()
        if "children" in user_data and family:
            for child in user_data["children"]:
                all_uids.append(child["uid"])
        update_attendance(user_ref)
    schedule_ref = (
        firestore_client.collection("churches")
        .document(church_id)
        .collection("schedule")
        .document(week_id)
    )
    schedule_doc = schedule_ref.get()

    schedule_data = schedule_doc.to_dict()
    for user_id in all_uids:
        key, _ = find_server(schedule_data, user_id)
        if len(key) == 1:
            key = str(key[0])
        else:
            key = (str(key[0]), key[1])

        new_deacon = []
        extra_deacons = create_extra_deacons(church_id, schedule_data["extra"])
        if len(extra_deacons) == 0:
            if isinstance(key, tuple) and len(key) > 1:
                schedule_data[key[0]][key[1]] = {
                    "name": "N/A",
                    "uid": str(uuid.uuid4()),
                }
            else:
                schedule_data[key] = {"name": "N/A", "uid": str(uuid.uuid4())}

            schedule_ref.update(schedule_data)
            continue

        if not isinstance(key, tuple):
            if key == "matins":
                new_deacon = matins(extra_deacons)[0]
                new_deacon = {
                    "name": new_deacon["name"],
                    "uid": new_deacon["uid"],
                }
                new_key, _ = find_server(schedule_data, new_deacon["uid"])
                schedule_data["matins"] = new_deacon
                del schedule_data["extra"][new_key[1]]

            elif key == "third":
                new_deacon = third(extra_deacons)[0]
                new_deacon = {
                    "name": new_deacon["name"],
                    "uid": new_deacon["uid"],
                }
                new_key, _ = find_server(schedule_data, new_deacon["uid"])
                schedule_data["third"] = new_deacon
                del schedule_data["extra"][new_key[1]]

            elif key == "sixth":
                new_deacon = sixth(extra_deacons)[0]
                new_deacon = {
                    "name": new_deacon["name"],
                    "uid": new_deacon["uid"],
                }
                new_key, _ = find_server(schedule_data, new_deacon["uid"])
                schedule_data["sixth"] = new_deacon
                del schedule_data["extra"][new_key[1]]

            elif key == "pauline":
                new_deacon = pauline(extra_deacons)[0]
                new_deacon = {
                    "name": new_deacon["name"],
                    "uid": new_deacon["uid"],
                }
                new_key, _ = find_server(schedule_data, new_deacon["uid"])
                schedule_data["pauline"] = new_deacon
                del schedule_data["extra"][new_key[1]]

            elif key == "catholic":
                new_deacon = catholic(extra_deacons)[0]
                new_deacon = {
                    "name": new_deacon["name"],
                    "uid": new_deacon["uid"],
                }
                new_key, _ = find_server(schedule_data, new_deacon["uid"])
                schedule_data["catholic"] = new_deacon
                del schedule_data["extra"][new_key[1]]

            elif key == "praxis":
                new_deacon = praxis(extra_deacons)[0]
                new_deacon = {
                    "name": new_deacon["name"],
                    "uid": new_deacon["uid"],
                }
                new_key, _ = find_server(schedule_data, new_deacon["uid"])
                schedule_data["praxis"] = new_deacon
                del schedule_data["extra"][new_key[1]]

            elif key == "gospel":
                new_deacon = gospel(extra_deacons)[0]
                new_deacon = {
                    "name": new_deacon["name"],
                    "uid": new_deacon["uid"],
                }
                new_key, _ = find_server(schedule_data, new_deacon["uid"])
                schedule_data["gospel"] = new_deacon
                del schedule_data["extra"][new_key[1]]
            elif key == "water":
                new_deacon = water(extra_deacons)[0]
                new_deacon = {
                    "name": new_deacon["name"],
                    "uid": new_deacon["uid"],
                }
                new_key, _ = find_server(schedule_data, new_deacon["uid"])
                schedule_data["water"] = new_deacon
                del schedule_data["extra"][new_key[1]]
            elif key == "wine":
                new_deacon = wine(extra_deacons)[0]
                new_deacon = {
                    "name": new_deacon["name"],
                    "uid": new_deacon["uid"],
                }
                new_key, _ = find_server(schedule_data, new_deacon["uid"])
                schedule_data["wine"] = new_deacon
                del schedule_data["extra"][new_key[1]]
        else:
            if key[0] == "altar":
                new_deacon = altar(extra_deacons)[0]
                new_deacon = {
                    "name": new_deacon["name"],
                    "uid": new_deacon["uid"],
                }
                new_key, _ = find_server(schedule_data, new_deacon["uid"])
                schedule_data["altar"][key[1]] = new_deacon
                del schedule_data["extra"][new_key[1]]

            elif key[0] == "extra":
                del schedule_data["extra"][key[1]]

    schedule_ref.update(schedule_data)
    set_next_week_serve(church_id)
    if not schedule_doc.exists:
        return https_fn.Response("Schedule not found", status=404)
    return https_fn.Response("User moved from extra to altar", status=200)


def update_attendance(user_ref):
    user_doc = user_ref.get()
    user_data = user_doc.to_dict()
    if "frequency" in user_data:
        user_data["frequency"] *= 0.8
        if user_data["frequency"] < 0.1:
            user_data["frequency"] = 0.5
    user_ref.update(user_data)
    sync_child_params(user_data["uid"])
    return


def reset_next_dates(church_id):
    firestore_client = firestore.Client()
    users_ref = firestore_client.collection("users")
    users_docs = users_ref.stream()
    for user in users_docs:
        user_data = user.to_dict()
        if user_data.get("church") == church_id:
            user.reference.update({"nextWeekServe": "N/A"})
    return


def set_user_next_week(user_id, week):
    firestore_client = firestore.Client()
    user_ref = firestore_client.collection("users").document(user_id)
    # Run the get() method in a separate thread
    user_data = user_ref.get()
    if user_data.exists:
        user_info = user_data.to_dict()
        next_week_serve = user_info.get("nextWeekServe")  # May be None
        if next_week_serve == "N/A" or not next_week_serve:
            user_info["nextWeekServe"] = week
            user_ref.set(user_info)
            return

        if not week:
            return

        try:
            new_date = datetime.datetime.strptime(week, "%m-%d-%y")  # Correct format
            existing_date = datetime.datetime.strptime(
                next_week_serve, "%m-%d-%y"
            )  # Correct format
            # Update only if the new date is earlier
            if new_date < existing_date:
                user_info["nextWeekServe"] = week
                user_ref.set(user_info)
        except ValueError as e:
            print(
                f"ERROR: Invalid date format for week '{week}' - {e}"
            )  # More informative error
    else:
        return


def set_next_week_serve(church_id):
    # Run reset_next_dates in a separate thread
    reset_next_dates(church_id)

    firestore_client = firestore.Client()
    schedules_ref = (
        firestore_client.collection("churches")
        .document(church_id)
        .collection("schedule")
    )
    # Convert stream generator to a list asynchronously
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
                            set_user_next_week(individual_value, str(schedule_id))

            if isinstance(value, dict):
                for individual_key, individual_value in value.items():
                    if individual_key == "uid" and individual_value != "N/A":
                        set_user_next_week(individual_value, str(schedule_id))

    return


@https_fn.on_request()
def remove_family_schedules(req: https_fn.Request) -> https_fn.Response:
    try:
        request_data = req.get_json()
        if not request_data:
            return https_fn.Response("Missing JSON body", status=400)
    except Exception as e:
        return https_fn.Response(f"Invalid JSON: {str(e)}", status=400)

    # Extract required parameters
    church_id = request_data.get("church")
    user_id = request_data.get("uid")
    if not all([church_id, user_id]):
        return https_fn.Response("Missing required parameters", status=400)

    # Optional: Verify Firebase Auth token
    id_token = req.headers.get("Authorization")
    if id_token:
        try:
            decoded_token = auth.verify_id_token(id_token.split("Bearer ")[-1])
        except Exception as e:
            return https_fn.Response(f"Token verification failed: {str(e)}", status=401)
    firestore_client = firestore.Client()
    user_ref = firestore_client.collection("users").document(user_id)
    user_data = user_ref.get().to_dict()
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


@https_fn.on_request()
def create_test_data(req: https_fn.Request) -> https_fn.Response:
    firestore_client = firestore.Client()
    church_ref = firestore_client.collection("churches").document("Test Data")
    test_data = generate_test_data(150)
    church_ref.update({"deacons": test_data})
    return https_fn.Response("Test data created", status=200)

def new_years():
    pass


@https_fn.on_request()
def change_DOB(req: https_fn.Request) -> https_fn.Response:
    try:
        request_data = req.get_json()
        if not request_data:
            return https_fn.Response("Missing JSON body", status=400)
    except Exception as e:
        return https_fn.Response(f"Invalid JSON: {str(e)}", status=400)
    # Extract required parameters
    user_id = request_data.get("uid")
    pass