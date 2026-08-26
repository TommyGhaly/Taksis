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
import hashlib
import attendance_statistics
import statistics_export

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

# This spreadsheet holds attendance only - one worksheet per grade, nothing
# else. Statistics live in their own spreadsheet, built by
# generate_statistics.py; see statistics_export.py.
SHEET_TITLES = list(GRADES)

TARGET_CHURCH_NAME = "St. Philopater and St. Mina, Wayland, MA"

GOOGLE_SCOPES = [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive'
]

# Optimized performance tuning
MAX_WORKERS = 8  # For parallel data fetching
BATCH_SIZE = 1000  # Larger batch size
RATE_LIMIT_DELAY = 0.1  # Reduced delay
MAX_RETRIES = 2  # Reduced retries for speed
CHUNK_SIZE = 100  # Larger chunks
MAX_CHURCHES_PARALLEL = 1  # Process churches sequentially to avoid grade mix-ups

# Sheet clearing configuration
MAX_EXPECTED_ROWS = 200  # Maximum expected students + servants per grade
MAX_EXPECTED_COLS = 60   # ~52 weeks + some buffer

# === OPTIMIZED HELPER FUNCTIONS ===
def get_script_dir():
    """Get the directory where this script is located."""
    return os.path.dirname(os.path.abspath(__file__))

def get_file_path(filename):
    """Get absolute path for a file in the same directory as this script."""
    return os.path.join(get_script_dir(), filename)

def retry_with_backoff(func, max_retries=MAX_RETRIES):
    """Optimized retry with minimal backoff."""
    for attempt in range(max_retries):
        try:
            return func()
        except Exception as e:
            if attempt == max_retries - 1:
                raise
            time.sleep(0.1 * (attempt + 1))  # Minimal backoff


def ensure_worksheet_size(worksheet, required_rows, required_cols):
    """
    Expand worksheet if it doesn't have enough rows or columns.
    
    This fixes the issue where worksheets created with only 26 columns (A-Z)
    cannot accommodate more than 26 date columns. This function checks the
    current dimensions and expands the worksheet if necessary.
    
    Args:
        worksheet: The gspread worksheet object to resize
        required_rows: Minimum number of rows needed
        required_cols: Minimum number of columns needed
    """
    try:
        current_rows = worksheet.row_count
        current_cols = worksheet.col_count
        
        needs_resize = False
        new_rows = current_rows
        new_cols = current_cols
        
        # Check if we need more columns (this was the main bug - sheets had only 26 cols)
        if current_cols < required_cols:
            new_cols = required_cols
            needs_resize = True
        
        # Check if we need more rows
        if current_rows < required_rows:
            new_rows = required_rows
            needs_resize = True
        
        # Only make API call if resize is actually needed
        if needs_resize:
            worksheet.resize(rows=new_rows, cols=new_cols)
            time.sleep(RATE_LIMIT_DELAY)
            
    except Exception as e:
        # Log error but don't fail the whole process
        print(f"Error resizing worksheet: {e}")


