"""
Student roster snapshot: every Sunday School student's profile (name,
birthday, phone, address, notes) in one workbook, one worksheet per grade,
each with an Upcoming Birthdays section, uploaded to the church's SharePoint
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

UPCOMING_COLUMNS = [
    ("Upcoming Birthdays", 28),
    ("Birthday", 14),
    ("Days Until", 12),
    ("Turning", 10),
]

DATE_FORMAT = "mm/dd/yyyy"
FONT = "Arial"
SOON_DAYS = 30
DAYS_FORMAT = '[=0]"Today";0'
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


def style_header(ws, columns, first_col=1):
    for i, (title, width) in enumerate(columns, start=first_col):
        cell = ws.cell(1, i, title)
        cell.font = Font(name=FONT, bold=True)
        ws.column_dimensions[get_column_letter(i)].width = width


def add_grade_sheet(wb, grade, students):
    """
    One grade's worksheet: the student list in A:E, and beside it an
    Upcoming Birthdays section listing the grade's birthdays soonest first.

    The section is ordered by formula off TODAY() (SMALL/MATCH over hidden
    helper columns), not sorted at export time, so it still shows the next
    birthdays when the file is opened months later. Birthdays within
    SOON_DAYS are highlighted; one falling on the day shows "Today".
    """
    ws = wb.create_sheet(grade)
    style_header(ws, [(title, width) for title, _, width in COLUMNS])
    ws.freeze_panes = "A2"

    dated = 0
    for r, data in enumerate(students, start=2):
        row = [str(data.get(key) or "") for _, key, _ in COLUMNS]
        # Unparseable birthdays stay as typed rather than being dropped.
        birthday = parse_birthday(data.get("birthday"))
        if birthday:
            row[1] = birthday
            dated += 1
        for c, value in enumerate(row, start=1):
            ws.cell(r, c, value)
        ws.cell(r, 2).number_format = DATE_FORMAT

        # Hidden helpers L:M: days to the next birthday, and a per-row unique
        # sort key (SMALL skips the "" left for students with no birthday).
        this_year = f"DATE(YEAR(TODAY()),MONTH(B{r}),DAY(B{r}))"
        ws.cell(r, 12, (
            f"=IF(ISNUMBER(B{r}),DATE(YEAR(TODAY())+IF({this_year}<TODAY(),1,0),"
            f'MONTH(B{r}),DAY(B{r}))-TODAY(),"")'
        ))
        ws.cell(r, 13, f'=IF(ISNUMBER(L{r}),L{r}+ROW()/100000,"")')

    last = max(len(students) + 1, 2)
    ws.auto_filter.ref = f"A1:E{last}"

    style_header(ws, UPCOMING_COLUMNS, first_col=7)
    keys = f"$M$2:$M${last}"
    for k in range(1, dated + 1):
        r = k + 1
        # Hidden K: which student row holds the k-th soonest birthday.
        ws.cell(r, 11, f"=MATCH(SMALL({keys},{k}),{keys},0)")
        ws.cell(r, 7, f"=INDEX($A$2:$A${last},$K{r})")
        ws.cell(r, 8, f"=INDEX($B$2:$B${last},$K{r})").number_format = DATE_FORMAT
        ws.cell(r, 9, f"=INDEX($L$2:$L${last},$K{r})").number_format = DAYS_FORMAT
        ws.cell(r, 10, f"=YEAR(TODAY()+I{r})-YEAR(H{r})").number_format = "0"
    if dated:
        ws.conditional_formatting.add(
            f"G2:J{dated + 1}",
            FormulaRule(formula=[f"$I2<={SOON_DAYS}"], fill=SOON_FILL),
        )
    else:
        ws.cell(2, 7, "No birthdays on file").font = Font(name=FONT, italic=True)

    for col in "KLM":
        ws.column_dimensions[col].hidden = True

    note = ws.cell(dated + 3, 7, f"Highlighted: within {SOON_DAYS} days. Updates when opened.")
    note.font = Font(name=FONT, italic=True)
    return len(students)


def build_workbook(church_ref, path):
    """Write one worksheet per Sunday School grade. Returns the student count."""
    wb = Workbook()
    wb.remove(wb.active)
    sunday_school = church_ref.collection("Sunday School")
    total = sum(
        add_grade_sheet(wb, grade, fetch_students(sunday_school.document(grade)))
        for grade in GRADES
    )

    for ws in wb.worksheets:
        for row in ws.iter_rows(min_row=2):
            for cell in row:
                if cell.font.name != FONT:
                    cell.font = Font(name=FONT, italic=cell.font.italic)

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
