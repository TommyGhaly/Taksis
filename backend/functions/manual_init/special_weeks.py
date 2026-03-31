"""
One-time fix: Convert Palm Sunday (04-05-26) and Easter (04-12-26)
schedule docs to readings-only with liturgical phrases.

Run from backend/functions/:
    source venv/bin/activate
    python fix_special_weeks.py
"""

import datetime
import uuid
import firebase_admin
from firebase_admin import credentials, firestore

if not firebase_admin._apps:
    cred = credentials.Certificate("../credentials.json")
    firebase_admin.initialize_app(cred)

db = firestore.client()

# ── Config ────────────────────────────────────────────────────────────────────

SPECIAL_WEEKS = {
    "04-05-26": "palm_sunday",
    "04-12-26": "easter",
}

READING_ROLES = ["matins", "third", "sixth", "pauline", "catholic", "praxis", "gospel"]
REMOVE_ROLES = ["altar"]

PALM_SUNDAY_PHRASES = {
    "matins":   {"name": "Hosanna in the Highest — Ⲱⲥⲁⲛⲛⲁ ϧⲉⲛ ⲛⲏⲉⲧϭⲟⲥⲓ", "uid": "N/A"},
    "third":    {"name": "Blessed is He who comes in the name of the Lord", "uid": "N/A"},
    "sixth":    {"name": "أوصنا في الأعالي — Hosanna fei el a'ali", "uid": "N/A"},
    "pauline":  {"name": "The King comes, humble, riding on a donkey", "uid": "N/A"},
    "catholic": {"name": "Blessed is the coming Kingdom of our father David", "uid": "N/A"},
    "praxis":   {"name": "The crowds spread their garments on the road", "uid": "N/A"},
    "gospel":   {"name": "Hosanna to the Son of David — Ⲱⲥⲁⲛⲛⲁ ⲡ̀ϣⲏⲣⲓ ⲛ̀Ⲇⲁⲩⲓⲇ", "uid": "N/A"},
    "water":    {"name": "Blessed is He who comes in the name of the Lord — Ⲉϥⲥⲙⲁⲣⲱⲟⲩⲧ", "uid": "N/A"},
    "wine":     {"name": "Hosanna in the Highest — Ⲱⲥⲁⲛⲛⲁ ϧⲉⲛ ⲛⲏⲉⲧϭⲟⲥⲓ", "uid": "N/A"},
}

EASTER_PHRASES = {
    "matins":   {"name": "Ⲭⲣⲓⲥⲧⲟⲥ ⲁⲛⲉⲥⲧⲏ — Christos Anesti — Christ is Risen", "uid": "N/A"},
    "third":    {"name": "المسيح قام — بالحقيقة قام — Al Maseeh Qam", "uid": "N/A"},
    "sixth":    {"name": "Truly He is Risen — Ⲁⲗⲏⲑⲱⲥ ⲁⲛⲉⲥⲧⲏ", "uid": "N/A"},
    "pauline":  {"name": "Death is swallowed up in victory", "uid": "N/A"},
    "catholic": {"name": "He is not here, for He is risen as He said", "uid": "N/A"},
    "praxis":   {"name": "Pikhristos Aftonf — Khen o methmi aftonf", "uid": "N/A"},
    "gospel":   {"name": "Christ is Risen! — ¡Cristo ha resucitado! — Le Christ est ressuscité!", "uid": "N/A"},
    "water":    {"name": "Ⲁϥⲧⲱⲛϥ — He is Risen, He is not here", "uid": "N/A"},
    "wine":     {"name": "Ⲭⲣⲓⲥⲧⲟⲥ ⲁⲛⲉⲥⲧⲏ — Ⲁⲗⲏⲑⲱⲥ ⲁⲛⲉⲥⲧⲏ", "uid": "N/A"},
}

PALM_SUNDAY_META = {
    "specialWeek": "palm_sunday",
    "specialTitle": "Palm Sunday — Hosanna Sunday",
    "specialSubtitle": "ⲁⲡⲓⲕⲩⲣⲓⲁⲕⲏ ⲛ̀ⲧⲉ ⲛⲓⲃⲁⲓ̈ⲟⲛ",
}

EASTER_META = {
    "specialWeek": "easter",
    "specialTitle": "The Glorious Feast of the Resurrection",
    "specialSubtitle": "Ⲡⲓϣⲁⲓ ⲛ̀ⲧⲉ Ϯⲁⲛⲁⲥⲧⲁⲥⲓⲥ ⲉⲑⲟⲩⲁⲃ",
}


def convert_special_week(schedule_data, week_type):
    """Strip to readings only, replace names with phrases."""
    # Remove altar, water, wine
    for role in REMOVE_ROLES:
        schedule_data.pop(role, None)

    # Pick the right phrases and meta
    if week_type == "palm_sunday":
        phrases = PALM_SUNDAY_PHRASES
        meta = PALM_SUNDAY_META
    else:
        phrases = EASTER_PHRASES
        meta = EASTER_META

    # Replace each reading role with phrase dict
    for role, entry in phrases.items():
        schedule_data[role] = entry

    # Add metadata
    schedule_data.update(meta)

    return schedule_data


def process_church(church_doc):
    church_id = church_doc.id
    schedule_ref = church_doc.reference.collection("schedule")

    print(f"\nChurch: {church_id}")

    for doc_id, week_type in SPECIAL_WEEKS.items():
        doc = schedule_ref.document(doc_id).get()
        if not doc.exists:
            print(f"  {doc_id} — NOT FOUND, skipping")
            continue

        data = doc.to_dict()
        data = convert_special_week(data, week_type)
        schedule_ref.document(doc_id).set(data)
        print(f"  {doc_id} — converted to {week_type.upper().replace('_', ' ')}")


def main():
    print("Fix Special Weeks")
    print(f"Running at: {datetime.datetime.now()}\n")
    print("Will convert:")
    print("  04-05-26 → Palm Sunday (readings only + Hosanna phrases)")
    print("  04-12-26 → Easter (readings only + Resurrection phrases)")

    response = input("\nProceed? (yes/no): ").strip().lower()
    if response != "yes":
        print("Aborted.")
        return

    churches = list(db.collection("churches").stream())
    print(f"\nFound {len(churches)} churches")

    for church_doc in churches:
        process_church(church_doc)

    print("\nDone!")


if __name__ == "__main__":
    main()