"""
Student roster snapshot: every Sunday School student's profile (name,
birthday, phone, address, notes) in one workbook, one worksheet per grade,
plus Coming Up / All Birthdays worksheets, uploaded to the church's SharePoint
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

COMING_UP_COLUMNS = [
    ("Name", 28),
    ("Grade", 20),
    ("Birthday", 14),
    ("Days Until", 12),
    ("Turning", 10),
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
COMING_UP_COUNT = 15
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


def days_until(birthday, today):
    """
    Days from today to the next birthday. Feb 29 falls on Mar 1 in other
    years, matching what Excel's DATE() does in the sheet's formulas.
    """
    for year in (today.year, today.year + 1):
        try:
            upcoming = birthday.replace(year=year)
        except ValueError:
            upcoming = datetime.date(year, 3, 1)
        if upcoming >= today:
            return (upcoming - today).days


def add_birthday_sheets(wb, birthdays):
    """
    Two worksheets in front of the grades:

    - All Birthdays: every dated birthday, soonest first as of the export.
      Next Birthday, Days Until and Turning are formulas off TODAY(), so they
      stay right whenever the file is opened, not just on the export date.
    - Coming Up: the next COMING_UP_COUNT birthdays, picked by formula from
      All Birthdays, so it is still the *next* ones months after the export,
      when the static order of All Birthdays has drifted.

    Birthdays within SOON_DAYS are highlighted on both.
    """
    today = datetime.date.today()
    birthdays.sort(key=lambda b: (days_until(b[2], today), b[0].lower()))
    last = len(birthdays) + 1

    ws = add_sheet(wb, "All Birthdays", BIRTHDAY_COLUMNS, index=0)
    for r, (name, grade, birthday) in enumerate(birthdays, start=2):
        this_year = f"DATE(YEAR(TODAY()),MONTH(C{r}),DAY(C{r}))"
        ws.append([
            name,
            grade,
            birthday,
            f"=DATE(YEAR(TODAY())+IF({this_year}<TODAY(),1,0),MONTH(C{r}),DAY(C{r}))",
            f"=D{r}-TODAY()",
            f"=YEAR(D{r})-YEAR(C{r})",
            # Hidden tiebreak key, unique per row, for Coming Up's SMALL/MATCH.
            f"=E{r}+ROW()/100000",
        ])
        ws.cell(r, 3).number_format = DATE_FORMAT
        ws.cell(r, 4).number_format = DATE_FORMAT
        ws.cell(r, 5).number_format = DAYS_FORMAT
        ws.cell(r, 6).number_format = "0"
    ws.column_dimensions["G"].hidden = True
    ws.conditional_formatting.add(
        f"A2:F{last}",
        FormulaRule(formula=[f"$E2<={SOON_DAYS}"], fill=SOON_FILL),
    )
    ws.auto_filter.ref = f"A1:F{last}"

    source = "'All Birthdays'!"
    keys = f"{source}$G$2:$G${last}"
    coming = add_sheet(wb, "Coming Up", COMING_UP_COLUMNS, index=0)
    for k in range(1, min(COMING_UP_COUNT, len(birthdays)) + 1):
        r = k + 1
        # Column H (hidden) holds the matched row within All Birthdays.
        pick = lambda col: f"=INDEX({source}${col}$2:${col}${last},$H{r})"
        coming.append([
            pick("A"), pick("B"), pick("C"), pick("E"), pick("F"), None, None,
            f"=MATCH(SMALL({keys},{k}),{keys},0)",
        ])
        coming.cell(r, 3).number_format = DATE_FORMAT
        coming.cell(r, 4).number_format = DAYS_FORMAT
        coming.cell(r, 5).number_format = "0"
    coming.column_dimensions["H"].hidden = True
    coming.conditional_formatting.add(
        f"A2:E{COMING_UP_COUNT + 1}",
        FormulaRule(formula=[f"$D2<={SOON_DAYS}"], fill=SOON_FILL),
    )

    note = coming.cell(1, len(COMING_UP_COLUMNS) + 2)
    note.value = (
        f"The next {COMING_UP_COUNT} birthdays, updated whenever the file is "
        f"opened. Highlighted: within {SOON_DAYS} days. Full list on All Birthdays."
    )
    note.font = Font(name=FONT, italic=True)


def build_workbook(church_ref, path):
    """
    Write Coming Up and All Birthdays worksheets, then one worksheet per
    Sunday School grade. Returns the student count.
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

    add_birthday_sheets(wb, birthdays)

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