# === OPTIMIZED DATA STRUCTURES ===
class OptimizedAttendanceCache:
    """Optimized cache with pre-computed data structures."""
    def __init__(self):
        self.student_cache = {}
        self.servant_cache = {}
        self.date_arrays = {}  # Pre-computed date arrays per grade
        self.update_hashes = {}  # Track what needs updating
        self.sheet_dimensions = {}  # Track previous sheet dimensions
    
    def fetch_all_data_batch(self, sunday_school_ref):
        """Fetch all data in optimal batches."""
        # Use larger batches for Firestore reads
        with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
            # Fetch all servants
            servants_future = executor.submit(self._fetch_all_servants_optimized, sunday_school_ref)
            
            # Fetch students for all grades - MAINTAIN ORDER
            grade_futures = {}
            for grade in GRADES:
                future = executor.submit(self._fetch_grade_students_optimized, sunday_school_ref, grade)
                grade_futures[future] = grade
            
            # Process servants result
            try:
                self.servant_cache = servants_future.result()
            except Exception as e:
                self.servant_cache = {}
            
            # Process student results - CORRECTLY MAP TO GRADES
            for future in as_completed(grade_futures):
                grade = grade_futures[future]  # Get the correct grade for this future
                try:
                    self.student_cache[grade] = future.result()
                    # Pre-compute date array for this grade
                    if future.result():
                        self.date_arrays[grade] = self._compute_date_array(future.result())
                except Exception as e:
                    self.student_cache[grade] = {}
    
    def _fetch_all_servants_optimized(self, sunday_school_ref):
        """Fetch servants with optimized query."""
        servant_data = {}
        try:
            # Get all servants in one query
            servants_docs = (sunday_school_ref.document('Servants')
                           .collection('Servants')
                           .limit(500)  # Reasonable limit
                           .get())
            
            for doc in servants_docs:
                data = doc.to_dict()
                if data and data.get('name'):
                    # Pre-process servant grades
                    servant_data[doc.id] = self._preprocess_servant_data(data)
        except Exception as e:
            pass
        return servant_data
    
    def _fetch_grade_students_optimized(self, sunday_school_ref, grade):
        """Fetch students with pre-processing."""
        student_dict = {}
        try:
            students_docs = (sunday_school_ref.document(grade)
                           .collection("students")
                           .limit(200)  # Reasonable limit per grade
                           .get())
            
            for student_doc in students_docs:
                student_data = student_doc.to_dict()
                if student_data and "name" in student_data:
                    # Pre-process dates
                    student_dict[student_data["name"]] = self._preprocess_dates(student_data)
        except Exception as e:
            pass
        return student_dict
    
    def _preprocess_servant_data(self, data):
        """Pre-process servant data for faster lookup."""
        processed = {'name': data.get('name', ''), 'grades': [], 'dates': {}}
        
        # Pre-compute which grades this servant teaches
        grade_key_mapping = {
            'Pre-School - Age 3': 'preSchoolAge3',
            'Pre-School - Age 4': 'preSchoolAge4',
            'Kindergarten': 'kindergarten',
            '1st Grade': '1', '2nd Grade': '2', '3rd Grade': '3',
            '4th Grade': '4', '5th Grade': '5', '6th Grade': '6',
            '7th Grade': '7', '8th Grade': '8', '9th Grade': '9',
            '10th Grade': '10', '11th Grade': '11', '12th Grade': '12',
            'College': 'college'
        }
        
        for grade, key in grade_key_mapping.items():
            if data.get(key) == True:
                processed['grades'].append(grade)
        
        # Pre-process dates
        processed['dates'] = self._preprocess_dates(data)
        return processed
    
    def _preprocess_dates(self, data):
        """Convert date strings to dict for O(1) lookup."""
        dates = {}
        for key, value in data.items():
            try:
                datetime.datetime.strptime(key, "%m-%d-%Y")
                dates[key] = value
            except ValueError:
                continue
        return dates
    
    def _compute_date_array(self, attendance_dict):
        """Pre-compute date array for a grade."""
        if not attendance_dict:
            return []
        
        # Find earliest date
        date_format = "%m-%d-%Y"
        dates = []
        
        for person_data in attendance_dict.values():
            for date_str in person_data.keys():
                try:
                    date_obj = datetime.datetime.strptime(date_str, date_format)
                    dates.append(date_obj)
                except ValueError:
                    continue
        
        if not dates:
            return create_date_array(datetime.datetime.now())
        
        return create_date_array(min(dates))
    
    def get_servants_for_grade_optimized(self, grade):
        """Get servants for a grade using pre-processed data."""
        servant_dict = {}
        for servant_id, servant_data in self.servant_cache.items():
            if grade in servant_data['grades']:
                servant_dict[servant_data['name']] = servant_data['dates']
        return servant_dict
    
    def compute_update_hash(self, grade, student_dict, servant_dict):
        """Compute hash to check if data has changed."""
        data_str = json.dumps({
            'students': sorted([(k, sorted(v.items())) for k, v in student_dict.items()]),
            'servants': sorted([(k, sorted(v.items())) for k, v in servant_dict.items()])
        }, sort_keys=True)
        return hashlib.md5(data_str.encode()).hexdigest()

