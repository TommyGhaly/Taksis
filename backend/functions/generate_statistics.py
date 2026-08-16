#!/usr/bin/env python3
"""
Generate the attendance statistics spreadsheets on demand.

Statistics live in their own Google Spreadsheets, separate from the attendance
grids the weekly job maintains. Each church ends up with four files:

    attendance.xlsx                 grades, one worksheet each   (weekly job)
    servants_attendance.xlsx        servants grid                (weekly job)
    sunday_school_statistics.xlsx   per-student stats            (this script)
    servants_statistics.xlsx        per-servant stats            (this script)

ONE-TIME SETUP, per church. The service account has no Drive storage of its
own and so cannot create spreadsheets - create them yourself, share them with
the service account as Editor, then register them:

    python generate_statistics.py --whoami          # who to share with
    python generate_statistics.py --church "Wayland" \\
        --register-sunday-school "<url>" --register-servants "<url>"

After that the IDs live on the church document and are reused every run.

Run it whenever you want the numbers refreshed:

    python generate_statistics.py                      # everything, every church
    python generate_statistics.py --sunday-school      # Sunday School only
    python generate_statistics.py --servants           # Servants Meeting only
    python generate_statistics.py --church "Wayland"
    python generate_statistics.py --dry-run            # print, touch nothing
    python generate_statistics.py --no-upload          # skip SharePoint
    python generate_statistics.py --list-churches

Statistics are computed per person - one row per student and per servant -
grouped by grade for Sunday School. See attendance_statistics.py for what each
column means.
"""

import argparse
import os
import sys
import tempfile
import time

import attendance_statistics
import attendance_sheets
import servants_attendance_sheets
import statistics_export


# === OUTPUT HELPERS ===
def log(message=""):
    print(message)
    sys.stdout.flush()


def format_pct(value):
    return "  n/a" if value is None else "%4.0f%%" % value


ROW_FORMAT = "%s%-24s %6s %6s %6s %6s  %-22s %s"


def print_rows(section_title, rows, indent="    "):
    """Print a section's rows as a plain table for --dry-run."""
    log("%s%s" % (indent, section_title))
    log(ROW_FORMAT % (indent, "Name", "Att%", "Mark%", "Unac%", "Cons%",
                      "Pattern", "Status"))
    for row in rows:
        log(ROW_FORMAT % (
            indent,
            row["name"][:24],
            format_pct(row["attendance_pct"]),
            format_pct(row["marked_pct"]),
            format_pct(row["unaccounted_pct"]),
            format_pct(row["consistency_pct"]),
            row["pattern"],
            row["status"],
        ))


def print_sections(sections):
    for section in sections:
        log()
        log("  %s" % section["title"])
        log("  " + "-" * 70)
        blocks = [(label, rows) for label, rows in section.get("blocks", []) if rows]
        for label, rows in blocks:
            print_rows(label if len(blocks) > 1 else "", rows)
        summary = attendance_statistics.summarize_rows(
            section.get("summary_label") or section["title"],
            [r for _label, rows in blocks for r in rows],
        )
        if summary:
            log(ROW_FORMAT % (
                "    ", "→ OVERALL",
                format_pct(summary["attendance_pct"]),
                format_pct(summary["marked_pct"]),
                format_pct(summary["unaccounted_pct"]),
                format_pct(summary["consistency_pct"]),
                summary["pattern"],
                summary["status"],
            ))


def service_account_email():
    return statistics_export.get_service_account_email(
        attendance_sheets.get_file_path("credentials.json")
    )


