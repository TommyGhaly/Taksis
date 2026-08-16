import gspread
import firebase_admin
from firebase_admin import credentials as firebase_credentials, firestore
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload
import datetime
import requests
import tempfile
import os
import io
from msal import ConfidentialClientApplication
import json
import attendance_statistics
import statistics_export

# === CONFIGURATION ===
TARGET_CHURCH_NAME = "St. Philopater and St. Mina, Wayland, MA"

# This spreadsheet holds the attendance grid only. Statistics live in their
# own spreadsheet - see statistics_export.py.
ATTENDANCE_SHEET_TITLE = "Servants Attendance"
SHEET_TITLES = [ATTENDANCE_SHEET_TITLE]

GOOGLE_SCOPES = [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive'
]

# === HELPER FUNCTIONS ===
def get_script_dir():
    """Get the directory where this script is located."""
    return os.path.dirname(os.path.abspath(__file__))

def get_file_path(filename):
    """Get absolute path for a file in the same directory as this script."""
    return os.path.join(get_script_dir(), filename)

# === MICROSOFT GRAPH FUNCTIONS ===
def get_microsoft_access_token():
    """Get Microsoft Graph access token for SharePoint upload."""
    try:
        config_path = get_file_path("microsoft_config.json")
        
        if not os.path.exists(config_path):
            raise FileNotFoundError(f"Microsoft config file not found at: {config_path}")
        
        with open(config_path) as f:
            ms_config = json.load(f)
        
        CLIENT_ID = ms_config["client_id"]
        CLIENT_SECRET = ms_config["client_secret"]
        TENANT_ID = ms_config["tenant_id"]
        
        app = ConfidentialClientApplication(
            client_id=CLIENT_ID,
            client_credential=CLIENT_SECRET,
            authority=f"https://login.microsoftonline.com/{TENANT_ID}"
        )
        
        result = app.acquire_token_for_client(
            scopes=["https://graph.microsoft.com/.default"]
        )
        
        if "error" in result:
            raise Exception(f"Failed to get Microsoft token: {result['error']}")
        
        return result["access_token"]
        
    except Exception as e:
        raise

def get_school_year():
    """Determine the current Sunday School year (starts September 11th)."""
    today = datetime.datetime.now()
    current_year = today.year
    
    school_year_start = datetime.datetime(current_year, 9, 11)
    
    if today < school_year_start:
        return f"{current_year - 1}-{current_year}"
    else:
        return f"{current_year}-{current_year + 1}"

def upload_to_sharepoint(file_path, file_name, access_token, drive_id):
    """Upload file to SharePoint Teams St Paul Servants Meeting folder, overwriting if exists."""
    import time  # Import here for delay functionality
    
    try:
        if not os.path.exists(file_path):
            return False
        
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        }
        
        school_year = get_school_year()
        # Using the correct path at root level (not under Sunday School)
        file_path_in_sharepoint = f"St%20Paul%20Servants%20Meeting/Attendance%20Reports/{school_year}/{file_name}"
        upload_url = f"https://graph.microsoft.com/v1.0/drives/{drive_id}/root:/{file_path_in_sharepoint}:/content"
        
        # Read file content once
        with open(file_path, "rb") as f:
            file_content = f.read()
        
        # First attempt: Try direct overwrite (works if file is in co-authoring mode)
        response = requests.put(upload_url, headers=headers, data=file_content)
        
        if response.status_code in [200, 201]:
            return True
        elif response.status_code == 423:
            # Check if file exists and try to delete it
            check_url = f"https://graph.microsoft.com/v1.0/drives/{drive_id}/root:/{file_path_in_sharepoint}"
            delete_headers = {"Authorization": f"Bearer {access_token}"}
            
            # Try to delete with retries
            max_retries = 3
            for retry in range(max_retries):
                delete_response = requests.delete(check_url, headers=delete_headers)
                
                if delete_response.status_code == 204:
                    time.sleep(2)  # Wait for deletion to propagate
                    
                    # Try upload again
                    response = requests.put(upload_url, headers=headers, data=file_content)
                    if response.status_code in [200, 201]:
                        return True
                        
                elif delete_response.status_code == 423:
                    if retry < max_retries - 1:
                        wait_time = 5 * (retry + 1)  # Exponential backoff: 5, 10, 15 seconds
                        time.sleep(wait_time)
                    else:
                        return False
                else:
                    break
        else:
            return False
        
        return False
            
    except Exception as e:
        return False

