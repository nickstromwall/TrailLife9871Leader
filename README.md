# Trail Life MN-9871 — Volunteer Signup Site

Volunteer role signup pages for **Trail Life USA Troop MN-9871** (2026–2027 season), hosted at [sage-quokka-8ec1bb.netlify.app](https://sage-quokka-8ec1bb.netlify.app).

## What's here

| File | Purpose |
|------|---------|
| `2026-2027-Volunteer-Signup-Adults.html` | Adult volunteer role signup page |
| `2026-2027-Volunteer-Signup-Youth.html` | Youth leadership role signup page |
| `google-apps-script.gs` | Google Apps Script backend (reads/writes to Google Sheets) |
| `VOLUNTEER-SIGNUP-SETUP.md` | Step-by-step setup guide for the Apps Script backend |

## How it works

- Both HTML pages are fully self-contained (no build step, no npm).
- They call a Google Apps Script web app to read role status and record signups.
- Signups are written to a Google Sheet with three tabs: Adult Roles, Youth Roles, Signups Log.
- The shared Google Sheet is the source of truth — every device polls it every 5 seconds, so signups made on one phone show up on every other device.
- localStorage is a per-device cache: it keeps the last-seen state available offline on the same browser, but it does **not** sync across devices and is wiped if the page is opened from a different origin (e.g., a new Netlify subdomain) or in a private/incognito tab.
- Each page shows a connection indicator: green "Live" when the backend is reachable, yellow "Local only" when the backend URL has not been wired up, red "Offline" when the network fails.
- Pages cross-link to each other (adults ↔ youth).

## Setup (first time)

See `VOLUNTEER-SIGNUP-SETUP.md` for the full walkthrough. The short version:

1. Open `google-apps-script.gs` in the Apps Script editor and run `initializeSheet` once.
2. Deploy as a Web App (Execute as: Me, Who has access: Anyone).
3. Copy the deployment URL into both HTML files where it says `YOUR_APPS_SCRIPT_URL_HERE`.
4. Upload both HTML files to Netlify (drag and drop at netlify.com/drop).

## Hosting

Currently deployed via Netlify Drop. To update, drag both HTML files to [app.netlify.com/drop](https://app.netlify.com/drop) and it will replace the existing deploy.

## Contributing

- All code lives in the two HTML files and the `.gs` backend — no framework, no build step.
- Test changes locally by opening the HTML file in a browser.
- The `SCRIPT_URL` constant at the top of each HTML file must point to a live Apps Script deployment for live data to load.
- If the Apps Script URL is not set, the page falls back to localStorage only.

## Troop contact

Troopmaster: Nick Stromwall — Troop MN-9871, hosted at The North Church (BBC North).