def register(db, client, args):
    """
    Attach existing spreadsheets to churches (--register-* flags).

    Requires --church, because writing an ID onto the wrong church would
    silently point statistics at another church's spreadsheet.
    """
    targets = []
    if args.register_sunday_school:
        targets.append((statistics_export.SUNDAY_SCHOOL_STATS_FIELD,
                        "Sunday School", args.register_sunday_school))
    if args.register_servants:
        targets.append((statistics_export.SERVANTS_STATS_FIELD,
                        "Servants Meeting", args.register_servants))

    if not args.church:
        log("❌ --church is required when registering a spreadsheet.")
        log("   It says which church the spreadsheet belongs to.")
        return 1

    matches = list(churches_for(db, args.church))
    if not matches:
        log("❌ No church matches %r. Try --list-churches." % args.church)
        return 1
    if len(matches) > 1:
        log("❌ %r matches %d churches; be more specific:" % (args.church, len(matches)))
        for _c, name, _d in matches:
            log("     %s" % name)
        return 1

    church, church_name, _church_data = matches[0]
    log("Registering for %s\n" % church_name)

    failures = 0
    for field, label, value in targets:
        spreadsheet, error = statistics_export.register_stats_spreadsheet(
            client, church.reference, field, value
        )
        if error:
            log("  ❌ %s: %s" % (label, error))
            failures += 1
        else:
            log("  ✅ %s → %s" % (label, spreadsheet.title))
            log("     %s" % spreadsheet.url)

    if not failures:
        log("\nDone. Now run the script normally to fill them in.")
    return 1 if failures else 0


def churches_for(db, church_filter):
    """Yield (church_snapshot, church_name, church_data) honouring --church."""
    for church in db.collection("churches").get():
        name = church.id
        if church_filter and church_filter.lower() not in name.lower():
            continue
        yield church, name, (church.to_dict() or {})


def build_and_deliver(sections, title, school_year, church_name, file_name,
                      uploader, args):
    """
    Build the printable .xlsx, then save and/or upload it.

    ``uploader`` is the module that owns this domain's SharePoint folder -
    Sunday School and Servants Meeting publish to different folders, so the
    statistics file must be sent by the same module that sends its matching
    attendance file.
    """
    subtitle = attendance_statistics.build_subtitle(school_year)

    if args.save_xlsx:
        os.makedirs(args.save_xlsx, exist_ok=True)
        path = os.path.join(args.save_xlsx, file_name)
    else:
        handle, path = tempfile.mkstemp(suffix=".xlsx")
        os.close(handle)

    try:
        written = attendance_statistics.write_statistics_xlsx(
            path, sections, title, subtitle
        )
        if not written:
            log("    ⚠️  Could not build the Excel file")
            return

        if args.save_xlsx:
            log("    📄 %s" % path)

        # SharePoint is only configured for the one church.
        if args.no_upload or church_name != attendance_sheets.TARGET_CHURCH_NAME:
            return

        ok = statistics_export.upload_stats_to_sharepoint(
            path,
            file_name,
            uploader.get_microsoft_access_token,
            uploader.upload_to_sharepoint,
            attendance_sheets.get_file_path("microsoft_config.json"),
        )
        log("    %s SharePoint: %s" % ("✅" if ok else "⚠️ ", file_name))

    finally:
        if not args.save_xlsx:
            try:
                os.remove(path)
            except OSError:
                pass


