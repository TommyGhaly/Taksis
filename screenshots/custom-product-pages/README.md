# App Store custom product pages

Three alternate App Store listings for Taksis, each aimed at one audience. Every image
is **1320 × 2868** (6.9" iPhone). App Store Connect scales that size down for every
smaller iPhone.

The app screens are **HTML recreations with made-up names and initials avatars**, not
captures, so they're safe to publish. The real captures in `../appstore-6.9` contain
parishioner data, including minors.

| Page | Audience | Shots |
| --- | --- | --- |
| [`scheduling/`](scheduling) | Priests, church admins, deacon coordinators | 5 |
| [`attendance/`](attendance) | Sunday School, Hymns Class and Servants Meeting servants | 4 |
| [`deacons/`](deacons) | Deacons and altar servers | 3 |

## Page copy

Promotional text is limited to 170 characters. Each one below fits.

**Scheduling** (reference name: `Scheduling – Admins`)
> Build Sunday's deacon schedule in minutes. See who's confirmed, nudge who hasn't, and cover last-minute absences with a suggested replacement.

**Attendance** (reference name: `Attendance – Servants`)
> Take Sunday School, Hymns Class and Servants Meeting attendance in a few taps. Switch classes instantly and find anyone in seconds.

**Deacons** (reference name: `Deacons`)
> Know your reading before Sunday. Confirm with one tap, see who's serving with you, and learn the Liturgy, Midnight Praises and Vespers.

## Uploading

App Store Connect → Taksis → **Custom Product Pages** → **+** → name it, then:

1. Drop that folder's PNGs into the 6.9" iPhone slot. They display in filename order.
2. Paste the promotional text.
3. Submit for review. Each page gets its own URL (`…?ppid=<id>`). Use it in church
   emails, bulletins or QR codes for that audience.

App Store Connect also lets you attach search keywords to a custom product page, so
people who search for those words see it instead of the default listing.

## Editing and re-rendering

All copy, placeholder names and screen layouts live in [`src/shots.html`](src/shots.html).
The `SHOTS` table at the bottom maps each file to its caption and screen. Open
`src/shots.html?shot=deacons-01` in a browser to preview one, then re-render them all:

```bash
./src/render.sh
```

This needs Google Chrome. It renders all shots in parallel in about 20 seconds.
