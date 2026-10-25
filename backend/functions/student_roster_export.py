"""
Student roster snapshot: every Sunday School student's profile (name,
birthday, phone, address, notes) in one workbook, one worksheet per grade,
plus an Upcoming Birthdays worksheet, uploaded to the church's SharePoint
(Teams) drive.

Each run writes a new, date-stamped file rather than overwriting the last
one, so the folder keeps a record of who was enrolled at each point. The
yearly run happens inside new_years_cleanup, *before* students are promoted,
so that file captures the year that just ended.

Run by hand with:  python student_roster_export.py
"""

import datetime
import json
import os
import re
import tempfile
from urllib.parse import quote

import requests
from openpyxl import Workbook
from openpyxl.formatting.rule import FormulaRule
from openpyxl.styles import Font, PatternFill
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

BIRTHDAY_COLUMNS = [
    ("Name", 28),
    ("Grade", 20),
    ("Birthday", 14),
    ("Next Birthday", 16),
    ("Days Until", 12),
    ("Turning", 10),
]

DATE_FORMAT = "mm/dd/yyyy"
FONT = "Arial"
SOON_DAYS = 30
SOON_FILL = PatternFill(start_color="FFF2CC", end_color="FFF2CC", fill_type="solid")


MONTHS = {
    name: i
    for i, name in enumerate(
        ["jan", "feb", "mar", "apr", "may", "jun",
         "jul", "aug", "sep", "oct", "nov", "dec"],
        start=1,
    )
}


def parse_birthday(raw):
    """
    Parse the free-text birthday field into a date, or None.

    Parents type these by hand, so the data holds every variation of
    month-first dates: 07-10-2023, 6/9/2016, 02/14/11, June 26 2013,
    Aug/1st/2020, (10/30/2009). None are day-first, so month-first is safe.
    """
    text = re.sub(r"(\d)(st|nd|rd|th)\b", r"\1", str(raw or "").strip("() \t"), flags=re.I)
    parts = [p for p in re.split(r"[\s/\-:,.]+", text) if p]
    if len(parts) != 3:
        return None
    month, day, year = parts
    month = MONTHS.get(month[:3].lower()) if month.isalpha() else month
    try:
        month, day, year = int(month), int(day), int(year)
        if year < 100:
            # Two-digit years: anything later than this year is 19xx.
            year += 2000 if year <= datetime.date.today().year % 100 else 1900
        return datetime.date(year, month, day)
    except (TypeError, ValueError):
        return None


def fetch_students(grade_ref):
    """Return the grade's student dicts, sorted by name."""
    students = [s.to_dict() or {} for s in grade_ref.collection("students").stream()]
    return sorted(
        (s for s in students if s.get("name")),
        key=lambda s: s["name"].lower(),
    )


def add_sheet(wb, title, columns, index=None):
    """A worksheet with a bold, frozen header row and set column widths."""
    ws = wb.create_sheet(title, index)
    ws.append([column[0] for column in columns])
    for cell in ws[1]:
        cell.font = Font(name=FONT, bold=True)
    ws.freeze_panes = "A2"
    for i, column in enumerate(columns, start=1):
        ws.column_dimensions[get_column_letter(i)].width = column[-1]
    return ws


def add_birthday_sheet(wb, birthdays):
    """
    First worksheet: every dated birthday in calendar order. Next Birthday,
    Days Until and Turning are formulas off TODAY(), so the file stays
    current all year rather than freezing on the export date; rows coming
    up within SOON_DAYS are highlighted.
    """
    ws = add_sheet(wb, "Upcoming Birthdays", BIRTHDAY_COLUMNS, index=0)
    birthdays.sort(key=lambda b: (b[2].month, b[2].day, b[0].lower()))

    for r, (name, grade, birthday) in enumerate(birthdays, start=2):
        this_year = f"DATE(YEAR(TODAY()),MONTH(C{r}),DAY(C{r}))"
        ws.append([
            name,
            grade,
            birthday,
            f"=DATE(YEAR(TODAY())+IF({this_year}<TODAY(),1,0),MONTH(C{r}),DAY(C{r}))",
            f"=D{r}-TODAY()",
            f"=YEAR(D{r})-YEAR(C{r})",
        ])
        ws.cell(r, 3).number_format = DATE_FORMAT
        ws.cell(r, 4).number_format = DATE_FORMAT
        ws.cell(r, 5).number_format = "0"
        ws.cell(r, 6).number_format = "0"

    last = len(birthdays) + 1
    ws.conditional_formatting.add(
        f"A2:F{last}",
        FormulaRule(formula=[f"$E2<={SOON_DAYS}"], fill=SOON_FILL),
    )
    ws.auto_filter.ref = f"A1:F{last}"

    note = ws.cell(1, len(BIRTHDAY_COLUMNS) + 2)
    note.value = (
        f"Highlighted: birthday in the next {SOON_DAYS} days. Days Until and "
        "Turning update whenever the file is opened."
    )
    note.font = Font(name=FONT, italic=True)


def build_workbook(church_ref, path):
    """
    Write an Upcoming Birthdays worksheet, then one worksheet per Sunday
    School grade. Returns the student count.
    """
    wb = Workbook()
    wb.remove(wb.active)
    total = 0
    birthdays = []
    sunday_school = church_ref.collection("Sunday School")

    for grade in GRADES:
        ws = add_sheet(wb, grade, COLUMNS)

        for data in fetch_students(sunday_school.document(grade)):
            row = [str(data.get(key) or "") for _, key, _ in COLUMNS]
            # Unparseable birthdays stay as typed rather than being dropped.
            birthday = parse_birthday(data.get("birthday"))
            if birthday:
                row[1] = birthday
                birthdays.append((data["name"], grade, birthday))
            ws.append(row)
            ws.cell(ws.max_row, 2).number_format = DATE_FORMAT
            total += 1

        ws.auto_filter.ref = ws.dimensions

    add_birthday_sheet(wb, birthdays)

    for ws in wb.worksheets:
        for row in ws.iter_rows(min_row=2):
            for cell in row:
                cell.font = Font(name=FONT)

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
