import firebase_admin
from firebase_admin import credentials, firestore

# Path to your service account key file
cred = credentials.Certificate('./taksis-a8ba7-firebase-adminsdk-hal48-c54bff4412.json')
firebase_admin.initialize_app(cred)

# Initialize Firestore
db = firestore.client()

#grabs the refference for the deacon array within the church
def getDeacons(churchName): 
    church_ref = db.collection('churches').document(churchName)
    church_doc = church_ref.get()
    church_data = church_doc.to_dict()
    deacons = church_data.get('deacons', [])
    return deacons

#evaluates the rank prop
def convertRank(rank):
    '''match rank:
        case "Chanter (Epsaltos)":
            return 0.2
        case "Reader (Ognostis)":
            return 0.4
        case "Subdeacon (Epideacon)":
            return 0.6
        case "Deacon (Full Deacon)":
            return 0.6
        case _:
            return'''
    pass
#converst the deacons array into a tensor array 
def convertToTensor(deacons):
    experience = 0
    frequency = 0
    rank = 0
    age = 0
    names = [item['name'] for item in deacons]
    uids = [item['uid'] for item in deacons]
    for i in deacons: 
        experience = i['experience'] * 0.05
        frequency = i['frequency'] * 0.05

print(getDeacons('St. Philopater and St. Mina, Wayland, MA'))