# === OPTIMIZED SHEET OPERATIONS ===
def create_all_values_optimized(student_dict, servant_dict, date_array):
    """Pre-create all values for a worksheet."""
    all_values = []
    
    # Sort names once
    student_names = sorted(student_dict.keys())
    servant_names = sorted(servant_dict.keys())
    
    # Header
    all_values.append(["Student Name"] + date_array)
    
    # Students - optimized with list comprehension
    for student in student_names:
        attendance = student_dict.get(student, {})
        row = [student] + [
            "Present" if attendance.get(date) is True else
            "Absent" if attendance.get(date) is False else ""
            for date in date_array
        ]
        all_values.append(row)
    
    # Servants
    if servant_names:
        all_values.extend([[], []])  # Empty rows
        all_values.append(["Servant Name"] + date_array)
        
        for servant in servant_names:
            attendance = servant_dict.get(servant, {})
            row = [servant] + [
                "Present" if attendance.get(date) is True else
                "Absent" if attendance.get(date) is False else ""
                for date in date_array
            ]
            all_values.append(row)
    
    return all_values, len(student_names), len(servant_names)

def update_sheet_ultra_fast(worksheet, all_values, num_students, num_servants):
    """Ultra-fast sheet update with smart clearing."""
    try:
        num_rows = len(all_values)
        num_cols = len(all_values[0]) if all_values else 0
        
        # Define a reasonable maximum area that could have previous data
        # Adjust these based on your typical max class sizes
        MAX_EXPECTED_ROWS = 200  # Adjust based on your largest classes
        MAX_EXPECTED_COLS = 60   # ~52 weeks + buffer
        
        requests = []
        
        # 1. First, clear the entire expected area to white/blank
        requests.append({
            "repeatCell": {
                "range": {
                    "sheetId": worksheet.id,
                    "startRowIndex": 0,
                    "endRowIndex": MAX_EXPECTED_ROWS,
                    "startColumnIndex": 0,
                    "endColumnIndex": MAX_EXPECTED_COLS
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
        
        # 2. Now write our current data
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
                            {"userEnteredValue": {"stringValue": str(cell)}} 
                            for cell in row
                        ]
                    } for row in all_values
                ],
                "fields": "userEnteredValue"
            }
        })
        
        # 3. Apply formatting for headers
        requests.append({
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
        })
        
        # 4. Bold the name columns
        requests.append({
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
        })
        
        # 5. Apply attendance colors (green/red)
        color_requests = create_color_formatting_requests(
            worksheet, all_values, num_students, num_servants, num_cols
        )
        requests.extend(color_requests)
        
        # Execute single batch update
        retry_with_backoff(lambda: worksheet.spreadsheet.batch_update({"requests": requests}))
        return True
        
    except Exception as e:
        return False

