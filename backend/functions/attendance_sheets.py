# attendance_sheets.py - Streamlined version

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

# === CONFIGURATION ===
GRADES = [
    'Pre-School - Age 3',
    'Pre-School - Age 4',
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

TARGET_CHURCH_NAME = "St. Philopater and St. Mina, Wayland, MA"

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
    config_path = get_file_path("microsoft_config.json")
    
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
    """Upload file to SharePoint Teams Sunday School folder."""
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    }
    
    school_year = get_school_year()
    upload_url = f"https://graph.microsoft.com/v1.0/drives/{drive_id}/root:/General/Attendance%20Reports/{school_year}/{file_name}:/content"
    
    with open(file_path, "rb") as f:
        response = requests.put(upload_url, headers=headers, data=f.read())
    
    return response.status_code in [200, 201]

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
            
    except Exception:
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
        except Exception:
            return None

def sheet_set_up_properly(sh, grades):
    """Check if the sheet has a worksheet for each grade."""
    worksheet_list = sh.worksheets()
    worksheet_titles = [ws.title for ws in worksheet_list]
    if len(worksheet_list) != len(grades):
        return False
    for grade in grades:
        if grade not in worksheet_titles:
            return False
    return True

def set_up_sheet_pages(sh, grades):
    """Replace the worksheets with the right names then add the remaining manually."""
    worksheet_list = sh.worksheets()
    num_worksheets = len(worksheet_list)
    
    for i in range(num_worksheets):
        worksheet_list[i].update_title(grades[i])
    
    for i in range(num_worksheets, len(grades)):
        sh.add_worksheet(title=grades[i], rows="1000", cols="26")

def interpret_dates(student_data):
    """Extract date entries from student data."""
    dates = []
    for key, value in student_data.items():
        try:
            datetime.datetime.strptime(key, "%m-%d-%Y")
            dates.append((key, value))
        except ValueError:
            continue
    return dates

def get_student_names(sunday_school_reference, grade):
    """Get the students from the sunday school data."""
    student_dict = {}
    students_docs = sunday_school_reference.document(grade).collection("students").get()
    for student_doc in students_docs:
        student_data = student_doc.to_dict()
        student_dict[student_data["name"]] = interpret_dates(student_data)
    return student_dict

def organize_names(student_dict):
    """Alphabetize the names."""
    names = list(student_dict.keys())
    names.sort()
    return names

def get_start_date(student_dict):
    """Find the earliest date in the student records."""
    date_format = "%m-%d-%Y"
    start_date = datetime.datetime.max

    for records in student_dict.values():
        for date_str, _ in records:
            try:
                date_obj = datetime.datetime.strptime(date_str, date_format)
                if date_obj < start_date:
                    start_date = date_obj
            except ValueError:
                continue

    return start_date

def create_date_array(start_date):
    """Create an array of Sunday dates from start to most recent past Sunday."""
    if start_date.weekday() != 6:
        days_to_sunday = (start_date.weekday() + 1) % 7
        start_date = start_date - datetime.timedelta(days=days_to_sunday)

    date_array = []
    current_date = start_date

    today = datetime.datetime.now()
    most_recent_sunday = today - datetime.timedelta(days=(today.weekday() + 1) % 7)
    most_recent_sunday = most_recent_sunday.replace(hour=0, minute=0, second=0, microsecond=0)

    while current_date <= most_recent_sunday:
        date_array.append(current_date.strftime("%m-%d-%Y"))
        current_date += datetime.timedelta(days=7)

    return date_array

def set_attendance_sheet(sh, student_dict, date_array, student_names):
    """Update a worksheet with attendance data and formatting."""
    # Add headers
    sh.update(values=[["Student Name"]], range_name='A1')
    sh.update(values=[date_array], range_name='B1')
    sh.update(values=[[name] for name in student_names], range_name='A2')

    # Prepare attendance values
    attendance_values = []
    for student in student_names:
        attendance_dict = dict(student_dict.get(student, []))
        row = []
        for date in date_array:
            value = attendance_dict.get(date, None)
            if value is True:
                row.append("Present")
            elif value is False:
                row.append("Absent")
            else:
                row.append("")
        attendance_values.append(row)

    sh.update(values=attendance_values, range_name='B2')

    # Apply formatting
    apply_sheet_formatting(sh, student_names, date_array, student_dict)

