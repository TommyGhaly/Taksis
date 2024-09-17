from typing import Any

# [START v2imports]
# Dependencies for callable functions.
from firebase_functions import https_fn, options

# Dependencies for writing to Realtime Database.
from firebase_admin import db, initialize_app

initialize_app()

@https_fn.on_call()
def addnumbers(req: https_fn.CallableRequest) -> Any:
    """Adds two numbers to each other."""
# [END v2addFunctionTrigger]
    # [START v2addHttpsError]
    # Checking that attributes are present and are numbers.
    try:
        # [START v2readAddData]
        # Numbers passed from the client.
        first_number_param = req.data["firstNumber"]
        second_number_param = req.data["secondNumber"]
        # [END v2readAddData]
        first_number = int(first_number_param)
        second_number = int(second_number_param)
    except (ValueError, KeyError):
        # Throwing an HttpsError so that the client gets the error details.
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message=('The function must be called with two arguments, "firstNumber"'
                     ' and "secondNumber", which must both be numbers.'))
    # [END v2addHttpsError]

    # [START v2returnAddData]
    return {
        "firstNumber": first_number,
        "secondNumber": second_number,
        "operator": "+",
        "operationResult": first_number + second_number
    }