"""
Student roster snapshot: every Sunday School student's profile (name,
birthday, phone, address, notes) in one workbook, one worksheet per grade,
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

SHAREPOINT_FOLDER = "General/Student Records"
FILE_NAME = "Student Roster %s.xlsx"

COLUMNS = [
    ("Name", "name", 28),
    ("Birthday", "birthday", 14),
    ("Phone", "phone", 18),
    ("Address", "address", 40),
    ("Notes", "description", 40),
]


def fetch_students(grade_ref):
    """Return the grade's student dicts, sorted by name."""
    students = [s.to_dict() or {} for s in grade_ref.collection("students").stream()]
    return sorted(
        (s for s in students if s.get("name")),
        key=lambda s: s["name"].lower(),
    )


def build_workbook(church_ref, path):
    """Write one worksheet per Sunday School grade. Returns the student count."""
    wb = Workbook()
    wb.remove(wb.active)
    total = 0
    sunday_school = church_ref.collection("Sunday School")

    for grade in GRADES:
        ws = wb.create_sheet(grade)
        ws.append([title for title, _, _ in COLUMNS])
        for cell in ws[1]:
            cell.font = Font(bold=True)
        ws.freeze_panes = "A2"
        for i, (_, _, width) in enumerate(COLUMNS, start=1):
            ws.column_dimensions[get_column_letter(i)].width = width

        for data in fetch_students(sunday_school.document(grade)):
            ws.append([str(data.get(key) or "") for _, key, _ in COLUMNS])
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
