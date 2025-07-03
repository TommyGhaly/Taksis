from typing import Any, List, Dict
import random
import uuid
import asyncio
import math
from firebase_functions import https_fn, scheduler_fn, firestore_fn
from firebase_admin import initialize_app, firestore, credentials, auth, messaging
import google.cloud.firestore
from google.cloud import firestore
import requests
import datetime
from flask import Request
import re


initialize_app()


# takes in the 30 deacons and scores them based off best fit


# add like 5 extra deacons to the list for bakcups
def sort_values(deacons: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    return sorted(deacons, key=lambda deacon: deacon["value"], reverse=True)


def matins(deacons):

    for deacon in deacons:
        value = 0
        value += deacon["weeksSince"] * 4

        if int(deacon["age"]) > 12 and int(deacon["age"]) < 25:
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

        if int(deacon["age"]) > 13 and int(deacon["age"]) < 45:

            value += 30

        value += (deacon["frequency"] - 3) * 0.4

        if deacon["rank"] == "Chanter (Epsaltos)":

            pass

        else:

            value += 2.4

        if int(deacon["age"]) < 12:
            value = -40

        deacon["value"] = value
    return sort_values(deacons)


def catholic(deacons):

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

        deacon["value"] = value
    return sort_values(deacons)


def praxis(deacons):
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

        deacon["value"] = value
    return sort_values(deacons)


def gospel(deacons):

    for deacon in deacons:

        value = 0
        value += deacon["weeksSince"] * 4

        if int(deacon["age"]) > 18 and int(deacon["age"]) < 55:

            value += 30

        value += (deacon["frequency"] - 5) * 0.4

        value += (deacon["experience"] - 5) * 0.3

        if deacon["rank"] == "Chanter (Epsaltos)":

            pass

        else:

            value += 5

        if int(deacon["age"]) < 16:
            value = -40

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

        if int(deacon["age"]) < 10:
            value = -40

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

        if int(deacon["age"]) < 18:
            value = -40

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


def sort_full_deacons(deacons):
    return sorted(deacons, key=lambda x: x.get("weeksSince", 0), reverse=True)


# takes in all the deacons for a church (one at a time) sorts them based off how long it has been since they served and passes them into the other functions
async def create_schedule(deacons, church_ref, num_altar_servers, fullDeacons):
    fullDeacon = not isinstance(fullDeacons, type(None))
    fullDeacon = fullDeacon and len(fullDeacons) > 0
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
    if fullDeacon:
        wine_list = sort_full_deacons(fullDeacons)
    else:
        wine_list = wine(sorted_deacons)
    altar_list = altar(sorted_deacons)

    # makes a list of all the lists besides altar_list
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
    # adds one person that is not already in the schedule for each roll
    for list in all_lists:
        schedule = add_person(schedule, list)

    # adds the number of altar servers minus two because blood and wine are in the altar
    for i in range(9):
        schedule = add_person(schedule, altar_list)

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


@https_fn.on_request()
def force_generate_schedule(req: https_fn.Request) -> https_fn.Response:
    return asyncio.run(my_async_scheduled_function())


@scheduler_fn.on_schedule(
    schedule="0 16 * * 0",  # Every Sunday at 4:00 PM
    timezone=scheduler_fn.Timezone("America/New_York"),
)
def generate_schedule(event: scheduler_fn.ScheduledEvent):
    return asyncio.run(my_async_scheduled_function())


async def my_async_scheduled_function():
    firestore_client = firestore.Client()
    churches_ref = firestore_client.collection("churches")
    churches_docs = list(churches_ref.stream())

    for church_doc in churches_docs:
        church_data = church_doc.to_dict()
        num_altar_servers = int(church_data.get("altarServers", 0))
        full_deacon_enabled = church_data.get("fullDeacon", None)

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

        # Determine the upcoming Sunday
        today = datetime.datetime.now()
        days_until_sunday = (6 - today.weekday()) % 7
        upcoming_sunday = today + datetime.timedelta(days=days_until_sunday)
        upcoming_sunday = upcoming_sunday.replace(
            hour=0, minute=0, second=0, microsecond=0
        )

        # If today *is* Sunday, then skip to next week
        if today.weekday() == 6:  # Sunday
            first_schedule_date = upcoming_sunday + datetime.timedelta(weeks=1)
        else:
            first_schedule_date = upcoming_sunday

        if len(schedules) < 5:
            for i in range(5):
                schedule_date = first_schedule_date + datetime.timedelta(weeks=i)
                schedule_id = schedule_date.strftime("%m-%d-%y")

                deacons = await get_deacons(church_doc.id)
                schedule = await create_schedule(
                    deacons, church_doc.reference, num_altar_servers, full_deacons
                )

                schedule_ref.document(schedule_id).set(schedule)
        else:
            # Delete current Sunday (which was today at 12am)
            to_delete = upcoming_sunday.strftime("%m-%d-%y")
            schedule_ref.document(to_delete).delete()

            # Add 6-weeks-ahead schedule
            new_schedule_date = upcoming_sunday + datetime.timedelta(weeks=5)
            new_schedule_id = new_schedule_date.strftime("%m-%d-%y")

            deacons = await get_deacons(church_doc.id)
            new_schedule = await create_schedule(
                deacons, church_doc.reference, num_altar_servers, full_deacons
            )

            schedule_ref.document(new_schedule_id).set(new_schedule)

        set_next_week_serve(church_doc.id)


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

    # Check if age is present; if not, calculate it from DOB if available
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
    # Retrieve the specific church document based on the user's church ID
    church_id = user_data.get("church")
    if not church_id:
        return https_fn.Response("User has no associated church ID")

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
        user_ref = firestore_client.collection("users").document(user_data["uid"])
        if not any(
            deacon.get("uid") == user_data["uid"] for deacon in church_data["deacons"]
        ):
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
        if "DOB" in user_data:
            user_data["age"] = calc_age(user_data["DOB"])
            doc_ref.update({"age": user_data["age"]})
        if "children" in user_data:
            for child in user_data["children"]:
                if "DOB" in child:
                    child["age"] = calc_age(child["DOB"])
            doc_ref.update({"children": user_data["children"]})
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
    church_ref = firestore_client.collection("churches").document(user_data["church"])
    church_data = church_ref.get().to_dict()
    deacons = church_data.get("deacons", [])
    if "children" in user_data:
        for child in user_data["children"]:
            child["church"] = user_data["church"]
            child["frequency"] = user_data["frequency"]
            updated_children.append(child)
            for deacon in deacons:
                if deacon.get("uid") == child.get("uid"):
                    deacon["frequency"] = child.get("frequency", 0)
    church_ref.update({"deacons": deacons})
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
        if user_data.get("isSSTeacher"):
            if user_data.get("church"):
                church_ref = firestore_client.collection("churches").document(
                    user_data["church"]
                )
                church_ref.collection("Servants Meeting").document(user_id).delete()
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


def determine_role(location):
    if location == "gospel":
        return "Gospel Server"
    elif location == "wine":
        return "Wine Server"
    elif location == "water":
        return "Water Server"
    elif location == "praxis":
        return "Praxis Server"
    elif location == "catholic":
        return "Catholic Server"
    elif location == "pauline":
        return "Pauline Server"
    elif location == "sixth":
        return "Sixth Server"
    elif location == "third":
        return "Third Server"
    elif location == "matins":
        return "Matins Server"
    else:
        return None


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
        handle_switch_server_notification(
            first_server, second_server, first_location, second_location
        )
        # 🔥 Run the slow function in a separate thread
        trigger_async_function(
            "https://set-next-week-serve-async-hy6oofbihq-uc.a.run.app",
            {"church": church_id},
        )

        return https_fn.Response("Servers swapped successfully", status=200)

    except Exception as e:
        return https_fn.Response(f"Error: {str(e)}", status=500)


def handle_switch_server_notification(
    first_server, second_server, first_location, second_location
):
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
    elif len(second_location) == 2:
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
    else:
        first_server_role = determine_role(second_location[0])
        second_server_role = determine_role(first_location[0])
        update_notification(
            first_server["uid"],
            f"{first_server["name"].split()[0]}! You have been switched with another deacon to serve as a {second_server_role} this Sunday! Check the app for details.",
            f"Your son {first_server["name"].split()[0]} has been switched with another deacon to serve as a {second_server_role} this Sunday! Check the app for details.",
            "Schedule Update!",
        )
        update_notification(
            second_server["uid"],
            f"{second_server["name"].split()[0]}! You have been switched with another deacon to serve as a {first_server_role} this Sunday! Check the app for details.",
            f"Your son {second_server["name"].split()[0]} has been switched with another deacon to serve as a {first_server_role} this Sunday! Check the app for details.",
            "Schedule Update!",
        )


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
    update_notification(
        server_uid,
        "An admin has removed you from serving in the altar this Sunday. Check the app for details.",
        "Your son has been removed from serving in the altar this Sunday. Check the app for details.",
        "Schedule Update!",
    )
    # 🔁 Synchronously run update_future_schedules
    update_future_schedules(church_id)

    # 🧵 Still run this in background if needed
    trigger_async_function(
        "https://set-next-week-serve-async-hy6oofbihq-uc.a.run.app",
        {"church": church_id},
    )

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

    if extra_servers:
        # Move first extra server to altar
        altar_servers.append(extra_servers[0])
        update_notification(
            extra_servers[0]["uid"],
            f"{extra_servers[0]["name"].split()[0]}! You have been moved to serve in the altar this Sunday! Check the app for details.",
            f"Your son {extra_servers[0]["name"].split()[0]} has been moved to serve in the altarr this Sunday! Check the app for details.",
            "Schedule Update!",
        )
        updated_extra_servers = extra_servers[1:]

        # Update Firestore
        schedule_ref.update({"altar": altar_servers, "extra": updated_extra_servers})

        # Run update_future_schedules synchronously
        update_future_schedules(church_id)

        # Run set_next_week_serve in background
        trigger_async_function(
            "https://set-next-week-serve-async-hy6oofbihq-uc.a.run.app",
            {"church": church_id},
        )

        return https_fn.Response("User moved from extra to altar", status=200)
    else:
        # Add placeholder when no extras are available
        altar_servers.append({"name": "N/A", "uid": str(uuid.uuid4())})
        schedule_ref.update({"altar": altar_servers})

        # Run update_future_schedules synchronously
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

    church_id = request_data.get("church")
    week_id = request_data.get("week")
    user_id = request_data.get("uid")
    family = request_data.get("family")
    if not all([church_id, week_id, user_id]):
        return https_fn.Response("Missing required parameters", status=400)

    id_token = req.headers.get("Authorization")
    if id_token:
        try:
            decoded_token = auth.verify_id_token(id_token.split("Bearer ")[-1])
        except Exception as e:
            return https_fn.Response(f"Token verification failed: {str(e)}", status=401)

    firestore_client = firestore.Client()
    user_ref = firestore_client.collection("users").document(user_id)
    user_doc = user_ref.get()
    all_uids = [user_id]
    if user_doc.exists:
        user_data = user_doc.to_dict()
        if "children" in user_data and family:
            for child in user_data["children"]:
                all_uids.append(child["uid"])

        # Run update_attendance synchronously
        update_attendance(user_ref)

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
    for uid in all_uids:
        key, _ = find_server(schedule_data, uid)
        if key is None:
            continue

        if len(key) == 1:
            key = str(key[0])
        else:
            key = (str(key[0]), key[1])

        new_deacon = []
        extra_deacons = create_extra_deacons(church_id, schedule_data["extra"])

        if len(extra_deacons) == 0:
            replacement = {"name": "N/A", "uid": str(uuid.uuid4())}
            if isinstance(key, tuple) and len(key) > 1:
                schedule_data[key[0]][key[1]] = replacement
            else:
                schedule_data[key] = replacement
            continue

        def get_and_replace(func, target_key):
            nonlocal schedule_data, extra_deacons
            new_deacon = func(extra_deacons)[0]
            replacement = {"name": new_deacon["name"], "uid": new_deacon["uid"]}
            new_key, _ = find_server(schedule_data, new_deacon["uid"])
            schedule_data[target_key] = replacement
            handle_unavailable_notification(
                replacement["uid"],
                week_id,
                target_key,
                replacement["name"]
            )
            del schedule_data["extra"][new_key[1]]

        if not isinstance(key, tuple):
            replace_map = {
                "matins": matins,
                "third": third,
                "sixth": sixth,
                "pauline": pauline,
                "catholic": catholic,
                "praxis": praxis,
                "gospel": gospel,
                "water": water,
                "wine": wine,
            }
            if key in replace_map:
                get_and_replace(replace_map[key], key)
        else:
            if key[0] == "altar":
                new_deacon = altar(extra_deacons)[0]
                replacement = {"name": new_deacon["name"], "uid": new_deacon["uid"]}
                new_key, _ = find_server(schedule_data, new_deacon["uid"])
                schedule_data["altar"][key[1]] = replacement
                handle_unavailable_notification(
                    replacement["uid"],
                    week_id,
                    "altar",
                    replacement["name"]
                )
                del schedule_data["extra"][new_key[1]]
            elif key[0] == "extra":
                print(f"Removing extra server: {key[1]}")
                del schedule_data["extra"][key[1]]

    # Final Firestore update
    schedule_ref.update(schedule_data)

    # Run set_next_week_serve in background
    trigger_async_function(
        "https://set-next-week-serve-async-hy6oofbihq-uc.a.run.app",
        {"church": church_id},
    )

    return https_fn.Response("User removed and replacement scheduled", status=200)


def is_today_or_upcoming_sunday(week_id_str):
    try:
        week_id_date = datetime.datetime.strptime(week_id_str, "%d-%m-%y").date()
    except ValueError:
        return False

    today = datetime.datetime.today().date()
    weekday = today.weekday()  # Monday = 0, Sunday = 6
    days_until_sunday = (6 - weekday) % 7
    next_sunday = today + datetime.timedelta(days=days_until_sunday)

    return week_id_date == today or week_id_date == next_sunday


def handle_unavailable_notification(user_id, week_id, role, name):
    if is_today_or_upcoming_sunday(week_id):
        update_notification(
            user_id,
            f"{name.split()[0]}! You have been rescheduled to serve as {interpret_role(role)} this Sunday! Check the app for details.",
            f"Your son {name.split()[0]} has been rescheduled to serve as {interpret_role(role)} this Sunday! Check the app for details.",
            "Schedule Update!",
        )
    return


def update_attendance(user_ref):
    firestore_client = firestore.Client()
    user_doc = user_ref.get()
    user_data = user_doc.to_dict()
    church_ref = firestore_client.collection("churches").document(user_data["church"])
    church_data = church_ref.get().to_dict()
    deacons = church_data.get("deacons", [])
    if "frequency" in user_data:
        user_data["frequency"] *= 0.95
        if user_data["frequency"] < 0.1:
            user_data["frequency"] = 0.5
    for deacon in deacons:
        if deacon["uid"] == user_data["uid"]:
            deacon["frequency"] = user_data["frequency"]
            break
    church_ref.update({"deacons": deacons})
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
            user.reference.update({"nextWeekServe": "N/A", "nextRole": "N/A"})
    return


def interpret_role(role):
    if role == "N/A":
        return "N/A"
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


def set_user_next_week(user_id, week, role):
    firestore_client = firestore.Client()
    user_ref = firestore_client.collection("users").document(user_id)
    role = interpret_role(role)
    # Run the get() method in a separate thread
    user_data = user_ref.get()
    if user_data.exists:
        user_info = user_data.to_dict()
        next_week_serve = user_info.get("nextWeekServe")  # May be None
        if next_week_serve == "N/A" or not next_week_serve:
            user_info["nextWeekServe"] = week
            user_info["nextRole"] = role
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
                user_info["nextRole"] = role
                user_ref.set(user_info)
        except ValueError as e:
            return https_fn.Response(f"Invalid date format: {str(e)}", status=400)
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
                            set_user_next_week(individual_value, str(schedule_id), key)

            if isinstance(value, dict):
                for individual_key, individual_value in value.items():
                    if individual_key == "uid" and individual_value != "N/A":
                        set_user_next_week(individual_value, str(schedule_id), key)

    return


@https_fn.on_request()
def set_next_week_serve_async(req: https_fn.Request) -> https_fn.Response:
    try:
        request_data = req.get_json()
        church_id = request_data.get("church")

        if not church_id:
            return https_fn.Response("Missing 'church' parameter", status=400)

        set_next_week_serve(church_id)
        return https_fn.Response("set_next_week_serve completed", status=200)

    except Exception as e:
        return https_fn.Response(f"Error: {str(e)}", status=500)


def trigger_async_function(endpoint_url: str, payload: dict):
    try:
        requests.post(endpoint_url, json=payload, timeout=1)
    except requests.exceptions.ReadTimeout:
        pass  # Let main function return immediately


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


grades_list = [
    "Pre-School - Age 3",
    "Pre-School - Age 4",
    "Kindergarten",
    "1st Grade",
    "2nd Grade",
    "3rd Grade",
    "4th Grade",
    "5th Grade",
    "6th Grade",
    "7th Grade",
    "8th Grade",
    "9th Grade",
    "10th Grade",
    "11th Grade",
    "12th Grade",
    "College",
]


def clean_student_data(student_data):
    current_year = datetime.datetime.now().year
    cleaned = {}
    for key, val in student_data.items():
        if key.lower() == "birthday":
            cleaned[key] = val
        elif re.fullmatch(r"\d{2}-\d{2}-\d{4}", key):
            year = int(key.split("-")[2])
            if year == current_year:
                cleaned[key] = val
        else:
            cleaned[key] = val

    grade = cleaned.get("grade")
    if grade in grades_list and grade != "College":
        cleaned["grade"] = grades_list[grades_list.index(grade) + 1]
    return cleaned


def move_and_clean_students(church_ref, class_name):
    cls = church_ref.collection(class_name)
    # Walk backwards through grades, skipping 'College'
    for i in reversed(range(1, len(grades_list))):
        current, prev = grades_list[i], grades_list[i - 1]
        if current != "College" or current != "5:00-5:30" or current != "5:30-6:00":
            # 1) wipe out existing
            for s in cls.document(current).collection("students").stream():
                s.reference.delete()
            # 2) copy + clean from prev
            for s in cls.document(prev).collection("students").stream():
                cls.document(current).collection("students").document(s.id).set(
                    clean_student_data(s.to_dict())
                )

    # finally, clear Pre-School - Age 3
    for s in cls.document(grades_list[0]).collection("students").stream():
        s.reference.delete()


@scheduler_fn.on_schedule(
    schedule="0 0 11 9 *", timezone=scheduler_fn.Timezone("America/New_York")
)
def new_years_cleanup(event: scheduler_fn.ScheduledEvent) -> None:
    db = firestore.Client()
    church_count = 0

    for church_doc in db.collection("churches").stream():
        move_and_clean_students(church_doc.reference, "Hymns Class")
        move_and_clean_students(church_doc.reference, "Sunday School")
        church_count += 1


def calc_age(dob_str):
    if dob_str:
        try:
            dob = datetime.datetime.strptime(dob_str, "%m-%d-%Y")
            today = datetime.datetime.now()
            age = (
                today.year
                - dob.year
                - ((today.month, today.day) < (dob.month, dob.day))
            )
            return age
        except Exception as e:
            return None
    return None


@scheduler_fn.on_schedule(
    schedule="0 0 * * 0",  # Every Sunday at midnight
    timezone=scheduler_fn.Timezone("America/New_York"),
)
async def scheduled_update_ages():
    firestore_client = firestore.Client()
    users_ref = firestore_client.collection("users")
    users_docs = users_ref.stream()

    tasks = []
    for user_doc in users_docs:
        tasks.append(asyncio.to_thread(update_user_sync, user_doc))

    await asyncio.gather(*tasks)

    return https_fn.Response("Scheduled age update completed", status=200)


def update_user_sync(user_doc):
    user_data = user_doc.to_dict()
    if "DOB" in user_data:
        current_age = calc_age(user_data["DOB"])
        stored_age = user_data.get("age")
        if stored_age is None or int(stored_age) != current_age:
            print(f"Updating age for user {user_data['name']}")
            user_doc.reference.update({"age": current_age})

            mock_request = Request.from_values(
                headers={"Authorization": ""},
                json={"uid": user_data["uid"]},
            )
            update_user(mock_request)


async def update_all_users():
    firestore_client = firestore.Client()
    users_ref = firestore_client.collection("users")
    users_docs = users_ref.stream()

    tasks = []
    for user_doc in users_docs:
        tasks.append(asyncio.to_thread(update_user_sync, user_doc))

    await asyncio.gather(*tasks)


@https_fn.on_request()
def test_update_ages(req: https_fn.Request) -> https_fn.Response:
    asyncio.run(update_all_users())
    return https_fn.Response("Manual age update completed", status=200)


def deacon_present(uid, deacons):
    for deacon in deacons:
        if deacon["uid"] == uid:
            return True
    return False


@https_fn.on_request()
def testing_notifcations(req: https_fn.Request) -> https_fn.Response:
    message = messaging.Message(
        token="fUdnk8uvSU4_mfpQihxUFu:APA91bH2SVMsjz8mhWAJtG3m2lEmmIskXBticQcvayhcNg0m-uyh2e3B3sRY84n-HeIjzL3WnD4K8IG0GjirF52jA204xpT9fakec0DO25ZoMJ1F6AJ9Ajw",
        notification=messaging.Notification(
            title="this is a test",
            body="I want to see if this works",
        ),
        android=messaging.AndroidConfig(priority="high"),
        apns=messaging.APNSConfig(
            payload=messaging.APNSPayload(
                aps=messaging.Aps(sound="default", content_available=True)
            )
        ),
    )

    try:
        response = messaging.send(message)
        return https_fn.Response(
            f"Notification sent successfully: {response}", status=200
        )
    except Exception as e:
        return https_fn.Response(f"Error sending notification: {str(e)}", status=500)


def send_notification(fcm_tokens, body, title):
    for token in fcm_tokens:
        message = messaging.Message(
            token=token,
            notification=messaging.Notification(
                title=title,
                body=body,
            ),
            android=messaging.AndroidConfig(priority="high"),
            apns=messaging.APNSConfig(
                payload=messaging.APNSPayload(
                    aps=messaging.Aps(sound="default", content_available=True)
                )
            ),
        )
        try:
            messaging.send(message)
        except Exception:
            pass  # Silently ignore errors


@scheduler_fn.on_schedule(
    schedule="15 16 * * 0",  # Every Sunday at 4:15 PM
    timezone=scheduler_fn.Timezone("America/New_York"),
)
def first_reminder(event: scheduler_fn.ScheduledEvent) -> None:
    asyncio.run(liturgy_notification())

@scheduler_fn.on_schedule(
    schedule="0 20 * * 5",  # Every Friday at 8:00 PM
    timezone=scheduler_fn.Timezone("America/New_York"),
)
def second_reminder(event: scheduler_fn.ScheduledEvent) -> None:
    asyncio.run(liturgy_notification())

@scheduler_fn.on_schedule(
    schedule="0 20 * * 6",  # Every Saturday at 8:00 PM
    timezone=scheduler_fn.Timezone("America/New_York"),
)
def third_reminder(event: scheduler_fn.ScheduledEvent) -> None:
    asyncio.run(liturgy_notification())

def get_next_sunday(base_date: datetime.date) -> datetime.date:
    days_ahead = (6 - base_date.weekday()) % 7
    days_ahead = 7 if days_ahead == 0 else days_ahead
    return base_date + datetime.timedelta(days=days_ahead)


async def liturgy_notification():
    today = datetime.date.today()
    next_sunday = get_next_sunday(today)
    next_sunday_str = next_sunday.strftime("%m-%d-%y")

    firestore_client = firestore.Client()
    churches_ref = firestore_client.collection("churches")
    churches_docs = churches_ref.stream()

    tasks = []

    for church_doc in churches_docs:
        schedule_ref = church_doc.reference.collection("schedule")
        schedule_doc = schedule_ref.document(next_sunday_str).get()
        if not schedule_doc.exists:
            continue

        for key, value in schedule_doc.to_dict().items():
            print(f"Processing key: {key}, value: {value}")

            if isinstance(value, dict):
                if value["name"] == "N/A":
                    continue

            if key == "extra":
                continue

            if isinstance(value, list):
                for server in value:
                    if server["name"] == "N/A":
                        print(f"Skipping {server['name']} in {key}")
                        continue
                    tasks.append(asyncio.to_thread(
                        update_notification,
                        server["uid"],
                        f"Great News {server['name'].split()[0]}! You are scheduled to serve this Sunday, {next_sunday_str} as an altar server. Please check the app for details.",
                        f"Great News! Your son {server['name'].split()[0]} is scheduled to serve this Sunday, {next_sunday_str} as an altar server. Please check the app for details.",
                        "Liturgy Reminder"
                    ))
            else:
                if "uid" in value and value["uid"] != "N/A":
                    print(f"Sending notification to {value['name']}")
                    tasks.append(asyncio.to_thread(
                        update_notification,
                        value["uid"],
                        f"Great News {value['name'].split()[0]}! You are scheduled to serve this Sunday, {next_sunday_str} as a {interpret_role(key)}. Please check the app for details.",
                        f"Great News! Your son {value['name'].split()[0]} is scheduled to serve this Sunday, {next_sunday_str} as a {interpret_role(key)}. Please check the app for details.",
                        "Liturgy Reminder"
                    ))

    await asyncio.gather(*tasks)

@https_fn.on_request()
def test_liturgy_notification(req: https_fn.Request) -> https_fn.Response:
    try:
        asyncio.run(liturgy_notification())
        return https_fn.Response("Liturgy notification sent successfully", status=200)
    except Exception as e:
        return https_fn.Response(f"Error sending notification: {str(e)}", status=500)


@scheduler_fn.on_schedule(
    schedule="30 12 * * 0",  # Every Sunday at 12:30 AM
    timezone=scheduler_fn.Timezone("America/New_York"),
)
def servants_meeting_notification(event: scheduler_fn.ScheduledEvent) -> None:
    asyncio.run(process_servant_notifications())


async def process_servant_notifications():
    firestore_client = firestore.Client()
    users_ref = firestore_client.collection("users")
    users_docs = list(users_ref.stream())

    # Run all notification tasks concurrently
    await asyncio.gather(
        *[notify_servant(firestore_client, user) for user in users_docs]
    )


async def notify_servant(firestore_client, user_doc):
    user_data = user_doc.to_dict()
    if not user_data.get("isServant") or not user_data.get("fcmTokens"):
        return

    # Offload the blocking get() call
    church_id = user_data.get("church")
    if not church_id:
        return

    church_doc = await asyncio.to_thread(
        lambda: firestore_client.collection("churches").document(church_id).get()
    )
    church_data = church_doc.to_dict() or {}

    # Send notification (non-blocking if implemented with async)
    await asyncio.to_thread(
        send_notification,
        user_data["fcmTokens"],
        f"Reminder: Servants Meeting is starting soon at {church_data.get('servantsMeetingTime', '12:30 PM')}! Please be on time.",
        "Servants Meeting Reminder",
    )


def search_for_child(uid):
    firestore_client = firestore.Client()
    users_ref = firestore_client.collection("users")
    
    # Only fetch users that have a `children` field
    users_with_children = users_ref.where("children", "!=", None).stream()

    for user in users_with_children:
        user_data = user.to_dict()
        children = user_data.get("children", [])
        if isinstance(children, list):
            for child in children:
                if isinstance(child, dict) and child.get("uid") == uid:
                    if (
                        "fcmTokens" in user_data
                        and isinstance(user_data["fcmTokens"], list)
                        and len(user_data["fcmTokens"]) > 0
                    ):
                        return (True, user_data["fcmTokens"])
                    else:
                        return (False, None)

    return (False, None)


def update_notification(uid, message, child_message, title):
    firestore_client = firestore.Client()
    user_ref = firestore_client.collection("users").document(uid)
    user_doc = user_ref.get()
    if user_doc.exists:
        user_data = user_doc.to_dict()
        if (
            "fcmTokens" in user_data
            and isinstance(user_data["fcmTokens"], list)
            and len(user_data["fcmTokens"]) > 0
        ):
            fcm_tokens = user_data["fcmTokens"]
            send_notification(fcm_tokens, message, title)
    else:
        child_info = search_for_child(uid)
        if child_info[0]:
            send_notification(child_info[1], child_message, title)
        else:
            print(f"No FCM tokens found for user {uid} or their children.")