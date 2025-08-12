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
import time
import traceback

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
    """Upload file to SharePoint Teams Sunday School folder, overwriting if exists."""
    try:
        if not os.path.exists(file_path):
            return False
        
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        }
        
        school_year = get_school_year()
        file_path_in_sharepoint = f"General/Attendance%20Reports/{school_year}/{file_name}"
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
        print(f"Error uploading to SharePoint: {e}")
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
        print(f"Error exporting to Excel (trying fallback): {e}")
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
        except Exception as e2:
            print(f"Fallback export also failed: {e2}")
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
    
    # Rename existing worksheets
    for i in range(num_worksheets):
        try:
            worksheet_list[i].update_title(grades[i])
            time.sleep(0.5)  # Small delay to avoid rate limits
        except Exception as e:
            print(f"Error renaming worksheet {i} to {grades[i]}: {e}")
    
    # Add missing worksheets
    for i in range(num_worksheets, len(grades)):
        try:
            sh.add_worksheet(title=grades[i], rows="1000", cols="26")
            time.sleep(0.5)  # Small delay to avoid rate limits
        except Exception as e:
            print(f"Error adding worksheet {grades[i]}: {e}")

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
    try:
        students_docs = sunday_school_reference.document(grade).collection("students").get()
        for student_doc in students_docs:
            student_data = student_doc.to_dict()
            if student_data and "name" in student_data:
                student_dict[student_data["name"]] = interpret_dates(student_data)
    except Exception as e:
        print(f"Error getting students for grade {grade}: {e}")
    return student_dict

def get_grade_key(grade):
    """Convert grade name to the key used in servant documents."""
    grade_key_mapping = {
        'Pre-School - Age 3': 'preSchoolAge3',
        'Pre-School - Age 4': 'preSchoolAge4',
        'Kindergarten': 'kindergarten',
        '1st Grade': '1',
        '2nd Grade': '2',
        '3rd Grade': '3',
        '4th Grade': '4',
        '5th Grade': '5',
        '6th Grade': '6',
        '7th Grade': '7',
        '8th Grade': '8',
        '9th Grade': '9',
        '10th Grade': '10',
        '11th Grade': '11',
        '12th Grade': '12',
        'College': 'college'
    }
    return grade_key_mapping.get(grade, None)

def get_servants_for_grade(sunday_school_reference, grade):
    """Get servants who teach a specific grade."""
    servant_dict = {}
    grade_key = get_grade_key(grade)
    
    if grade_key is None:
        return servant_dict
    
    try:
        servants_docs = sunday_school_reference.document('Servants').collection('Servants').get()
        
        for servant_doc in servants_docs:
            servant_data = servant_doc.to_dict()
            if servant_data:
                servant_name = servant_data.get('name', servant_doc.id)
                
                # Check if this servant teaches this specific grade
                if grade_key in servant_data and servant_data[grade_key] == True:
                    # Get attendance dates for this servant
                    servant_dates = interpret_dates(servant_data)
                    servant_dict[servant_name] = servant_dates
    except Exception as e:
        print(f"Error getting servants for grade {grade}: {e}")
        traceback.print_exc()
    
    return servant_dict

def organize_names(name_dict):
    """Alphabetize the names."""
    names = list(name_dict.keys())
    names.sort()
    return names

def get_start_date(attendance_dict):
    """Find the earliest date in the attendance records."""
    date_format = "%m-%d-%Y"
    start_date = datetime.datetime.max
    today = datetime.datetime.now()

    for records in attendance_dict.values():
        for date_str, _ in records:
            try:
                date_obj = datetime.datetime.strptime(date_str, date_format)
                # Ignore dates in the future
                if date_obj <= today:
                    if date_obj < start_date:
                        start_date = date_obj
            except ValueError:
                continue

    if start_date == datetime.datetime.max:
        # If no valid dates found, start from beginning of school year
        current_year = today.year
        september11 = datetime.datetime(current_year, 9, 11)  # September 11
        
        # If we're before September 11, use last year's September 11
        if today < september11:
            start_date = datetime.datetime(current_year - 1, 9, 11)
        else:
            start_date = september11

    return start_date