def create_color_formatting_requests(worksheet, all_values, num_students, num_servants, num_cols):
    """Create color formatting requests for attendance marks."""
    requests = []
    
    # Color student attendance
    for row_idx in range(1, num_students + 1):  # Skip header
        for col_idx in range(1, num_cols):  # Skip name column
            cell_value = all_values[row_idx][col_idx]
            if cell_value == "Present":
                color = {"red": 0.0, "green": 1.0, "blue": 0.0}  # Green
            elif cell_value == "Absent":
                color = {"red": 1.0, "green": 0.0, "blue": 0.0}  # Red
            else:
                continue  # Skip empty cells
            
            requests.append({
                "repeatCell": {
                    "range": {
                        "sheetId": worksheet.id,
                        "startRowIndex": row_idx,
                        "endRowIndex": row_idx + 1,
                        "startColumnIndex": col_idx,
                        "endColumnIndex": col_idx + 1
                    },
                    "cell": {
                        "userEnteredFormat": {"backgroundColor": color}
                    },
                    "fields": "userEnteredFormat.backgroundColor"
                }
            })
    
    # Color servant attendance if present
    if num_servants > 0:
        servant_start_row = num_students + 3
        
        # Bold servant header
        requests.append({
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
        })
        
        # Bold servant names
        requests.append({
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
        })
        
        # Color servant attendance
        for row_idx in range(servant_start_row + 1, servant_start_row + num_servants + 1):
            for col_idx in range(1, num_cols):
                if row_idx < len(all_values):
                    cell_value = all_values[row_idx][col_idx]
                    if cell_value == "Present":
                        color = {"red": 0.0, "green": 1.0, "blue": 0.0}  # Green
                    elif cell_value == "Absent":
                        color = {"red": 1.0, "green": 0.0, "blue": 0.0}  # Red
                    else:
                        continue
                    
                    requests.append({
                        "repeatCell": {
                            "range": {
                                "sheetId": worksheet.id,
                                "startRowIndex": row_idx,
                                "endRowIndex": row_idx + 1,
                                "startColumnIndex": col_idx,
                                "endColumnIndex": col_idx + 1
                            },
                            "cell": {
                                "userEnteredFormat": {"backgroundColor": color}
                            },
                            "fields": "userEnteredFormat.backgroundColor"
                        }
                    })
    
    return requests

# === OPTIMIZED PROCESSING ===
def process_church_ultra_optimized(church_doc, client, sheet_creds, data_cache):
    """
    Process a church with maximum optimization - FIXED GRADE MAPPING.
    
    This function handles the main processing loop for each church, including:
    - Setting up worksheets in correct order
    - Fetching and organizing attendance data
    - Writing data to Google Sheets with proper formatting
    - Uploading to SharePoint for the target church
    """
    church_data = church_doc.to_dict()
    church_name = church_doc.id
    
    if 'sundaySchoolSheets' not in church_data:
        return church_name, False
    
    try:
        church_sheet = client.open_by_key(church_data["sundaySchoolSheets"])
        
        # Ensure worksheets exist and are in correct order.
        # Statistics is appended LAST so the grade -> worksheet index mapping
        # below is unaffected.
        ensure_worksheets_correct_order(church_sheet, SHEET_TITLES)

        # Process all grades - SEQUENTIALLY to avoid mix-ups
        success_count = 0
        total_grades_with_data = 0

        for grade_index, grade in enumerate(GRADES):
            try:
                resolved = resolve_grade_data(data_cache, grade)
                if resolved is None:
                    continue

                student_dict, servant_dict, date_array = resolved
                total_grades_with_data += 1

                # Create all values
                all_values, num_students, num_servants = create_all_values_optimized(
                    student_dict, servant_dict, date_array
                )
                
                # CRITICAL: Get worksheet by INDEX, not by title
                # This ensures we're updating the correct worksheet
                worksheets = church_sheet.worksheets()
                if grade_index < len(worksheets):
                    worksheet = worksheets[grade_index]
                    
                    # Verify the worksheet title matches the grade
                    if worksheet.title != grade:
                        # Try to get by title as fallback
                        try:
                            worksheet = church_sheet.worksheet(grade)
                        except:
                            continue
                    
                    # FIX: Ensure worksheet has enough columns for all date data
                    # This is the critical fix - worksheets were created with only 26 columns (A-Z)
                    # but we need enough columns for: 1 name column + all date columns
                    # Adding buffer of 10 rows and 5 columns for safety
                    required_rows = len(all_values) + 10
                    required_cols = len(all_values[0]) + 5 if all_values else MAX_EXPECTED_COLS
                    ensure_worksheet_size(worksheet, required_rows, required_cols)
                    
                    # Update the sheet
                    if update_sheet_ultra_fast(worksheet, all_values, num_students, num_servants):
                        success_count += 1
                    
            except Exception as e:
                pass

        # Update school year
        school_year = get_school_year()
        church_doc.reference.update({'currentSchoolYear': school_year})

        # NOTE: statistics are NOT written here. They live in a separate
        # spreadsheet built by generate_statistics.py on demand.

        # Handle SharePoint for target church
        if church_name == TARGET_CHURCH_NAME:
            with ThreadPoolExecutor(max_workers=1) as executor:
                executor.submit(
                    handle_sharepoint_upload_optimized,
                    church_sheet.id, church_name, sheet_creds
                )
        
        return church_name, success_count == total_grades_with_data
        
    except Exception as e:
        return church_name, False

