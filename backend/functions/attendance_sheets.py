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
from concurrent.futures import ThreadPoolExecutor, as_completed
from functools import partial
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

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

# Performance tuning
MAX_WORKERS = 4  # Parallel processing workers
BATCH_SIZE = 500  # Max cells per batch update
RATE_LIMIT_DELAY = 0.5  # Seconds between API calls
MAX_RETRIES = 3
CHUNK_SIZE = 50  # Students/servants per chunk

# === HELPER FUNCTIONS ===
def get_script_dir():
    """Get the directory where this script is located."""
    return os.path.dirname(os.path.abspath(__file__))

def get_file_path(filename):
    """Get absolute path for a file in the same directory as this script."""
    return os.path.join(get_script_dir(), filename)

def retry_with_backoff(func, max_retries=MAX_RETRIES):
    """Retry function with exponential backoff."""
    for attempt in range(max_retries):
        try:
            return func()
        except Exception as e:
            if attempt == max_retries - 1:
                raise
            wait_time = (2 ** attempt) * RATE_LIMIT_DELAY
            logger.warning(f"Retry {attempt + 1}/{max_retries} after {wait_time}s: {e}")
            time.sleep(wait_time)

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
        
        with open(file_path, "rb") as f:
            file_content = f.read()
        
        response = requests.put(upload_url, headers=headers, data=file_content)
        
        if response.status_code in [200, 201]:
            return True
        elif response.status_code == 423:
            # File locked, try delete and re-upload
            check_url = f"https://graph.microsoft.com/v1.0/drives/{drive_id}/root:/{file_path_in_sharepoint}"
            delete_headers = {"Authorization": f"Bearer {access_token}"}
            
            for retry in range(MAX_RETRIES):
                delete_response = requests.delete(check_url, headers=delete_headers)
                
                if delete_response.status_code == 204:
                    time.sleep(2)
                    response = requests.put(upload_url, headers=headers, data=file_content)
                    if response.status_code in [200, 201]:
                        return True
                        
                elif delete_response.status_code == 423 and retry < MAX_RETRIES - 1:
                    time.sleep(5 * (retry + 1))
                else:
                    break
        
        return False
            
    except Exception as e:
        logger.error(f"Error uploading to SharePoint: {e}")
        return False