def create_date_array(start_date):
    """Create an array of Sunday dates from start to most recent Sunday (or today if Sunday)."""
    # Adjust start_date to the nearest Sunday if not already Sunday
    if start_date.weekday() != 6:  # 6 is Sunday
        # Calculate days until next Sunday
        days_until_sunday = (6 - start_date.weekday()) % 7
        if days_until_sunday == 0:
            days_until_sunday = 7
        start_date = start_date + datetime.timedelta(days=days_until_sunday)

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

def update_sheet_batch(worksheet, student_dict, servant_dict, date_array, student_names, servant_names):
    """Update worksheet using batch update to minimize API calls."""
    try:
        # Prepare all data
        all_values = []
        
        # Student header
        all_values.append(["Student Name"] + date_array)
        
        # Student data
        for student in student_names:
            attendance_dict = dict(student_dict.get(student, []))
            row = [student]
            for date in date_array:
                value = attendance_dict.get(date, None)
                if value is True:
                    row.append("Present")
                elif value is False:
                    row.append("Absent")
                else:
                    row.append("")
            all_values.append(row)
        
        # Add empty rows for separation
        if servant_names:
            all_values.append([])  # Empty row
            all_values.append([])  # Empty row
            
            # Servant header
            all_values.append(["Servant Name"] + date_array)
            
            # Servant data
            for servant in servant_names:
                attendance_dict = dict(servant_dict.get(servant, []))
                row = [servant]
                for date in date_array:
                    value = attendance_dict.get(date, None)
                    if value is True:
                        row.append("Present")
                    elif value is False:
                        row.append("Absent")
                    else:
                        row.append("")
                all_values.append(row)
        
        # Calculate the range needed
        num_rows = len(all_values)
        num_cols = len(date_array) + 1
        
        # Build batch update request
        requests = []
        
        # Clear and resize the sheet
        requests.append({
            "updateSheetProperties": {
                "properties": {
                    "sheetId": worksheet.id,
                    "gridProperties": {
                        "rowCount": max(num_rows + 10, 1000),
                        "columnCount": max(num_cols + 5, 26)
                    }
                },
                "fields": "gridProperties"
            }
        })
        
        # Clear all content and formatting
        requests.append({
            "repeatCell": {
                "range": {
                    "sheetId": worksheet.id,
                    "startRowIndex": 0,
                    "endRowIndex": num_rows + 10,
                    "startColumnIndex": 0,
                    "endColumnIndex": num_cols + 5
                },
                "cell": {
                    "userEnteredValue": {"stringValue": ""},
                    "userEnteredFormat": {
                        "backgroundColor": {"red": 1.0, "green": 1.0, "blue": 1.0},
                        "textFormat": {"bold": False}
                    }
                },
                "fields": "userEnteredValue,userEnteredFormat.backgroundColor,userEnteredFormat.textFormat.bold"
            }
        })
        
        # Update all values at once
        requests.append({
            "updateCells": {
                "range": {
                    "sheetId": worksheet.id,
                    "startRowIndex": 0,
                    "endRowIndex": num_rows,
                    "startColumnIndex": 0,
                    "endColumnIndex": num_cols
                },
                "rows": [
                    {
                        "values": [
                            {"userEnteredValue": {"stringValue": str(cell)}} for cell in row
                        ]
                    } for row in all_values
                ],
                "fields": "userEnteredValue"
            }
        })
        
        # Apply formatting
        servant_start_row = len(student_names) + 3 if servant_names else -1
        
        # Bold headers
        requests.extend([
            # Student header row
            {
                "repeatCell": {
                    "range": {
                        "sheetId": worksheet.id,
                        "startRowIndex": 0,
                        "endRowIndex": 1,
                        "startColumnIndex": 0,
                        "endColumnIndex": num_cols
                    },
                    "cell": {
                        "userEnteredFormat": {"textFormat": {"bold": True}}
                    },
                    "fields": "userEnteredFormat.textFormat.bold"
                }
            },
            # Student name column
            {
                "repeatCell": {
                    "range": {
                        "sheetId": worksheet.id,
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
        
        # Bold servant headers if present
        if servant_names:
            requests.extend([
                # Servant header row
                {
                    "repeatCell": {
                        "range": {
                            "sheetId": worksheet.id,
                            "startRowIndex": servant_start_row,
                            "endRowIndex": servant_start_row + 1,
                            "startColumnIndex": 0,
                            "endColumnIndex": num_cols
                        },
                        "cell": {
                            "userEnteredFormat": {"textFormat": {"bold": True}}
                        },
                        "fields": "userEnteredFormat.textFormat.bold"
                    }
                },
                # Servant name column
                {
                    "repeatCell": {
                        "range": {
                            "sheetId": worksheet.id,
                            "startRowIndex": servant_start_row,
                            "endRowIndex": servant_start_row + len(servant_names) + 1,
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
        
        # Color attendance cells for students
        for row_idx, student in enumerate(student_names):
            attendance_dict = dict(student_dict.get(student, []))
            for col_idx, date in enumerate(date_array):
                value = attendance_dict.get(date, None)
                if value is not None:
                    color = {"red": 0.0, "green": 1.0, "blue": 0.0} if value else {"red": 1.0, "green": 0.0, "blue": 0.0}
                    requests.append({
                        "repeatCell": {
                            "range": {
                                "sheetId": worksheet.id,
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
        
        # Color attendance cells for servants
        if servant_names:
            for row_idx, servant in enumerate(servant_names):
                attendance_dict = dict(servant_dict.get(servant, []))
                for col_idx, date in enumerate(date_array):
                    value = attendance_dict.get(date, None)
                    if value is not None:
                        color = {"red": 0.0, "green": 1.0, "blue": 0.0} if value else {"red": 1.0, "green": 0.0, "blue": 0.0}
                        requests.append({
                            "repeatCell": {
                                "range": {
                                    "sheetId": worksheet.id,
                                    "startRowIndex": servant_start_row + row_idx + 1,
                                    "endRowIndex": servant_start_row + row_idx + 2,
                                    "startColumnIndex": col_idx + 1,
                                    "endColumnIndex": col_idx + 2
                                },
                                "cell": {
                                    "userEnteredFormat": {"backgroundColor": color}
                                },
                                "fields": "userEnteredFormat.backgroundColor"
                            }
                        })
        
        # Execute batch update
        worksheet.spreadsheet.batch_update({"requests": requests})
        
        # Add a small delay after batch update
        time.sleep(1)
        
        return True
        
    except Exception as e:
        print(f"Error in batch update: {e}")
        traceback.print_exc()
        return False

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
    """Process a single church's attendance sheets including servants."""
    if 'sundaySchoolSheets' not in church_data:
        return
        
    try:
        church_sheet = client.open_by_key(church_data["sundaySchoolSheets"])
        sunday_school_reference = church.reference.collection("Sunday School")
        
        # Set up Google Sheets
        if not sheet_set_up_properly(church_sheet, GRADES):
            set_up_sheet_pages(church_sheet, GRADES)
            
        # Process each grade with rate limiting
        for idx, grade in enumerate(GRADES):
            try:
                
                # Add delay between grades to avoid rate limits
                if idx > 0:
                    time.sleep(2)  # 2 second delay between grades
                
                # Get students
                student_dict = get_student_names(sunday_school_reference, grade)
                
                # Get servants for this grade
                servant_dict = get_servants_for_grade(sunday_school_reference, grade)
                
                # Process if there are students or servants
                if len(student_dict) > 0 or len(servant_dict) > 0:
                    # Determine date array based on all attendance records
                    all_attendance = {**student_dict, **servant_dict}
                    date_array = create_date_array(get_start_date(all_attendance))
                    
                    # Sort names
                    student_names = organize_names(student_dict)
                    servant_names = organize_names(servant_dict)
                    
                    # Update the sheet using batch update
                    worksheet = church_sheet.worksheet(grade)
                    if update_sheet_batch(worksheet, student_dict, servant_dict, date_array, student_names, servant_names):
                        pass
                    else:
                        print(f"Failed to update {grade}")
                else:
                    print(f"No data found for {grade}")
                    
            except Exception as e:
                print(f"Error processing grade {grade}: {e}")
                traceback.print_exc()
                # Continue with next grade even if this one fails
                continue
        
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
        print(f"Error processing church {church_name}: {e}")
        traceback.print_exc()

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
            file_name = "attendance.xlsx"
            
            if upload_to_sharepoint(excel_path, file_name, ms_access_token, drive_id):
                # Update Firestore
                church.reference.update({
                    'currentSchoolYear': school_year
                })
            else:
                print(f"Failed to upload to SharePoint for {church_name}")
            
            # Clean up temp file
            try:
                os.remove(excel_path)
            except:
                pass
    except Exception as e:
        traceback.print_exc()

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