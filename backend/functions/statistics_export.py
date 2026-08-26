"""
The dedicated statistics spreadsheets and their Excel exports.

Attendance and statistics are kept in separate Google Spreadsheets, so each
church ends up with four files rather than two:

    attendance.xlsx              <- grades, one worksheet each   (weekly job)
    servants_attendance.xlsx     <- servants grid                (weekly job)
    sunday_school_statistics.xlsx  <- per-student stats          (this module)
    servants_statistics.xlsx       <- per-servant stats          (this module)

You create the two statistics spreadsheets by hand and register them once;
their IDs are then stored on the church document and reused forever after.

That manual step is not an oversight. The service account cannot create them:
a service account has no Drive storage quota of its own, so anything it tries
to create fails with "The user's Drive storage quota has been exceeded". Files
have to be owned by a real account (or a Shared Drive) and shared with the
service account - which is exactly how the existing attendance spreadsheets
are set up. Run with --register-sunday-school / --register-servants to attach
one; see missing_sheet_help() for the full walkthrough.

Everything here is driven by generate_statistics.py. The weekly export job
does not touch these files.
"""

import json
import os
import re
import tempfile

from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload


# === CHURCH DOCUMENT FIELDS ===
# Where each spreadsheet's ID is remembered, alongside the existing
# "sundaySchoolSheets" / "servantsMeetingSheets" attendance fields.
SUNDAY_SCHOOL_STATS_FIELD = "sundaySchoolStatsSheets"
SERVANTS_STATS_FIELD = "servantsMeetingStatsSheets"

# Source attendance spreadsheets, used to seed sharing on a new stats file.
SUNDAY_SCHOOL_SOURCE_FIELD = "sundaySchoolSheets"
SERVANTS_SOURCE_FIELD = "servantsMeetingSheets"

# === SHAREPOINT FILENAMES ===
SUNDAY_SCHOOL_STATS_FILENAME = "sunday_school_statistics.xlsx"
SERVANTS_STATS_FILENAME = "servants_statistics.xlsx"

# === SPREADSHEET NAMING ===
SUNDAY_SCHOOL_STATS_TITLE = "%s - Sunday School Statistics"
SERVANTS_STATS_TITLE = "%s - Servants Meeting Statistics"

STATS_WORKSHEET_TITLE = "Statistics"

# Wide enough for the statistics columns with a little slack.
STATS_ROWS = 1000
STATS_COLS = 20


PRIOR_YEAR_WORKSHEET_TITLE = "Previous Year"


def get_stats_worksheet(spreadsheet, title=None):
    """
    Return the worksheet the statistics are written to, creating it if needed.

    A freshly created spreadsheet has a single default worksheet; rename that
    rather than adding a second one and leaving an empty "Sheet1" behind.
    """
    title = title or STATS_WORKSHEET_TITLE
    try:
        return spreadsheet.worksheet(title)
    except Exception:
        pass

    worksheets = spreadsheet.worksheets()
    if len(worksheets) == 1 and worksheets[0].title.startswith("Sheet"):
        worksheets[0].update_title(title)
        return worksheets[0]

    return spreadsheet.add_worksheet(title=title, rows=STATS_ROWS, cols=STATS_COLS)


def extract_spreadsheet_id(value):
    """
    Accept either a bare spreadsheet ID or a full Google Sheets URL.

    Pasting the URL straight out of the browser is the obvious thing to do,
    so handle it rather than making people dig the ID out by hand.
    """
    value = (value or "").strip()
    marker = "/spreadsheets/d/"
    if marker in value:
        value = value.split(marker, 1)[1]
        value = value.split("/", 1)[0]
        value = value.split("?", 1)[0].split("#", 1)[0]
    return value


def get_service_account_email(credentials_path):
    """The address a statistics spreadsheet has to be shared with."""
    try:
        with open(credentials_path) as f:
            return json.load(f).get("client_email", "(unknown)")
    except Exception:
        return "(see credentials.json)"


