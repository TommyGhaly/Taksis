"""Writes each page folder's upload checklist and copy-paste text files.

Run by render.sh after the images exist, so the file lists always match what's on disk.
"""
import os

PAGES = {
    "scheduling": ("Scheduling – Admins", "priests, church admins and deacon coordinators", "taksis://scheduling",
        "Build Sunday's deacon schedule in minutes. See who's confirmed, nudge who hasn't, and cover last-minute absences with a suggested replacement."),
    "attendance": ("Attendance – Servants", "Sunday School, Hymns Class and Servants Meeting servants", "taksis://attendance",
        "Take Sunday School, Hymns Class and Servants Meeting attendance in a few taps. Switch classes instantly and find anyone in seconds."),
    "deacons": ("Deacons", "deacons and altar servers", "taksis://deacons",
        "Know your reading before Sunday. Confirm with one tap, see who's serving with you, and learn the Liturgy, Midnight Praises and Vespers."),
    # The default App Store listing. Not a custom product page, so it has no deep link.
    "listing": ("Default product page", "everyone who finds Taksis on the App Store", None,
        "Deacon schedules, Sunday School and Servants Meeting attendance, and Learn to Serve, all in one app built for Coptic Orthodox churches."),
}

# Fields only the default listing has. App Store limits: subtitle 30, keywords 100, description 4000.
LISTING = {
    "subtitle": "Deacon schedules & attendance",
    "keywords": "coptic,orthodox,church,deacon,schedule,attendance,sunday school,servants,liturgy,tasbeha,hymns,alhan",
    "description": """Taksis runs the weekly work of a Coptic Orthodox church: who serves at the altar, who reads, and who showed up. Everything lives in one app your clergy, servants and deacons share.

DEACON SCHEDULING
• Assign every reading for the week: Matins, Third and Sixth Hour Gospels, Pauline and Catholic Epistles, Praxis and Gospel
• Assign the Offering of the Lamb and altar servers
• See at a glance who has confirmed, and send a reminder to anyone who hasn't
• When someone can't serve, Taksis suggests a replacement you can accept in one tap

FOR DEACONS
• Know your reading as soon as the week is scheduled
• Confirm with one tap, mark yourself unsure, or say you can't make it
• Block out weeks you'll be away
• See everyone serving with you that week

ATTENDANCE
• Sunday School by class, Hymns Class by grade, Servants Meeting and College Youth Meeting
• Present or absent in a single tap
• Search, or jump through long lists with an A–Z index
• Add a student or servant on the spot

LEARN TO SERVE
• Learn the Divine Liturgy, Midnight Praises (Tasbeha) and Vespers (Ashaya)

HOLY WEEK
• See who's reading what during Holy Week and Pascha

FOR ADMINISTRATORS
• Manage deacons, servants and roles
• Check vehicles in at church events by scanning license plates
• Add your children to your account and manage their profiles

Sign in with Apple, Google or Microsoft.""",
}
assert len(LISTING["subtitle"]) <= 30 and len(LISTING["keywords"]) <= 100 and len(LISTING["description"]) <= 4000

# (folder, App Store Connect slot name, size)
SLOTS = [
    ("1-iPhone-6.9", 'iPhone 6.9" display', "1320 × 2868"),
    ("2-iPhone-6.3", 'iPhone 6.1" or 6.3" display', "1206 × 2622"),
    ("3-iPad-13", 'iPad 12.9" or 13" display', "2752 × 2064"),
    ("4-Header-Asset", "Header Asset", "3840 × 1646"),
    ("5-Search-Results-Asset", "Search Results Asset", "3840 × 2560"),
]

os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
for page, (ref, audience, link, promo) in PAGES.items():
    assert len(promo) <= 170, f"{page} promotional text is {len(promo)} chars"
    with open(f"{page}/promotional-text.txt", "w") as f:
        f.write(promo + "\n")
    if link:
        with open(f"{page}/deep-link.txt", "w") as f:
            f.write(link + "\n")
    if page == "listing":
        for field, text in LISTING.items():
            with open(f"{page}/{field}.txt", "w") as f:
                f.write(text + "\n")

    steps = []
    for i, (folder, slot, size) in enumerate(SLOTS, 1):
        files = sorted(os.listdir(f"{page}/{folder}"))
        steps.append(f"{i}. **{slot}** ({size}): drag in everything from [`{folder}/`]({folder}) "
                     f"({len(files)} file{'s' if len(files) != 1 else ''})")
    steps.append(f"{len(SLOTS) + 1}. **Promotional text:** paste [`promotional-text.txt`](promotional-text.txt) ({len(promo)} of 170 characters)")
    if link:
        steps.append(f"{len(SLOTS) + 2}. **Deep link:** paste [`deep-link.txt`](deep-link.txt)")
    else:
        n = len(SLOTS) + 2
        for field, label, limit in [("subtitle", "Subtitle", 30), ("keywords", "Keywords", 100), ("description", "Description", 4000)]:
            steps.append(f"{n}. **{label}:** paste [`{field}.txt`]({field}.txt) ({len(LISTING[field])} of {limit} characters)")
            n += 1

    with open(f"{page}/README.md", "w") as f:
        if link:
            title, where = f"{page.capitalize()}: custom product page", f"""For {audience}. Reference name: `{ref}`.

Upload this in **App Store Connect** (in the browser), not Xcode. Xcode only uploads builds.
Open App Store Connect → Taksis → **Custom Product Pages** → **+**, then fill each slot
from its numbered folder:"""
            deep = """

The deep link opens Taksis but doesn't yet go to a specific screen. See "About the deep
links" in the [main README](../README.md)."""
        else:
            title, where = "Default App Store listing", f"""The main product page, the one {audience} sees.

Upload this in **App Store Connect** (in the browser), not Xcode. Xcode only uploads builds.
Open App Store Connect → Taksis → the version you're preparing (**iOS App** in the sidebar),
then fill each slot from its numbered folder:"""
            deep = """

The default listing has no deep link. Those are only for custom product pages."""
        f.write(f"""# {title}

{where}

""" + "\n".join(steps) + f"""

App previews (videos) are optional and aren't included.

[`alternate-5244x2950/`](alternate-5244x2950) has a 16:9 version that either the header
slot or the search results slot accepts, if you'd rather use one image for both.{deep}

These images are generated. To change them, edit [`../src/shots.html`](../src/shots.html)
and run `../src/render.sh` rather than editing the PNGs.
""")
    print(f"wrote {page}/README.md")