# === OPTIMIZED DATA FETCHING ===
class AttendanceDataCache:
    """Cache for attendance data to minimize Firestore reads."""
    def __init__(self):
        self.student_cache = {}
        self.servant_cache = {}
        self.all_servants = None
    
    def get_all_attendance_data(self, sunday_school_ref):
        """Fetch all attendance data in batch operations."""
        # Fetch all servants once
        if self.all_servants is None:
            self.all_servants = self._fetch_all_servants(sunday_school_ref)
        
        # Fetch all students by grade in parallel
        with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
            futures = {
                executor.submit(self._fetch_grade_students, sunday_school_ref, grade): grade 
                for grade in GRADES
            }
            
            for future in as_completed(futures):
                grade = futures[future]
                try:
                    self.student_cache[grade] = future.result()
                except Exception as e:
                    logger.error(f"Error fetching students for {grade}: {e}")
                    self.student_cache[grade] = {}
    
    def _fetch_all_servants(self, sunday_school_ref):
        """Fetch all servant data at once."""
        servant_data = {}
        try:
            servants_docs = sunday_school_ref.document('Servants').collection('Servants').get()
            for doc in servants_docs:
                data = doc.to_dict()
                if data:
                    servant_data[doc.id] = data
        except Exception as e:
            logger.error(f"Error fetching servants: {e}")
        return servant_data
    
    def _fetch_grade_students(self, sunday_school_ref, grade):
        """Fetch all students for a grade."""
        student_dict = {}
        try:
            students_docs = sunday_school_ref.document(grade).collection("students").get()
            for student_doc in students_docs:
                student_data = student_doc.to_dict()
                if student_data and "name" in student_data:
                    student_dict[student_data["name"]] = interpret_dates(student_data)
        except Exception as e:
            logger.error(f"Error getting students for grade {grade}: {e}")
        return student_dict
    
    def get_students_for_grade(self, grade):
        """Get cached students for a grade."""
        return self.student_cache.get(grade, {})
    
    def get_servants_for_grade(self, grade):
        """Get servants who teach a specific grade from cache."""
        if not self.all_servants:
            return {}
        
        servant_dict = {}
        grade_key = get_grade_key(grade)
        
        if grade_key is None:
            return servant_dict
        
        for servant_id, servant_data in self.all_servants.items():
            servant_name = servant_data.get('name', servant_id)
            
            if grade_key in servant_data and servant_data[grade_key] == True:
                servant_dates = interpret_dates(servant_data)
                servant_dict[servant_name] = servant_dates
        
        return servant_dict

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
        logger.error(f"Error exporting to Excel: {e}")
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
    
    # Batch rename existing worksheets
    for i in range(num_worksheets):
        try:
            worksheet_list[i].update_title(grades[i])
            time.sleep(RATE_LIMIT_DELAY)
        except Exception as e:
            logger.error(f"Error renaming worksheet {i} to {grades[i]}: {e}")
    
    # Add missing worksheets
    for i in range(num_worksheets, len(grades)):
        try:
            sh.add_worksheet(title=grades[i], rows="1000", cols="26")
            time.sleep(RATE_LIMIT_DELAY)
        except Exception as e:
            logger.error(f"Error adding worksheet {grades[i]}: {e}")

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
                if date_obj <= today and date_obj < start_date:
                    start_date = date_obj
            except ValueError:
                continue

    if start_date == datetime.datetime.max:
        current_year = today.year
        september11 = datetime.datetime(current_year, 9, 11)
        
        if today < september11:
            start_date = datetime.datetime(current_year - 1, 9, 11)
        else:
            start_date = september11

    return start_date

def create_date_array(start_date):
    """Create an array of Sunday dates from start to most recent Sunday."""
    if start_date.weekday() != 6:
        days_until_sunday = (6 - start_date.weekday()) % 7
        if days_until_sunday == 0:
            days_until_sunday = 7
        start_date = start_date + datetime.timedelta(days=days_until_sunday)

    date_array = []
    current_date = start_date
    today = datetime.datetime.now()
    
    if today.weekday() == 6:
        last_sunday = today
    else:
        days_since_sunday = (today.weekday() + 1) % 7
        if days_since_sunday == 0:
            days_since_sunday = 7
        last_sunday = today - datetime.timedelta(days=days_since_sunday)
    
    last_sunday = last_sunday.replace(hour=0, minute=0, second=0, microsecond=0)

    while current_date <= last_sunday:
        date_array.append(current_date.strftime("%m-%d-%Y"))
        current_date += datetime.timedelta(days=7)

    return date_array