def resolve_grade_data(data_cache, grade):
    """
    Pull one grade's students, servants and week columns out of the cache.

    Shared by the weekly sheet export and the on-demand statistics script so
    both see exactly the same rows and the same date range.

    Returns:
        (student_dict, servant_dict, date_array), or None when the grade has
        nobody in it.
    """
    student_dict = data_cache.student_cache.get(grade, {})
    servant_dict = data_cache.get_servants_for_grade_optimized(grade)

    if not student_dict and not servant_dict:
        return None

    date_array = data_cache.date_arrays.get(grade, [])
    if not date_array:
        all_attendance = {**student_dict, **servant_dict}
        date_array = create_date_array(get_start_date_optimized(all_attendance))

    return student_dict, servant_dict, date_array


def collect_stats_input(data_cache, date_array=None):
    """
    Resolve every grade that has data, in GRADES order.

    Args:
        date_array: when given, every grade is measured over this exact set of
            weeks instead of its own earliest-record-to-now range. Statistics
            always pass one, because otherwise each grade gets a different
            denominator - 45 weeks for one, 70 for another - and the
            percentages cannot be compared across grades.

    Returns:
        list of (grade, student_dict, servant_dict, date_array).
    """
    stats_input = []
    for grade in GRADES:
        resolved = resolve_grade_data(data_cache, grade)
        if resolved is None:
            continue
        student_dict, servant_dict, grade_dates = resolved
        stats_input.append(
            (grade, student_dict, servant_dict, date_array or grade_dates)
        )
    return stats_input


def build_sunday_school_sections(stats_input):
    """
    Turn the per-grade attendance data into statistics sections.

    Args:
        stats_input: list of (grade, student_dict, servant_dict, date_array).
            The dicts map name -> {"MM-DD-YYYY": bool}, exactly as they are
            written to the grade worksheets.

    Returns:
        Sections ready for attendance_statistics.write_statistics_worksheet,
        one per grade that actually has people in it, in GRADES order.
    """
    sections = []
    for grade, student_dict, servant_dict, date_array in stats_input:
        if not date_array:
            continue
        sections.append({
            "title": grade,
            "blocks": [
                ("Students", attendance_statistics.build_person_rows(student_dict, date_array)),
                ("Servants", attendance_statistics.build_person_rows(servant_dict, date_array)),
            ],
            "summary_label": "%s — Grade Average" % grade,
        })
    return sections


def write_sunday_school_statistics(stats_spreadsheet, stats_input, school_year=None,
                                   worksheet_title=None, title=None):
    """
    Write Sunday School statistics into the dedicated statistics spreadsheet.

    Args:
        stats_spreadsheet: the statistics spreadsheet (NOT the attendance one).
        stats_input: output of collect_stats_input.
        worksheet_title: which tab to write to; defaults to "Statistics".
    """
    try:
        sections = build_sunday_school_sections(stats_input)
        if not sections:
            return False

        worksheet = statistics_export.get_stats_worksheet(
            stats_spreadsheet, worksheet_title
        )

        return attendance_statistics.write_statistics_worksheet(
            worksheet,
            sections,
            title=title or "SUNDAY SCHOOL ATTENDANCE STATISTICS",
            subtitle=attendance_statistics.build_subtitle(school_year),
            ensure_size=ensure_worksheet_size,
            retry=retry_with_backoff,
        )
    except Exception as e:
        print(f"Error writing Sunday School statistics: {e}")
        return False