def missing_sheet_help(church_name, kind, title, service_account_email, register_flag):
    """
    Explain how to set up a statistics spreadsheet.

    Printed instead of a bare failure, because the setup is a one-time manual
    step and the reason for it is not obvious.
    """
    return "\n".join([
        "  ⚠️  No %s statistics spreadsheet registered for this church." % kind,
        "",
        "     The service account cannot create one - it has no Drive storage of",
        "     its own. Create it yourself, the same way the attendance sheets were:",
        "",
        "       1. Create a new Google Sheet (ideally in the account that already",
        "          owns the attendance sheets). Suggested name:",
        "            %s" % (title % church_name),
        "       2. Share it as Editor with:",
        "            %s" % service_account_email,
        "       3. Register it here:",
        "            python generate_statistics.py %s <url> --church \"%s\"" % (
            register_flag, church_name),
        "",
    ])


def open_stats_spreadsheet(client, church_data, stats_field):
    """
    Open this church's registered statistics spreadsheet.

    Returns:
        (spreadsheet, error) - exactly one is not None. ``error`` is a short
        reason string suitable for printing.
    """
    sheet_id = church_data.get(stats_field)
    if not sheet_id:
        return None, "unregistered"

    try:
        return client.open_by_key(sheet_id), None
    except Exception as e:
        return None, "could not open %s: %s" % (sheet_id, e)


def register_stats_spreadsheet(client, church_ref, stats_field, value):
    """
    Attach an existing spreadsheet to a church and remember its ID.

    The sheet is opened first, so a typo or a missing share is caught here
    rather than on the next run.

    Returns:
        (spreadsheet, error).
    """
    sheet_id = extract_spreadsheet_id(value)
    if not sheet_id:
        return None, "that does not look like a spreadsheet ID or URL"

    # Catch the placeholder from the setup instructions being pasted verbatim,
    # which would otherwise fail as a puzzling 404 from the Sheets API.
    if sheet_id.startswith("<") or sheet_id.endswith(">"):
        return None, ("%s is a placeholder - replace it with the real Google "
                      "Sheets URL from your browser's address bar" % sheet_id)

    # Real IDs are long and limited to URL-safe characters.
    if not re.match(r"^[A-Za-z0-9_-]{20,}$", sheet_id):
        return None, ("%r does not look like a spreadsheet ID. Paste the whole "
                      "URL from the browser, e.g. "
                      "https://docs.google.com/spreadsheets/d/<id>/edit" % sheet_id)

    try:
        spreadsheet = client.open_by_key(sheet_id)
    except Exception as e:
        return None, ("could not open %s - check the ID and that the sheet is "
                      "shared with the service account (%s)" % (sheet_id, e))

    try:
        church_ref.update({stats_field: sheet_id})
    except Exception as e:
        return None, "could not save the ID to Firestore: %s" % e

    return spreadsheet, None


def export_spreadsheet_to_excel(spreadsheet, sheet_creds, destination=None):
    """
    Download a spreadsheet as .xlsx.

    Args:
        destination: full path to write to. When omitted a temporary file is
            used, and the caller is responsible for deleting it.

    Returns:
        The path written, or None on failure.
    """
    try:
        drive = build('drive', 'v3', credentials=sheet_creds)
        request = drive.files().export_media(
            fileId=spreadsheet.id,
            mimeType='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        )

        if destination:
            path = destination
            handle = open(path, "wb")
        else:
            tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".xlsx")
            path = tmp.name
            handle = tmp

        try:
            downloader = MediaIoBaseDownload(handle, request)
            done = False
            while not done:
                _status, done = downloader.next_chunk()
        finally:
            handle.close()

        return path

    except Exception as e:
        print("    Excel export failed: %s" % e)
        return None


def upload_stats_to_sharepoint(excel_path, file_name, get_access_token, upload,
                               config_path):
    """
    Push an already-built .xlsx to SharePoint.

    ``upload`` must be the uploader belonging to the same domain as the file:
    attendance_sheets and servants_attendance_sheets write to *different*
    SharePoint folders, so the statistics file has to travel with its own
    attendance file rather than whichever uploader is convenient.

    The token, uploader and config path are injected so this module does not
    duplicate credential handling that already exists elsewhere.

    Returns:
        True when the file reached SharePoint.
    """
    try:
        if not excel_path or not os.path.exists(excel_path):
            return False

        access_token = get_access_token()
        if not access_token:
            print("    Could not get a Microsoft access token")
            return False

        with open(config_path) as f:
            drive_id = json.load(f)["sharepoint_drive_id"]

        return bool(upload(excel_path, file_name, access_token, drive_id))

    except Exception as e:
        print("    SharePoint upload failed: %s" % e)
        return False