# === GOOGLE SHEETS FUNCTIONS ===
def export_google_sheet_to_excel(spreadsheet, church_name, sheet_creds):
    """Export Google Sheet to Excel format using Google Drive API."""
    try:
        drive_service = build('drive', 'v3', credentials=sheet_creds)
        
        request = drive_service.files().export_media(
            fileId=spreadsheet.id,
            mimeType='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        
        with tempfile.NamedTemporaryFile(delete=False, suffix=".xlsx") as tmp:
            downloader = MediaIoBaseDownload(tmp, request)
            done = False
            while not done:
                status, done = downloader.next_chunk()
            
            return tmp.name
            
    except Exception as e:
        # Fallback to direct URL method
        try:
            export_url = f"https://docs.google.com/spreadsheets/d/{spreadsheet.id}/export?format=xlsx"
            
            with tempfile.NamedTemporaryFile(delete=False, suffix=".xlsx") as tmp:
                response = requests.get(export_url)
                if response.status_code == 200:
                    tmp.write(response.content)
                    return tmp.name
                else:
                    return None
        except Exception as e:
            return None

def sheet_set_up_properly(sh):
    """Check that both the attendance grid and the statistics tab exist."""
    worksheet_titles = [ws.title for ws in sh.worksheets()]
    return all(title in worksheet_titles for title in SHEET_TITLES)

def set_up_sheet_pages(sh):
    """
    Ensure the attendance worksheet exists.

    Non-destructive towards the attendance grid itself: it is only renamed
    into place when missing, never deleted and recreated.
    """
    worksheet_list = sh.worksheets()
    existing_titles = [ws.title for ws in worksheet_list]

    # Nothing there at all - create the attendance grid first.
    if len(worksheet_list) == 0:
        sh.add_worksheet(title=ATTENDANCE_SHEET_TITLE, rows="1000", cols="26")
        return

    if ATTENDANCE_SHEET_TITLE not in existing_titles:
        # The first worksheet is the attendance grid by convention.
        worksheet_list[0].update_title(ATTENDANCE_SHEET_TITLE)

    # Drop anything else, including a Statistics tab left behind by an
    # earlier version - statistics have their own spreadsheet now.
    for ws in sh.worksheets():
        if ws.title != ATTENDANCE_SHEET_TITLE:
            try:
                sh.del_worksheet(ws)
            except Exception:
                pass

def interpret_dates(servant_data):
    """Extract date entries from servant data."""
    dates = []
    for key, value in servant_data.items():
        try:
            datetime.datetime.strptime(key, "%m-%d-%Y")
            dates.append((key, value))
        except ValueError:
            # Skip non-date fields like 'name', 'email', etc.
            continue
    return dates

def get_servants_data(servants_meeting_reference, db):
    """Get the servants from the servants meeting data."""
    try:
        servant_dict = {}
        
        # Get documents directly from "Servants Meeting" collection
        servants_docs = servants_meeting_reference.get()
        
        total_attendance_records = 0
        servants_with_attendance = 0
        
        for servant_doc in servants_docs:
            servant_data = servant_doc.to_dict()
            servant_id = servant_doc.id
            
            # Try to get servant name from users collection
            servant_name = None
            try:
                user_doc = db.collection("users").document(servant_id).get()
                if user_doc.exists:
                    user_data = user_doc.to_dict()
                    servant_name = user_data.get("name", servant_id)
                else:
                    servant_name = servant_id
            except:
                servant_name = servant_id
            
            # Extract attendance data
            attendance_data = interpret_dates(servant_data)
            
            # Include ALL servants, even those without attendance data
            servant_dict[servant_name] = attendance_data
            
            if attendance_data:
                servants_with_attendance += 1
                total_attendance_records += len(attendance_data)
        
        return servant_dict
        
    except Exception as e:
        return {}

def organize_names(servant_dict):
    """Alphabetize the servant names."""
    names = list(servant_dict.keys())
    names.sort()
    return names

def find_start_date(servant_dict):
    """Find the earliest date in the servant records."""
    try:
        date_format = "%m-%d-%Y"
        start_date = datetime.datetime.max
        date_count = 0
        today = datetime.datetime.now()

        for servant_name, records in servant_dict.items():
            for date_str, _ in records:
                try:
                    date_obj = datetime.datetime.strptime(date_str, date_format)
                    # Ignore dates in the future
                    if date_obj <= today:
                        date_count += 1
                        if date_obj < start_date:
                            start_date = date_obj
                except ValueError:
                    continue

        if start_date == datetime.datetime.max:
            # If no valid dates found, start from beginning of school year
            current_year = today.year
            september11 = datetime.datetime(current_year, 8, 11)  # September 11
            
            # If we're before September 11, use last year's September 11
            if today < september11:
                start_date = datetime.datetime(current_year - 1, 8, 11)
            else:
                start_date = september11
        
        return start_date
        
    except Exception as e:
        # Default to beginning of current school year
        today = datetime.datetime.now()
        current_year = today.year
        september11 = datetime.datetime(current_year, 8, 11)
        if today < september11:
            return datetime.datetime(current_year - 1, 8, 11)
        else:
            return september11

def get_dates(start_date):
    """Create an array of Sunday dates from start to most recent Sunday (or today if Sunday)."""
    # Adjust start_date to the nearest Sunday if not already Sunday
    if start_date.weekday() != 6:
        days_to_sunday = (start_date.weekday() + 1) % 7
        start_date = start_date - datetime.timedelta(days=days_to_sunday)

    date_array = []
    current_date = start_date

    today = datetime.datetime.now()
    
    # Determine the last Sunday to include
    if today.weekday() == 6:  # Today is Sunday
        last_sunday = today
    else:
        # Find the most recent Sunday (in the past)
        days_since_sunday = (today.weekday() + 1) % 7
        if days_since_sunday == 0:
            days_since_sunday = 7
        last_sunday = today - datetime.timedelta(days=days_since_sunday)
    
    last_sunday = last_sunday.replace(hour=0, minute=0, second=0, microsecond=0)

    # Include all Sundays from start_date to last_sunday (inclusive)
    while current_date <= last_sunday:
        date_array.append(current_date.strftime("%m-%d-%Y"))
        current_date += datetime.timedelta(days=7)

    return date_array
def write_to_sheet(sh, servant_dict, date_array, servant_names):
    """Update the servants attendance worksheet with data and formatting."""
    try:
        # Add headers
        sh.update(values=[["Servant Name"]], range_name='A1')
        sh.update(values=[date_array], range_name='B1')
        sh.update(values=[[name] for name in servant_names], range_name='A2')

        # Prepare attendance values
        attendance_values = []
        present_count = 0
        absent_count = 0
        not_recorded_count = 0
        
        for servant in servant_names:
            attendance_dict = dict(servant_dict.get(servant, []))
            row = []
            for date in date_array:
                value = attendance_dict.get(date, None)
                if value is True:
                    row.append("Present")
                    present_count += 1
                elif value is False:
                    row.append("Absent")
                    absent_count += 1
                else:
                    row.append("")
                    not_recorded_count += 1
            attendance_values.append(row)

        sh.update(values=attendance_values, range_name='B2')

        # Apply formatting
        apply_sheet_formatting(sh, servant_names, date_array, servant_dict)
        
    except Exception as e:
        raise

def build_servants_sections(servant_dict, date_array):
    """
    Turn the servants roster into a statistics section.

    servant_dict maps name -> list of (date_string, value) pairs, which is the
    shape get_servants_data returns; the statistics module wants a dict per
    person, so convert on the way in.
    """
    people = {
        name: dict(records or [])
        for name, records in servant_dict.items()
    }
    return [{
        "title": "Servants Meeting",
        "blocks": [
            ("Servants", attendance_statistics.build_person_rows(people, date_array)),
        ],
        "summary_label": "All Servants — Overall",
    }]

def write_statistics(stats_spreadsheet, servant_dict, date_array, school_year=None):
    """
    Write servants statistics into the dedicated statistics spreadsheet.

    Args:
        stats_spreadsheet: the statistics spreadsheet (NOT the attendance one).
    """
    try:
        if not date_array or not servant_dict:
            return False

        worksheet = statistics_export.get_stats_worksheet(stats_spreadsheet)

        return attendance_statistics.write_statistics_worksheet(
            worksheet,
            build_servants_sections(servant_dict, date_array),
            title="SERVANTS MEETING ATTENDANCE STATISTICS",
            subtitle=attendance_statistics.build_subtitle(school_year),
        )
    except Exception as e:
        print(f"Error writing servants statistics: {e}")
        return False

def apply_sheet_formatting(sh, servant_names, date_array, servant_dict):
    """Apply formatting to the servants attendance sheet."""
    requests = []

    # Clear all background colors
    requests.append({
        "repeatCell": {
            "range": {
                "sheetId": sh.id,
                "startRowIndex": 0,
                "endRowIndex": len(servant_names) + 1,
                "startColumnIndex": 0,
                "endColumnIndex": len(date_array) + 1
            },
            "cell": {
                "userEnteredFormat": {
                    "backgroundColor": {"red": 1.0, "green": 1.0, "blue": 1.0}
                }
            },
            "fields": "userEnteredFormat.backgroundColor"
        }
    })

    # Bold headers
    requests.extend([
        {
            "repeatCell": {
                "range": {
                    "sheetId": sh.id,
                    "startRowIndex": 0,
                    "endRowIndex": 1,
                    "startColumnIndex": 0,
                    "endColumnIndex": len(date_array) + 1
                },
                "cell": {
                    "userEnteredFormat": {"textFormat": {"bold": True}}
                },
                "fields": "userEnteredFormat.textFormat.bold"
            }
        },
        {
            "repeatCell": {
                "range": {
                    "sheetId": sh.id,
                    "startRowIndex": 0,
                    "endRowIndex": len(servant_names) + 1,
                    "startColumnIndex": 0,
                    "endColumnIndex": 1
                },
                "cell": {
                    "userEnteredFormat": {"textFormat": {"bold": True}}
                },
                "fields": "userEnteredFormat.textFormat.bold"
            }
        }
    ])

    # Color attendance cells
    for row_idx, servant in enumerate(servant_names):
        attendance_dict = dict(servant_dict.get(servant, []))
        for col_idx, date in enumerate(date_array):
            value = attendance_dict.get(date, None)
            color = None
            
            if value is True:
                color = {"red": 0.0, "green": 1.0, "blue": 0.0}
            elif value is False:
                color = {"red": 1.0, "green": 0.0, "blue": 0.0}
            
            if color:
                requests.append({
                    "repeatCell": {
                        "range": {
                            "sheetId": sh.id,
                            "startRowIndex": row_idx + 1,
                            "endRowIndex": row_idx + 2,
                            "startColumnIndex": col_idx + 1,
                            "endColumnIndex": col_idx + 2
                        },
                        "cell": {
                            "userEnteredFormat": {"backgroundColor": color}
                        },
                        "fields": "userEnteredFormat.backgroundColor"
                    }
                })

    if requests:
        sh.spreadsheet.batch_update({"requests": requests})

# === INITIALIZATION FUNCTIONS ===
def initialize_firebase():
    """Initialize Firebase Admin if not already done."""
    try:
        app = firebase_admin.get_app()
        db = firestore.client()
    except ValueError:
        firebase_cred_path = get_file_path('firebase_admin.json')
        
        if not os.path.exists(firebase_cred_path):
            raise FileNotFoundError(f"Firebase credentials file not found at: {firebase_cred_path}")
        
        firebase_cred = firebase_credentials.Certificate(firebase_cred_path)
        firebase_admin.initialize_app(firebase_cred)
        db = firestore.client()
    
    return db

def initialize_google_sheets():
    """Initialize Google Sheets client."""
    try:
        credentials_path = get_file_path("credentials.json")
        
        if not os.path.exists(credentials_path):
            raise FileNotFoundError(f"Google credentials file not found at: {credentials_path}")
        
        sheet_creds = Credentials.from_service_account_file(credentials_path, scopes=GOOGLE_SCOPES)
        client = gspread.authorize(sheet_creds)
        return client, sheet_creds
        
    except Exception as e:
        raise

def process_church(church, church_data, church_name, client, sheet_creds, db):
    """Process a single church's servants attendance sheets."""
    try:
        if 'servantsMeetingSheets' not in church_data:
            return
        
        church_sheet = client.open_by_key(church_data["servantsMeetingSheets"])
        servants_meeting_reference = church.reference.collection("Servants Meeting")
        
        # Set up Google Sheets
        if not sheet_set_up_properly(church_sheet):
            set_up_sheet_pages(church_sheet)
            
        # Get servants data - pass db to lookup names
        servant_dict = get_servants_data(servants_meeting_reference, db)
        if len(servant_dict) > 0:
            date_array = get_dates(find_start_date(servant_dict))
            write_to_sheet(
                church_sheet.worksheet(ATTENDANCE_SHEET_TITLE),
                servant_dict,
                date_array,
                organize_names(servant_dict)
            )
            # NOTE: statistics are NOT written here. They live in a separate
            # spreadsheet built by generate_statistics.py on demand.


        # Handle SharePoint upload for target church
        if church_name == TARGET_CHURCH_NAME:
            handle_sharepoint_upload(church_sheet, church_name, sheet_creds, church)
        else:
            # Update Firestore
            school_year = get_school_year()
            church.reference.update({
                'currentSchoolYear': school_year
            })
        
    except Exception as e:
        pass

def handle_sharepoint_upload(church_sheet, church_name, sheet_creds, church):
    """Handle SharePoint upload for the target church."""
    try:
        ms_access_token = get_microsoft_access_token()
        
        config_path = get_file_path("microsoft_config.json")
        with open(config_path) as f:
            ms_config = json.load(f)
        drive_id = ms_config["sharepoint_drive_id"]
        
        # Export to Excel and upload to SharePoint
        excel_path = export_google_sheet_to_excel(church_sheet, church_name, sheet_creds)
        if excel_path:
            school_year = get_school_year()
            file_name = "servants_attendance.xlsx"
            
            if upload_to_sharepoint(excel_path, file_name, ms_access_token, drive_id):
                # Update Firestore
                church.reference.update({
                    'currentSchoolYear': school_year
                })
            
            # Clean up temp file
            os.remove(excel_path)
            
    except Exception as e:
        pass

# === MAIN FUNCTION ===
def set_up_sheets_servants():
    """Main function to process all churches' servants attendance sheets."""
    try:
        # Initialize services
        db = initialize_firebase()
        client, sheet_creds = initialize_google_sheets()
        
        # Fetch data
        churches = db.collection("churches").get()
        
        # Process each church
        processed_count = 0
        error_count = 0
        
        for church in churches:
            try:
                church_data = church.to_dict()
                church_name = church.id
                
                process_church(church, church_data, church_name, client, sheet_creds, db)
                processed_count += 1
                
            except Exception as e:
                error_count += 1
                continue
        
    except Exception as e:
        raise

if __name__ == "__main__":
    set_up_sheets_servants()