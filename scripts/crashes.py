"""
Show recent crash reports with their stacks mapped back to source files.

Reports come from the crashReports collection (written by the report_crash
function). Release stacks only point at offsets in the JS bundle, so each one
is run through metro-symbolicate with the source map saved for its build by
scripts/archive-sourcemaps.sh.

Run with the functions venv:
    backend/functions/venv/bin/python scripts/crashes.py            # last 10
    backend/functions/venv/bin/python scripts/crashes.py -n 3 --platform android
"""
import argparse
import os
import subprocess

import firebase_admin
from firebase_admin import credentials, firestore

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CREDENTIALS = os.path.join(ROOT, "backend", "functions", "firebase_admin.json")
SYMBOLICATE = os.path.join(ROOT, "node_modules", ".bin", "metro-symbolicate")


def source_map(platform, build):
    path = os.path.join(ROOT, "sourcemaps", platform, f"{build}.map")
    return path if build and os.path.exists(path) else None


def symbolicate(stack, map_path):
    result = subprocess.run(
        [SYMBOLICATE, map_path], input=stack, capture_output=True, text=True
    )
    return result.stdout if result.returncode == 0 else stack


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("-n", type=int, default=10, help="number of reports")
    parser.add_argument("--platform", choices=["android", "ios"])
    args = parser.parse_args()

    firebase_admin.initialize_app(credentials.Certificate(CREDENTIALS))
    query = firestore.client().collection("crashReports")
    if args.platform:
        query = query.where("platform", "==", args.platform)
    query = query.order_by("receivedAt", direction=firestore.Query.DESCENDING)

    for snap in query.limit(args.n).stream():
        r = snap.to_dict()
        print("=" * 78)
        print(f"{r.get('occurredAt')}  {'FATAL' if r.get('fatal') else 'non-fatal'}"
              f" ({r.get('source')})  {snap.id}")
        print(f"{r.get('platform')} {r.get('osVersion')} {r.get('device')}  "
              f"v{r.get('appVersion')} build {r.get('build')}  uid {r.get('uid') or '-'}")
        print(f"screen: {r.get('screen') or '-'}")
        print(f"\n{r.get('message')}\n")

        map_path = source_map(r.get("platform"), r.get("build"))
        stack = r.get("stack", "")
        if map_path:
            print(symbolicate(stack, map_path))
        else:
            print(f"(no source map for {r.get('platform')} build {r.get('build')};"
                  " showing raw bundle offsets)")
            print(stack)

        if r.get("componentStack"):
            print("component stack:" + r["componentStack"])
        print("\nbreadcrumbs:")
        for crumb in r.get("breadcrumbs", []):
            print(f"  {crumb}")


if __name__ == "__main__":
    main()
