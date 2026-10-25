"""
Student roster snapshot: every Sunday School and Hymns Class student's
profile (name, class, birthday, phone, address, notes) in one workbook,
uploaded to the church's SharePoint (Teams) drive.

Each run writes a new, date-stamped file rather than overwriting the last
one, so the folder keeps a record of who was enrolled at each point. The
yearly run happens inside new_years_cleanup, *before* students are promoted,
so that file captures the year that just ended.

Run by hand with:  python student_roster_export.py
"""

import datetime
import json
import os
import tempfile
from urllib.parse import quote

import requests
from openpyxl import Workbook
from openpyxl.styles import Font
from openpyxl.utils import get_column_letter

from attendance_sheets import (
    GRADES,
    TARGET_CHURCH_NAME,
    get_microsoft_access_token,
    get_file_path,
    initialize_firebase,
)

CLASSES = ["Sunday School", "Hymns Class"]

SHAREPOINT_FOLDER = "General/Student Records"
FILE_NAME = "Student Roster %s.xlsx"

COLUMNS = [
    ("Name", "name", 28),
    ("Class", None, 20),
    ("Birthday", "birthday", 14),
    ("Phone", "phone", 18),
    ("Address", "address", 40),
    ("Notes", "description", 40),
]


def class_sort_key(class_name):
    """Grades in school order, then anything else (Hymns time slots) by name."""
    if class_name in GRADES:
        return (0, GRADES.index(class_name), "")
    return (1, 0, class_name)


def fetch_students(church_ref, collection_name):
    """Return [(class_name, student_dict)] in class order, then by name."""
    rows = []
    for class_doc in church_ref.collection(collection_name).list_documents():
        for student in class_doc.collection("students").stream():
            data = student.to_dict() or {}
            if data.get("name"):
                rows.append((class_doc.id, data))
    rows.sort(key=lambda r: (class_sort_key(r[0]), r[1]["name"].lower()))
    return rows


def build_workbook(church_ref, path):
    """Write one worksheet per class collection. Returns the student count."""
    wb = Workbook()
    wb.remove(wb.active)
    total = 0

    for collection_name in CLASSES:
        ws = wb.create_sheet(collection_name)
        ws.append([title for title, _, _ in COLUMNS])
        for cell in ws[1]:
            cell.font = Font(bold=True)
        ws.freeze_panes = "A2"
        for i, (_, _, width) in enumerate(COLUMNS, start=1):
            ws.column_dimensions[get_column_letter(i)].width = width

        for class_name, data in fetch_students(church_ref, collection_name):
            ws.append([
                class_name if key is None else str(data.get(key) or "")
                for _, key, _ in COLUMNS
            ])
            total += 1

        ws.auto_filter.ref = ws.dimensions

    wb.save(path)
    return total


def upload_to_sharepoint(path, file_name):
    with open(get_file_path("microsoft_config.json")) as f:
        drive_id = json.load(f)["sharepoint_drive_id"]

    remote = quote(f"{SHAREPOINT_FOLDER}/{file_name}")
    url = f"https://graph.microsoft.com/v1.0/drives/{drive_id}/root:/{remote}:/content"
    with open(path, "rb") as f:
        response = requests.put(
            url,
            headers={
                "Authorization": f"Bearer {get_microsoft_access_token()}",
                "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            },
            data=f.read(),
        )
    if response.status_code not in (200, 201):
        raise RuntimeError(
            f"SharePoint upload failed ({response.status_code}): {response.text[:300]}"
        )
    return response.json().get("webUrl")


def export_student_roster():
    """
    Snapshot the target church's students to SharePoint.

    Only TARGET_CHURCH_NAME has a SharePoint drive configured, which matches
    the attendance export. Returns (student_count, sharepoint_url).
    """
    db = initialize_firebase()
    church_ref = db.collection("churches").document(TARGET_CHURCH_NAME)
    file_name = FILE_NAME % datetime.date.today().isoformat()

    with tempfile.TemporaryDirectory() as tmp:
        path = os.path.join(tmp, file_name)
        count = build_workbook(church_ref, path)
        url = upload_to_sharepoint(path, file_name)

    return count, url


if __name__ == "__main__":
    count, url = export_student_roster()
    print(f"Exported {count} students -> {url}")