# === SUNDAY SCHOOL ===
def generate_sunday_school(db, client, sheet_creds, args):
    """Build (and optionally write) Sunday School statistics for each church."""
    log("=" * 74)
    log("SUNDAY SCHOOL")
    log("=" * 74)

    written = 0
    skipped = 0
    school_year = attendance_sheets.get_school_year()

    for church, church_name, church_data in churches_for(db, args.church):
        if statistics_export.SUNDAY_SCHOOL_SOURCE_FIELD not in church_data:
            log("\n%s — no Sunday School sheet configured, skipping" % church_name)
            skipped += 1
            continue

        log("\n%s" % church_name)

        try:
            cache = attendance_sheets.OptimizedAttendanceCache()
            cache.fetch_all_data_batch(church.reference.collection("Sunday School"))

            stats_input = attendance_sheets.collect_stats_input(cache)
            if not stats_input:
                log("  No attendance data found, skipping")
                skipped += 1
                continue

            sections = attendance_sheets.build_sunday_school_sections(stats_input)
            people = sum(len(rows) for s in sections for _l, rows in s["blocks"])
            log("  %d grades, %d people" % (len(sections), people))

            if args.dry_run:
                print_sections(sections)
                written += 1
                continue

            spreadsheet, error = statistics_export.open_stats_spreadsheet(
                client, church_data, statistics_export.SUNDAY_SCHOOL_STATS_FIELD,
            )
            if spreadsheet is None:
                log(statistics_export.missing_sheet_help(
                    church_name, "Sunday School",
                    statistics_export.SUNDAY_SCHOOL_STATS_TITLE,
                    service_account_email(),
                    "--register-sunday-school",
                ) if error == "unregistered" else "  ❌ %s" % error)
                skipped += 1
                continue

            if attendance_sheets.write_sunday_school_statistics(
                spreadsheet, stats_input, school_year
            ):
                log("  ✅ Statistics written")
                log("    %s" % spreadsheet.url)
                build_and_deliver(
                    sections, "SUNDAY SCHOOL ATTENDANCE STATISTICS",
                    school_year, church_name,
                    statistics_export.SUNDAY_SCHOOL_STATS_FILENAME,
                    attendance_sheets, args,
                )
                written += 1
            else:
                log("  ⚠️  Statistics were not written")
                skipped += 1

        except Exception as e:
            log("  ❌ Failed: %s" % e)
            skipped += 1

    return written, skipped


# === SERVANTS MEETING ===
def generate_servants(db, client, sheet_creds, args):
    """Build (and optionally write) Servants Meeting statistics for each church."""
    log()
    log("=" * 74)
    log("SERVANTS MEETING")
    log("=" * 74)

    written = 0
    skipped = 0
    school_year = servants_attendance_sheets.get_school_year()

    for church, church_name, church_data in churches_for(db, args.church):
        if statistics_export.SERVANTS_SOURCE_FIELD not in church_data:
            log("\n%s — no Servants Meeting sheet configured, skipping" % church_name)
            skipped += 1
            continue

        log("\n%s" % church_name)

        try:
            servants_ref = church.reference.collection("Servants Meeting")
            servant_dict = servants_attendance_sheets.get_servants_data(servants_ref, db)

            if not servant_dict:
                log("  No servants found, skipping")
                skipped += 1
                continue

            date_array = servants_attendance_sheets.get_dates(
                servants_attendance_sheets.find_start_date(servant_dict)
            )
            log("  %d servants, %d weeks" % (len(servant_dict), len(date_array)))

            if args.dry_run:
                print_sections(
                    servants_attendance_sheets.build_servants_sections(
                        servant_dict, date_array
                    )
                )
                written += 1
                continue

            spreadsheet, error = statistics_export.open_stats_spreadsheet(
                client, church_data, statistics_export.SERVANTS_STATS_FIELD,
            )
            if spreadsheet is None:
                log(statistics_export.missing_sheet_help(
                    church_name, "Servants Meeting",
                    statistics_export.SERVANTS_STATS_TITLE,
                    service_account_email(),
                    "--register-servants",
                ) if error == "unregistered" else "  ❌ %s" % error)
                skipped += 1
                continue

            if servants_attendance_sheets.write_statistics(
                spreadsheet, servant_dict, date_array, school_year
            ):
                log("  ✅ Statistics written")
                log("    %s" % spreadsheet.url)
                build_and_deliver(
                    servants_attendance_sheets.build_servants_sections(
                        servant_dict, date_array
                    ),
                    "SERVANTS MEETING ATTENDANCE STATISTICS",
                    school_year, church_name,
                    statistics_export.SERVANTS_STATS_FILENAME,
                    servants_attendance_sheets, args,
                )
                written += 1
            else:
                log("  ⚠️  Statistics were not written")
                skipped += 1

        except Exception as e:
            log("  ❌ Failed: %s" % e)
            skipped += 1

    return written, skipped