def ensure_worksheets_correct_order(sh, grades):
    """
    Ensure worksheets exist and are in the correct order.

    This function checks if the spreadsheet has the correct worksheets
    in the correct order. If not, it recreates them to ensure proper
    grade-to-worksheet mapping.
    """
    worksheet_list = sh.worksheets()
    current_titles = [ws.title for ws in worksheet_list]
    expected = list(grades)

    if current_titles == expected:
        return

    # Everything that exists is already correct and we are only missing the
    # tail - append it instead of tearing the whole spreadsheet down, which
    # would discard sheets that are perfectly fine.
    if len(current_titles) < len(expected) and current_titles == expected[:len(current_titles)]:
        for i in range(len(current_titles), len(expected)):
            sh.add_worksheet(title=expected[i], rows=MAX_EXPECTED_ROWS, cols=MAX_EXPECTED_COLS)
            time.sleep(RATE_LIMIT_DELAY)
        return

    # Every grade is present and correct, but there are extra worksheets after
    # them - drop just those. This is how a Statistics tab left behind by an
    # earlier version gets cleaned up, without rebuilding the grade sheets.
    if len(current_titles) > len(expected) and current_titles[:len(expected)] == expected:
        for ws in worksheet_list[len(expected):]:
            try:
                sh.del_worksheet(ws)
                time.sleep(RATE_LIMIT_DELAY)
            except:
                pass
        return

    # Otherwise the order is genuinely wrong - rebuild from scratch.

    # Delete all worksheets except the first one (can't delete all)
    if len(worksheet_list) > 1:
        for ws in worksheet_list[1:]:
            try:
                sh.del_worksheet(ws)
                time.sleep(RATE_LIMIT_DELAY)
            except:
                pass

    # Rename the first worksheet
    worksheet_list[0].update_title(expected[0])
    time.sleep(RATE_LIMIT_DELAY)

    # Add the rest in order with proper dimensions
    # FIX: Use MAX_EXPECTED_COLS (60) instead of hardcoded 26
    for i in range(1, len(expected)):
        sh.add_worksheet(title=expected[i], rows=MAX_EXPECTED_ROWS, cols=MAX_EXPECTED_COLS)
        time.sleep(RATE_LIMIT_DELAY)

def set_up_sheet_pages_fast(sh, grades):
    """
    Fast sheet setup with batch operations - ensures correct order.
    
    This function uses batch operations to rename existing worksheets
    and creates new ones as needed with proper dimensions.
    """
    worksheet_list = sh.worksheets()
    num_worksheets = len(worksheet_list)
    
    # Batch update existing worksheet titles IN ORDER
    requests = []
    for i in range(min(num_worksheets, len(grades))):
        if i < len(worksheet_list) and worksheet_list[i].title != grades[i]:
            requests.append({
                "updateSheetProperties": {
                    "properties": {
                        "sheetId": worksheet_list[i].id,
                        "title": grades[i]
                    },
                    "fields": "title"
                }
            })
    
    if requests:
        sh.batch_update({"requests": requests})
        time.sleep(RATE_LIMIT_DELAY)
    
    # Add missing worksheets IN ORDER
    # FIX: Use MAX_EXPECTED_COLS instead of 26 to allow more than 26 date columns
    for i in range(num_worksheets, len(grades)):
        sh.add_worksheet(title=grades[i], rows=MAX_EXPECTED_ROWS, cols=MAX_EXPECTED_COLS)
        time.sleep(RATE_LIMIT_DELAY)

def get_start_date_optimized(attendance_dict):
    """Optimized start date calculation."""
    if not attendance_dict:
        return get_default_school_start()
    
    date_format = "%m-%d-%Y"
    min_date = None
    
    for records in attendance_dict.values():
        for date_str in records.keys():
            try:
                date_obj = datetime.datetime.strptime(date_str, date_format)
                if min_date is None or date_obj < min_date:
                    min_date = date_obj
            except ValueError:
                continue
    
    return min_date or get_default_school_start()

