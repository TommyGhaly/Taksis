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
   experience = 0
   frequency = 0
   rank = 0
   age = 0
   weeks = 0
   names = [item['name'] for item in deacons]
   uids = [item['uid'] for item in deacons]
   attributes = []
   for i in deacons:
       experience = i['experience']
       frequency = i['frequency']
       rank = convertRank(i['rank'])
       age = i['age']
       weeks = i['weeksSince']
       attributes.append([age, rank, experience, frequency, weeks])
    np_array = np


print(getDeacons('St. Philopater and St. Mina, Wayland, MA'))