def list_churches(db):
    log("Churches:")
    for church in db.collection("churches").get():
        data = church.to_dict() or {}
        tags = []
        if statistics_export.SUNDAY_SCHOOL_SOURCE_FIELD in data:
            tags.append("sunday-school")
        if statistics_export.SERVANTS_SOURCE_FIELD in data:
            tags.append("servants")
        if statistics_export.SUNDAY_SCHOOL_STATS_FIELD in data:
            tags.append("ss-stats")
        if statistics_export.SERVANTS_STATS_FIELD in data:
            tags.append("servants-stats")
        log("  %-50s %s" % (church.id, ", ".join(tags) or "no sheets configured"))


# === ENTRY POINT ===
def main():
    parser = argparse.ArgumentParser(
        description="Generate the attendance statistics spreadsheets on demand.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument("--sunday-school", action="store_true",
                        help="Only regenerate Sunday School statistics.")
    parser.add_argument("--servants", action="store_true",
                        help="Only regenerate Servants Meeting statistics.")
    parser.add_argument("--church", metavar="NAME",
                        help="Only process churches whose name contains NAME "
                             "(case-insensitive).")
    parser.add_argument("--dry-run", action="store_true",
                        help="Print the statistics to the terminal without "
                             "creating or writing anything.")
    parser.add_argument("--no-upload", action="store_true",
                        help="Skip the SharePoint upload (Google Sheets only).")
    parser.add_argument("--save-xlsx", metavar="DIR",
                        help="Also keep the printable .xlsx files in DIR "
                             "instead of deleting them after upload.")
    parser.add_argument("--register-sunday-school", metavar="URL_OR_ID",
                        help="Attach an existing spreadsheet as this church's "
                             "Sunday School statistics sheet. Needs --church.")
    parser.add_argument("--register-servants", metavar="URL_OR_ID",
                        help="Attach an existing spreadsheet as this church's "
                             "Servants Meeting statistics sheet. Needs --church.")
    parser.add_argument("--list-churches", action="store_true",
                        help="List the churches and their configured sheets, "
                             "then exit.")
    parser.add_argument("--whoami", action="store_true",
                        help="Print the service account address that "
                             "spreadsheets must be shared with, then exit.")
    args = parser.parse_args()

    if args.whoami:
        log("Share your statistics spreadsheets (as Editor) with:")
        log("  %s" % service_account_email())
        return 0

    # Neither flag given means both.
    do_sunday_school = args.sunday_school or not args.servants
    do_servants = args.servants or not args.sunday_school

    registering = bool(args.register_sunday_school or args.register_servants)

    start = time.time()

    try:
        db = attendance_sheets.initialize_firebase()
    except Exception as e:
        log("❌ Could not connect to Firebase: %s" % e)
        log("   Check that firebase_admin.json exists in this directory.")
        return 1

    if args.list_churches:
        list_churches(db)
        return 0

    client = None
    sheet_creds = None
    if not args.dry_run or registering:
        try:
            client, sheet_creds = attendance_sheets.initialize_google_sheets()
        except Exception as e:
            log("❌ Could not connect to Google Sheets: %s" % e)
            log("   Check that credentials.json exists in this directory.")
            return 1

    if registering:
        return register(db, client, args)

    if args.dry_run:
        log("DRY RUN - no spreadsheets will be created, written or uploaded\n")

    written = 0
    skipped = 0

    if do_sunday_school:
        w, s = generate_sunday_school(db, client, sheet_creds, args)
        written += w
        skipped += s

    if do_servants:
        w, s = generate_servants(db, client, sheet_creds, args)
        written += w
        skipped += s

    log()
    log("=" * 74)
    log("Done in %.1fs — %d updated, %d skipped" % (time.time() - start, written, skipped))
    log("=" * 74)

    return 0 if written else 1


if __name__ == "__main__":
    sys.exit(main())