def create_chunked_batch_requests(worksheet, all_values, num_cols):
    """Create batch requests in chunks to avoid timeouts."""
    requests_chunks = []
    current_chunk = []
    
    # Clear and resize request
    current_chunk.append({
        "updateSheetProperties": {
            "properties": {
                "sheetId": worksheet.id,
                "gridProperties": {
                    "rowCount": max(len(all_values) + 10, 1000),
                    "columnCount": max(num_cols + 5, 26)
                }
            },
            "fields": "gridProperties"
        }
    })
    
    # Clear content request
    current_chunk.append({
        "repeatCell": {
            "range": {
                "sheetId": worksheet.id,
                "startRowIndex": 0,
                "endRowIndex": len(all_values) + 10,
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
    
    # Update values in chunks
    for i in range(0, len(all_values), CHUNK_SIZE):
        chunk_end = min(i + CHUNK_SIZE, len(all_values))
        current_chunk.append({
            "updateCells": {
                "range": {
                    "sheetId": worksheet.id,
                    "startRowIndex": i,
                    "endRowIndex": chunk_end,
                    "startColumnIndex": 0,
                    "endColumnIndex": num_cols
                },
                "rows": [
                    {
                        "values": [
                            {"userEnteredValue": {"stringValue": str(cell)}} for cell in row
                        ]
                    } for row in all_values[i:chunk_end]
                ],
                "fields": "userEnteredValue"
            }
        })
        
        # If chunk is getting large, start a new one
        if len(current_chunk) > 10:
            requests_chunks.append(current_chunk)
            current_chunk = []
    
    if current_chunk:
        requests_chunks.append(current_chunk)
    
    return requests_chunks

def update_sheet_batch_optimized(worksheet, student_dict, servant_dict, date_array, student_names, servant_names):
    """Update worksheet using optimized batch updates."""
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
        
        # Add servant data if exists
        if servant_names:
            all_values.extend([[], []])  # Empty rows
            all_values.append(["Servant Name"] + date_array)
            
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
        
        num_cols = len(date_array) + 1
        
        # Create chunked requests
        request_chunks = create_chunked_batch_requests(worksheet, all_values, num_cols)
        
        # Execute chunks with rate limiting
        for chunk in request_chunks:
            retry_with_backoff(lambda: worksheet.spreadsheet.batch_update({"requests": chunk}))
            time.sleep(RATE_LIMIT_DELAY)
        
        # Apply formatting in a separate batch
        formatting_requests = create_formatting_requests(
            worksheet, len(student_names), len(servant_names), 
            num_cols, student_dict, servant_dict, date_array
        )
        
        for i in range(0, len(formatting_requests), 50):
            chunk = formatting_requests[i:i+50]
            retry_with_backoff(lambda: worksheet.spreadsheet.batch_update({"requests": chunk}))
            time.sleep(RATE_LIMIT_DELAY)
        
        return True
        
    except Exception as e:
        logger.error(f"Error in batch update: {e}")
        traceback.print_exc()
        return False

def create_formatting_requests(worksheet, num_students, num_servants, num_cols, student_dict, servant_dict, date_array):
    """Create formatting requests separately to avoid large batches."""
    requests = []
    servant_start_row = num_students + 3 if num_servants > 0 else -1
    
    # Bold headers
    requests.extend([
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
        {
            "repeatCell": {
                "range": {
                    "sheetId": worksheet.id,
                    "startRowIndex": 0,
                    "endRowIndex": num_students + 1,
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
    
    # Servant headers if present
    if num_servants > 0:
        requests.extend([
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
            {
                "repeatCell": {
                    "range": {
                        "sheetId": worksheet.id,
                        "startRowIndex": servant_start_row,
                        "endRowIndex": servant_start_row + num_servants + 1,
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
    
    # Color coding for attendance - batch by rows to reduce request count
    student_names = organize_names(student_dict)
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
    
    # Servant attendance colors
    if num_servants > 0:
        servant_names = organize_names(servant_dict)
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
    
    return requests

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

def process_grades_parallel(church_sheet, data_cache, grades_to_process):
    """Process multiple grades in parallel."""
    results = {}
    
    with ThreadPoolExecutor(max_workers=min(MAX_WORKERS, len(grades_to_process))) as executor:
        futures = {}
        
        for grade in grades_to_process:
            # Get data from cache
            student_dict = data_cache.get_students_for_grade(grade)
            servant_dict = data_cache.get_servants_for_grade(grade)
            
            if len(student_dict) > 0 or len(servant_dict) > 0:
                future = executor.submit(
                    process_single_grade,
                    church_sheet, grade, student_dict, servant_dict
                )
                futures[future] = grade
        
        # Collect results
        for future in as_completed(futures):
            grade = futures[future]
            try:
                results[grade] = future.result()
            except Exception as e:
                logger.error(f"Error processing grade {grade}: {e}")
                results[grade] = False
    
    return results

def process_single_grade(church_sheet, grade, student_dict, servant_dict):
    """Process a single grade's attendance."""
    try:
        # Determine date array
        all_attendance = {**student_dict, **servant_dict}
        date_array = create_date_array(get_start_date(all_attendance))
        
        # Sort names
        student_names = organize_names(student_dict)
        servant_names = organize_names(servant_dict)
        
        # Update the sheet
        worksheet = church_sheet.worksheet(grade)
        return update_sheet_batch_optimized(
            worksheet, student_dict, servant_dict, 
            date_array, student_names, servant_names
        )
    except Exception as e:
        logger.error(f"Error in process_single_grade for {grade}: {e}")
        return False

def process_church_optimized(church, church_data, church_name, client, sheet_creds):
    """Process a single church's attendance sheets with optimization."""
    if 'sundaySchoolSheets' not in church_data:
        return
        
    try:
        church_sheet = client.open_by_key(church_data["sundaySchoolSheets"])
        sunday_school_reference = church.reference.collection("Sunday School")
        
        # Set up Google Sheets if needed
        if not sheet_set_up_properly(church_sheet, GRADES):
            set_up_sheet_pages(church_sheet, GRADES)
        
        # Create data cache and fetch all data at once
        logger.info(f"Fetching all data for {church_name}")
        data_cache = AttendanceDataCache()
        data_cache.get_all_attendance_data(sunday_school_reference)
        
        # Process grades in parallel batches
        logger.info(f"Processing grades for {church_name}")
        for i in range(0, len(GRADES), MAX_WORKERS):
            batch = GRADES[i:i+MAX_WORKERS]
            results = process_grades_parallel(church_sheet, data_cache, batch)
            
            # Log results
            for grade, success in results.items():
                if success:
                    logger.info(f"Successfully updated {grade}")
                else:
                    logger.error(f"Failed to update {grade}")
            
            # Rate limit between batches
            if i + MAX_WORKERS < len(GRADES):
                time.sleep(RATE_LIMIT_DELAY * 2)
        
        # Handle SharePoint upload for target church
        if church_name == TARGET_CHURCH_NAME:
            handle_sharepoint_upload(church_sheet, church_name, sheet_creds, church)
        else:
            # Update Firestore
            school_year = get_school_year()
            church.reference.update({
                'currentSchoolYear': school_year
            })
        
        logger.info(f"Completed processing {church_name}")
        
    except Exception as e:
        logger.error(f"Error processing church {church_name}: {e}")
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
        excel_path = retry_with_backoff(
            lambda: export_google_sheet_to_excel(church_sheet, church_name, sheet_creds)
        )
        
        if excel_path:
            school_year = get_school_year()
            file_name = "attendance.xlsx"
            
            if upload_to_sharepoint(excel_path, file_name, ms_access_token, drive_id):
                logger.info(f"Successfully uploaded to SharePoint for {church_name}")
                church.reference.update({
                    'currentSchoolYear': school_year
                })
            else:
                logger.error(f"Failed to upload to SharePoint for {church_name}")
            
            # Clean up temp file
            try:
                os.remove(excel_path)
            except:
                pass
    except Exception as e:
        logger.error(f"SharePoint upload error: {e}")
        traceback.print_exc()

# === MAIN FUNCTION ===
def set_up_sheets():
    """Main function to process all churches' attendance sheets."""
    start_time = time.time()
    logger.info("Starting attendance sheet processing")
    
    # Initialize services
    db = initialize_firebase()
    client, sheet_creds = initialize_google_sheets()
    
    # Fetch all churches
    churches = db.collection("churches").get()
    
    # Process churches (could be parallelized if needed)
    for church in churches:
        church_data = church.to_dict()
        church_name = church.id
        
        logger.info(f"Processing church: {church_name}")
        process_church_optimized(church, church_data, church_name, client, sheet_creds)
    
    elapsed_time = time.time() - start_time
    logger.info(f"Completed all processing in {elapsed_time:.2f} seconds")

if __name__ == "__main__":
    set_up_sheets()