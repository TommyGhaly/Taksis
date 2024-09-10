import firebase_admin
from firebase_admin import credentials, firestore
import numpy as np
import tensorflow as tf

# Path to your service account key file
cred = credentials.Certificate('./taksis-a8ba7-firebase-adminsdk-hal48-c54bff4412.json')
firebase_admin.initialize_app(cred)


# Initialize Firestore
db = firestore.client()

# Grabs the reference for the deacon array within the church
def getDeacons(churchName):
    church_ref = db.collection('churches').document(churchName)
    church_doc = church_ref.get()
    church_data = church_doc.to_dict()
    deacons = church_data.get('deacons', [])
    return deacons

# Evaluates the rank prop
def convertRank(rank):
    match rank:
        case "Chanter (Epsaltos)":
            return 1
        case "Reader (Ognostis)":
            return 2
        case "Subdeacon (Epideacon)":
            return 3
        case "Deacon (Full Deacon)":
            return 4
        case _:
            return 0  # Return 0 if rank is not recognized

# Converts the deacons array into a tensor array and adjusts it to 250 elements
def convertToTensor(deacons):
    attributes = []
    for i in deacons:
        age = i['age']
        rank = convertRank(i['rank'])
        experience = i['experience']
        frequency = i['frequency']
        weeks = i['weeksSince']
        attributes.append([age, rank, experience, frequency, weeks])
    
    # Convert to a NumPy array
    np_array = np.array(attributes)

    # Calculate the number of elements needed to make a total of 250
    num_elements = np_array.size
    if num_elements < 250:
        # If there are fewer than 250 elements, pad the array
        pad_size = 250 - num_elements
        np_array = np.pad(np_array, (0, pad_size), 'constant')
    else:
        # If there are more than 250 elements, truncate the array
        np_array = np_array.flatten()[:250]

    # Convert the adjusted NumPy array to a tensor
    tf_tensor = tf.convert_to_tensor(np_array, dtype=tf.float32)
    
    return tf_tensor

# Example usage
deacons = getDeacons('St. Philopater and St. Mina, Wayland, MA')
tensor = convertToTensor(deacons)
print(tensor)
