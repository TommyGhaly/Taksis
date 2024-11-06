from typing import Any, List, Dict
import datetime
import random
import uuid
from firebase_functions import https_fn, scheduler_fn, firestore_fn
from firebase_admin import initialize_app, firestore, credentials
import google.cloud.firestore

initialize_app()
# Uncomment to test locally
# db = firestore.client()

# takes in the 30 deacons and scores them based off best fit
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
def update_weeks(schedule):
    pass


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
    for i in range(num_altar - 2):
        schedule = add_person(schedule, altar_list)

    schedule_dict = {
        "matins": schedule[0],
        "third hour": schedule[1],
        "sixth hour": schedule[2],
        "pauline": schedule[3],
        "catholic": schedule[4],
        "praxis": schedule[5],
        "gospel": schedule[6],
        "water": schedule[7],
        "wine": schedule[8],
        "altar": schedule[7:],
    }

    update_weeks(schedule)

    return schedule_dict

# uncomment on_request and comment on_schedule to test locally
# @https_fn.on_request()
# def my_scheduled_function(req: https_fn.Request) -> https_fn.Response:
@scheduler_fn.on_schedule(
    schedule = "0 16 * * 0",  # Every Sunday at 4:00 PM
    timezone=scheduler_fn.Timezone("America/New_York"),
)
def my_scheduled_function(event: scheduler_fn.ScheduledEvent) -> https_fn.Response:
    firestore_client: google.cloud.firestore.Client = firestore.client()
    collection_ref = firestore_client.collection("churches")
    docs = collection_ref.stream()

    for doc in docs:
        doc_data = doc.to_dict()

        if "deacons" in doc_data:
            deacons = doc_data["deacons"]
        else:
            print("no deacons found in this chruch")
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
            doc_date_str = doc_date.strftime("%Y-%m-%d")
            # Push the document data into the "schedules" collection with the date as the document name
            new_doc_ref = firestore_client.collection("schedules").document(doc_date_str).set(s)
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
