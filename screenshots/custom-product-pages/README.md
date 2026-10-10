# App Store custom product pages

Three alternate App Store listings for Taksis, each aimed at one audience, plus the
default listing everyone else sees.

The app screens are **HTML recreations with made-up names and initials avatars**, not
captures, so they're safe to publish. The real captures in `../appstore-6.9` contain
parishioner data, including minors.

| Page | Audience |
| --- | --- |
| [`scheduling/`](scheduling) | Priests, church admins, deacon coordinators |
| [`attendance/`](attendance) | Sunday School, Hymns Class and Servants Meeting servants |
| [`deacons/`](deacons) | Deacons and altar servers |
| [`listing/`](listing) | **The default App Store listing** (not a custom page). It covers the whole app and adds subtitle, keywords and description files |

Every page folder is laid out for App Store Connect (Xcode doesn't upload screenshots).
Each slot gets a numbered folder holding only that slot's files, so you can drag a folder's
contents straight in. Each page's own `README.md` walks through the slots in order.

| In each page folder | Size | App Store Connect slot |
| --- | --- | --- |
| `1-iPhone-6.9/` | 1320 × 2868 | iPhone 6.9" display |
| `2-iPhone-6.3/` | 1206 × 2622 | iPhone 6.1" or 6.3" display |
| `3-iPad-13/` | 2752 × 2064, landscape | iPad 12.9" or 13" display |
| `4-Header-Asset/` | 3840 × 1646 | Header Asset |
| `5-Search-Results-Asset/` | 3840 × 2560 | Search Results Asset |
| `alternate-5244x2950/` | 5244 × 2950 | Either asset slot, if you want one image for both |
| `promotional-text.txt` | | Promotional text, ready to paste |
| `deep-link.txt` | | Deep link, ready to paste |

The iPad shots are landscape because that's where Taksis shows its permanent sidebar
(`PERMANENT_DRAWER_MIN` in `screens/MainContainer.js`). They skip the phone's
navigation-drawer shot, since on iPad the sidebar is always on screen. The deacons
page shows a deacon with no other roles, so it has no sidebar, menu button or Edit
Schedule tab. That matches what such a user actually sees.

## Per-page details

Promotional text is limited to 170 characters. Each one below fits. The banners use a
shortened version as their subhead, so it doesn't repeat the headline.

### Scheduling

- **Reference name:** `Scheduling – Admins`
- **Deep link:** `taksis://scheduling`
- **Promotional text** (142 characters):
  > Build Sunday's deacon schedule in minutes. See who's confirmed, nudge who hasn't, and cover last-minute absences with a suggested replacement.

### Attendance

- **Reference name:** `Attendance – Servants`
- **Deep link:** `taksis://attendance`
- **Promotional text** (131 characters):
  > Take Sunday School, Hymns Class and Servants Meeting attendance in a few taps. Switch classes instantly and find anyone in seconds.

### Deacons

- **Reference name:** `Deacons`
- **Deep link:** `taksis://deacons`
- **Promotional text** (135 characters):
  > Know your reading before Sunday. Confirm with one tap, see who's serving with you, and learn the Liturgy, Midnight Praises and Vespers.

### About the deep links

The links use the app's existing `taksis://` URL scheme (`scheme` in `app.json`). They
are not universal links, because `https://www.spsmwayland.org/c/*` belongs to the App
Clip: a CPP link there would show the vehicle-registration clip card to anyone
without the app.

**The app doesn't route these links yet.** `utils/deepLinks.js` only recognizes
`/c/register-vehicle`, so for now each link just opens Taksis on its home screen.
Making them land on the right screen needs a small change in `deepLinks.js` and
`MainContainer.js`, plus a new binary:

| Link | Should open |
| --- | --- |
| `taksis://scheduling` | Edit Schedule tab (admins), otherwise Home |
| `taksis://attendance` | The first attendance screen the user's roles allow: Sunday School, then Hymns Class, then Servants Meeting; otherwise Home |
| `taksis://deacons` | Home (the week's schedule and the availability prompt) |

## Uploading

Follow the page's own README: [scheduling](scheduling/README.md),
[attendance](attendance/README.md), [deacons](deacons/README.md). Once submitted, each page
gets its own URL (`…?ppid=<id>`). Use it in church emails, bulletins or QR codes for that
audience.

App Store Connect also lets you attach search keywords to a custom product page, so
people who search for those words see it instead of the default listing.

## Editing and re-rendering

All copy, placeholder names and screen layouts live in [`src/shots.html`](src/shots.html).
The `SHOTS` table at the bottom maps each file to its caption and screen. Open
`src/shots.html?shot=deacons-01` in a browser to preview one, then re-render them all:

```bash
./src/render.sh
```

This needs Google Chrome. It renders the iPhone 6.9", iPad and banner images in parallel in
about 30 seconds, then scales the 6.9" set down to make the 6.3" one. It finishes by running
`src/page_readmes.py`, which rewrites each page's README and text files. Promotional text and
deep links are set there.
The banners are `src/shots.html?banner=<page>&size=<W>x<H>`. Their promotional text comes from the
`PAGES` table, so edit it there and in this README together.
