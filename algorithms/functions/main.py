from typing import Any, List, Dict 
import random
import uuid
from firebase_functions import https_fn, scheduler_fn, firestore_fn
from firebase_admin import initialize_app, firestore, credentials
import google.cloud.firestore
cred = credentials.Certificate("../taksis-a8ba7-firebase-adminsdk-hal48-7ba92c6ad3.json")
initialize_app(cred)
firestore_client: google.cloud.firestore.Client = firestore.client()

#takes in the 30 deacons and scores them based off best fit 
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
    return sorted(deacons, key=lambda deacon: deacon['value'], reverse=True)


def matins (deacons):


    for deacon in deacons: 
        value = 0
        value += deacon["weeksSince"]*0.25


        if int(deacon["age"]) > 14 and int(deacon["age"]) < 22:
            value += 30


        value += (deacon["frequency"] - 3) * 0.13
        value += (deacon["experience"] - 4) * 0.12



        deacon["value"] = value
        print(deacon)


    return sort_values(deacons)


def third (deacons):


   

    for deacon in deacons: 
        value = 0
        value += deacon["weeksSince"]*0.25


        if int(deacon["age"]) > 8 and int(deacon["age"]) < 18:
            value += 30

            
        value += (deacon["frequency"] - 3) * 0.13

        
        if deacon["rank"] == "Chanter (Epsaltos)":
            value += 12



        deacon["value"] = value
        print(deacon)


    return sort_values(deacons)


def sixth (deacons):
    

    for deacon in deacons: 
        value = 0
        value += deacon["weeksSince"]*0.25


        if int(deacon["age"]) > 8 and int(deacon["age"]) < 18:
            value += 30

            
        value += (deacon["frequency"] - 3) * 0.13

        
        if deacon["rank"] == "Chanter (Epsaltos)":
            value += 12



        deacon["value"] = value
        print(deacon)


    return sort_values(deacons)


def pauline (deacons): 


    for deacon in deacons: 


        value = 0
        value += deacon["weeksSince"]*0.25


        if int(deacon["age"]) > 16 and int(deacon["age"]) < 35:

            value += 30


        value += (deacon["frequency"] - 3) * 0.13

        if deacon["rank"] == "Chanter (Epsaltos)":

            pass

        else:

            value += 2.4

        deacon["value"] = value
        print(deacon)


    return sort_values(deacons)


def catholic (deacons):
    
    for deacon in deacons: 


        value = 0
        value += deacon["weeksSince"]*0.25


        if int(deacon["age"]) > 16 and int(deacon["age"]) < 35:

            value += 30


        value += (deacon["frequency"] - 3) * 0.13

        if deacon["rank"] == "Chanter (Epsaltos)":

            pass

        else:

            value += 2.4

        deacon["value"] = value
        print(deacon)


    return sort_values(deacons)


def praxis (deacons):
    for deacon in deacons: 


        value = 0
        value += deacon["weeksSince"]*0.25


        if int(deacon["age"]) > 16 and int(deacon["age"]) < 35:

            value += 30


        value += (deacon["frequency"] - 3) * 0.13

        if deacon["rank"] == "Chanter (Epsaltos)":

            pass

        else:

            value += 2.4

        deacon["value"] = value
        print(deacon)


    return sort_values(deacons)


def gospel (deacons):
    
    for deacon in deacons: 


        value = 0
        value += deacon["weeksSince"]*0.25


        if int(deacon["age"]) > 20 and int(deacon["age"]) < 40:

            value += 30


        value += (deacon["frequency"] - 5) * 0.13

        value += (deacon["experience"] - 5) * 0.3


        if deacon["rank"] == "Chanter (Epsaltos)":

            pass

        else:

            value += 5

        deacon["value"] = value
        print(deacon)


    return sort_values(deacons)


def water (deacons):

    for deacon in deacons: 


        value = 0
        value += deacon["weeksSince"]*0.25


        if int(deacon["age"]) > 15 and int(deacon["age"]) < 40:

            value += 30


        value += (deacon["frequency"] - 6) * 0.13

        value += (deacon["experience"] - 7) * 0.23


        deacon["value"] = value
        print(deacon)


    return sort_values(deacons)


def wine (deacons):

    for deacon in deacons: 


        value = 0
        value += deacon["weeksSince"]*0.25


        if int(deacon["age"]) > 25 and int(deacon["age"]) < 60:

            value += 30


        value += (deacon["frequency"] - 7) * 0.13

        value += (deacon["experience"] - 8.4) * 0.23

        deacon["value"] = value
        print(deacon)


    return sort_values(deacons)


def altar (deacons): 

    for deacon in deacons: 


        value = 0
        value += deacon["weeksSince"]*0.25


        if int(deacon["age"]) > 10 and int(deacon["age"]) < 25:

            value += 30


        value += (deacon["frequency"] - 4) * 0.13

        deacon["value"] = value
        print(deacon)


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
        return sorted(deacons, key=lambda deacon: deacon['weeksSince'], reverse=True)
    return sorted(deacons, key=lambda deacon: deacon['weeksSince'], reverse=True)[:25]


#updates the user information to add one week to the people who had not served and restart the week count for the people who did serve
def update_weeks (schedule):

    pass


#ensures the person added to the schedule isn't on there multiple times
def add_person (schedule_list, deacon_list):
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