def apply_sheet_formatting(sh, student_names, date_array, student_dict):
    """Apply formatting to the attendance sheet."""
    requests = []

    # Clear all background colors
    requests.append({
        "repeatCell": {
            "range": {
                "sheetId": sh.id,
                "startRowIndex": 0,
                "endRowIndex": len(student_names) + 1,
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
                    "endRowIndex": len(student_names) + 1,
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
    for row_idx, student in enumerate(student_names):
        attendance_dict = dict(student_dict.get(student, []))
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
        firebase_cred = firebase_credentials.Certificate(firebase_cred_path)
        firebase_admin.initialize_app(firebase_cred)
        db = firestore.client()
    
    return db

def initialize_google_sheets():
    """Initialize Google Sheets client."""
    credentials_path = get_file_path("credentials.json")
    sheet_creds = Credentials.from_service_account_file(credentials_path, scopes=GOOGLE_SCOPES)
    client = gspread.authorize(sheet_creds)
    return client, sheet_creds

def process_church(church, church_data, church_name, client, sheet_creds):
    """Process a single church's attendance sheets."""
    if 'sundaySchoolSheets' not in church_data:
        return
        
    try:
        church_sheet = client.open_by_key(church_data["sundaySchoolSheets"])
        sunday_school_reference = church.reference.collection("Sunday School")
        
        # Set up Google Sheets
        if not sheet_set_up_properly(church_sheet, GRADES):
            set_up_sheet_pages(church_sheet, GRADES)
            
        # Process each grade
        for grade in GRADES:
            student_dict = get_student_names(sunday_school_reference, grade)
            if len(student_dict) > 0:
                set_attendance_sheet(
                    church_sheet.worksheet(grade), 
                    student_dict, 
                    create_date_array(get_start_date(student_dict)), 
                    organize_names(student_dict)
                )
        
        # Handle SharePoint upload for target church
        if church_name == TARGET_CHURCH_NAME:
            handle_sharepoint_upload(church_sheet, church_name, sheet_creds, church)
        else:
            # Update Firestore
            school_year = get_school_year()
            church.reference.update({
                'lastAttendanceSheetUrl': f"https://docs.google.com/spreadsheets/d/{church_sheet.id}",
                'lastAttendanceUpdate': datetime.datetime.now(),
                'currentSchoolYear': school_year
            })
        
    except Exception:
        pass

def handle_sharepoint_upload(church_sheet, church_name, sheet_creds, church):
    """Handle SharePoint upload for the target church."""
    ms_access_token = get_microsoft_access_token()
    
    config_path = get_file_path("microsoft_config.json")
    with open(config_path) as f:
        ms_config = json.load(f)
    drive_id = ms_config["sharepoint_drive_id"]
    
    # Export to Excel and upload to SharePoint
    excel_path = export_google_sheet_to_excel(church_sheet, church_name, sheet_creds)
    if excel_path:
        school_year = get_school_year()
        file_name = f"{church_name}_Attendance.xlsx"
        
        if upload_to_sharepoint(excel_path, file_name, ms_access_token, drive_id):
            # Update Firestore
            church.reference.update({
                'lastAttendanceSheetUrl': f"https://docs.google.com/spreadsheets/d/{church_sheet.id}",
                'lastAttendanceUpdate': datetime.datetime.now(),
                'lastSharePointUpload': datetime.datetime.now(),
                'currentSchoolYear': school_year
            })
        
        # Clean up temp file
        os.remove(excel_path)

# === MAIN FUNCTION ===
def set_up_sheets():
    """Main function to process all churches' attendance sheets."""
    # Initialize services
    db = initialize_firebase()
    client, sheet_creds = initialize_google_sheets()
    
    # Fetch data
    churches = db.collection("churches").get()
    
    # Process each church
    for church in churches:
        church_data = church.to_dict()
        church_name = church.id
        
        process_church(church, church_data, church_name, client, sheet_creds)

if __name__ == "__main__":
    set_up_sheets()