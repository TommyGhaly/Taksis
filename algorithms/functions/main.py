# Welcome to Cloud Functions for Firebase for Python!
# To get started, simply uncomment the below code or create your own.
# Deploy with `firebase deploy`
import firebase_admin
from firebase_admin import credentials, initialize_app
from firebase_functions import https_fn

cred = credentials.Certificate("../taksis-a8ba7-firebase-adminsdk-hal48-7ba92c6ad3.json")
firebase_admin.initialize_app(cred)

# initialize_app()

@https_fn.on_request()
def on_request_example(req: https_fn.Request) -> https_fn.Response:
    return https_fn.Response("Hello world!")