#takes in all the deacons for a church (one at a time) sorts them based off how long it has been since they served and passes them into the other functions
def create_schedule (deacons, num): 

    
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


    #makes a list of all the lists besides altar_list
    all_lists = [matins_list, 
                 third_list, 
                 sixth_list, 
                 pauline_list,
                 catholic_list, 
                 praxis_list, 
                 gospel_list, 
                 water_list, 
                 wine_list]
    
    #adds one person that is not already in the schedule for each roll
    for list in all_lists:
        schedule = add_person(schedule, list)

    #adds the number of altar servers minus two because blood and whine are in the altar 
    for i in range(num-2):
        schedule = add_person(schedule, altar_list)

    schedule_dict = { 'matins' : schedule[0],
                      'third hour': schedule[1],
                      'sixth hour': schedule[2],
                      'pauline' : schedule[3],
                      'catholic': schedule[4], 
                      'praxis': schedule[5],
                      'gospel': schedule[6],
                      'water': schedule[7], 
                      'wine': schedule[8],
                      'altar': schedule[7:]}
    
    update_weeks(schedule)

    return schedule_dict


@scheduler_fn.on_schedule(
    schedule = "0 16 * * 0",  # Every Sunday at 4:00 PM
    timezone=scheduler_fn.Timezone("America/New_York"),
)
def my_scheduled_function(event: scheduler_fn.ScheduledEvent) -> https_fn.Response:

    collection_ref = firestore_client.collection("churches")
    docs = collection_ref.stream()
    
    for doc in docs:
        doc_data = doc.to_dict()
        
        if 'deacons' in doc_data:
            deacons = doc_data['deacons']
        else: 
            print("no deacons found in this chruch")
        # removes the current week
        if 'schedule' in doc_data:
            doc_data['schedule'] = doc_data['schedule'][1:]
            while len(doc_data['schedule']) > 5:
                create_schedule(deacons)
        else:
            schedule_list = []
            for i in range(5):
                schedule_list.append(create_schedule(deacons))
            doc_data['schedule'] = schedule_list 
    # [START adminSdkPush]
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
    

'''@firestore_fn.on_document_updated(document="users/{userId}")
def update_church_members(event: firestore_fn.Event) -> None:
    """Cloud Function triggered by updates to user documents in Firestore."""
    user_data = event.data.to_dict()
    user_church = user_data.get("church")
    user_name = user_data.get("name")
    user_email = user_data.get("email")
    user_rank = user_data.get("rank")
    user_uid = event.params["userId"]  # Assuming userId is the UID of the user
    user_experience = user_data.get("experience")
    user_frequency = user_data.get("frequency")
    user_age = user_data.get("age")
    user_weeks = user_data.get("weeksSince")

    if user_church and user_name and user_email and user_uid:
        church_doc_ref = firestore_client.collection("churches").document(user_church)
        church_doc = church_doc_ref.get()

        # Prepare to batch update
        batch = firestore_client.batch()

        # Initialize church document if it doesn't exist
        if not church_doc.exists:
            batch.set(church_doc_ref, {
                "members": [],
                "deacons": [],
                "servants": [],
            })
            print(f"Initialized church document for {user_church}")

        # Fetch current data from church document
        current_data = church_doc.to_dict()
        current_members = current_data.get("members", [])
        current_deacons = current_data.get("deacons", [])
        current_servants = current_data.get("servants", [])

        # Create the member object
        member_object = {
            "name": user_name,
            "email": user_email,
            "uid": user_uid,
        }

        # Remove old entries if they exist
        updated_members = [member for member in current_members if member["uid"] != user_uid]
        updated_deacons = [deacon for deacon in current_deacons if deacon["uid"] != user_uid]
        updated_servants = [servant for servant in current_servants if servant["uid"] != user_uid]

        # Add updated member entry
        if not any(member["uid"] == user_uid for member in updated_members):
            updated_members.append(member_object)

        # Check and add/update deacons
        if user_data.get("isDeacon"):
            deacon_object = {
                "name": user_name,
                "uid": user_uid,
                "rank": user_rank,
                "experience": user_experience,
                "frequency": user_frequency,
                "age": user_age,
                "weeksSince": user_weeks or 4,
            }

            if not any(deacon["uid"] == user_uid for deacon in updated_deacons):
                updated_deacons.append(deacon_object)

        # Check and add/update servants
        if user_data.get("isSSTeacher"):
            servant_object = {
                "name": user_name,
                "email": user_email,
                "uid": user_uid,
            }

            if not any(servant["uid"] == user_uid for servant in updated_servants):
                updated_servants.append(servant_object)

        # Commit the batch update
        batch.update(church_doc_ref, {
            "members": updated_members,
            "deacons": updated_deacons,
            "servants": updated_servants,
        })
        batch.commit()
        print(f"Updated church document for {user_church}.")

'''
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
            "weeksSince": random.randint(0, 5)  # Random weeks since served between 0 and 52
        }
        test_data.append(person)

    return test_data

test_data = generate_test_data(100)

# Output the test data
for person in test_data:
    print(person)

schedule = create_schedule(test_data, 5)

print("matins gospel:", schedule['matins'], "\n")
print("third hour gospel", schedule['third hour'], "\n")
print("sixth hour gosepl", schedule['sixth hour'], '\n')
print("pauline", schedule['pauline'], '\n')
print("catholic", schedule['catholic'], '\n')
print("praxis", schedule['praxis'], "\n")
print("gospel", schedule['gospel'], "\n")
print("water", schedule['water'], "\n")
print("wine", schedule['wine'], "\n")
print("altar", schedule['altar'])