def get_default_school_start():
    """Get default school year start date."""
    today = datetime.datetime.now()
    current_year = today.year
    september11 = datetime.datetime(current_year, 9, 11)
    
    if today < september11:
        return datetime.datetime(current_year - 1, 9, 11)
    return september11

def create_date_array(start_date):
    """Optimized date array creation."""
    if start_date.weekday() != 6:
        days_until_sunday = (6 - start_date.weekday()) % 7
        if days_until_sunday == 0:
            days_until_sunday = 7
        start_date = start_date + datetime.timedelta(days=days_until_sunday)
    
    date_array = []
    current_date = start_date
    today = datetime.datetime.now()
    
    # Calculate last Sunday
    if today.weekday() == 6:
        last_sunday = today
    else:
        days_since_sunday = (today.weekday() + 1) % 7
        if days_since_sunday == 0:
            days_since_sunday = 7
        last_sunday = today - datetime.timedelta(days=days_since_sunday)
    
    last_sunday = last_sunday.replace(hour=0, minute=0, second=0, microsecond=0)
    
    # Generate all dates at once
    while current_date <= last_sunday:
        date_array.append(current_date.strftime("%m-%d-%Y"))
        current_date += datetime.timedelta(days=7)
    
    return date_array

def handle_sharepoint_upload_optimized(sheet_id, church_name, sheet_creds):
    """Handle SharePoint upload in an optimized way."""
    try:
        # Re-initialize Google Sheets client for this thread
        client = gspread.authorize(sheet_creds)
        church_sheet = client.open_by_key(sheet_id)
        
        # Get Microsoft token
        ms_access_token = get_microsoft_access_token()
        
        config_path = get_file_path("microsoft_config.json")
        with open(config_path) as f:
            ms_config = json.load(f)
        drive_id = ms_config["sharepoint_drive_id"]
        
        # Export and upload
        excel_path = export_google_sheet_to_excel(church_sheet, church_name, sheet_creds)
        
        if excel_path:
            school_year = get_school_year()
            file_name = "attendance.xlsx"
            
            success = upload_to_sharepoint(excel_path, file_name, ms_access_token, drive_id)
            
            # Clean up
            try:
                os.remove(excel_path)
            except:
                pass
        
    except Exception as e:
        # Don't fail the whole process if SharePoint upload fails
        pass

# === MAIN OPTIMIZED FUNCTION ===
def set_up_sheets():
    """Ultra-optimized main function for Firebase Functions."""
    start_time = time.time()
    
    # Initialize services
    db = initialize_firebase()
    client, sheet_creds = initialize_google_sheets()
    
    # Get all churches
    churches = db.collection("churches").get()
    church_list = list(churches)
    
    # Process churches sequentially to avoid overwhelming APIs
    # (You can still process in parallel if needed, but sequential is safer for grade ordering)
    results = []
    
    for church in church_list:
        try:
            # Create dedicated cache for this church
            cache = OptimizedAttendanceCache()
            sunday_school_ref = church.reference.collection("Sunday School")
            
            # Fetch all data for this church
            cache.fetch_all_data_batch(sunday_school_ref)
            
            # Process church
            church_name, success = process_church_ultra_optimized(
                church, client, sheet_creds, cache
            )
            results.append((church_name, success))
            
        except Exception as e:
            pass
    
    elapsed_time = time.time() - start_time
    successful = sum(1 for _, success in results if success)
    
    return successful, len(results)

# Keep existing helper functions
def get_school_year():
    """Determine the current Sunday School year (starts September 11th)."""
    today = datetime.datetime.now()
    current_year = today.year
    
    school_year_start = datetime.datetime(current_year, 9, 11)
    
    if today < school_year_start:
        return f"{current_year - 1}-{current_year}"
    else:
        return f"{current_year}-{current_year + 1}"

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
        return None

def upload_to_sharepoint(file_path, file_name, access_token, drive_id):
    """Upload file to SharePoint Teams Sunday School folder."""
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
            
        return False
            
    except Exception as e:
        return False

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

if __name__ == "__main__":
    set_up_sheets()