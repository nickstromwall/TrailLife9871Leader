# Trail Life MN-9871 Tools

Software for **Trail Life USA Troop MN-9871** (The North Church / BBC North).

This repo houses two related projects:

| Directory | What it is | Status |
|---|---|---|
| [`signup-static/`](./signup-static) | Self-contained HTML pages + Google Apps Script backend for the 2026–2027 volunteer leadership signup. The original tool. | In use for the May 2026 leadership meeting. |
| [`app/`](./app) | Next.js + Supabase application — generalized event signup platform for the troop (leadership, campouts, work days, etc.). Future home of everything `signup-static/` does plus more. | Under construction. |

## How the two relate

`signup-static/` is the launchpad — a single-purpose tool built for one specific meeting. It ships fast, runs on Google's free tier, and is the right answer for the immediate need.

`app/` is the long-term home — a real app where any leader can create new signup events without touching code. Once it's at feature parity for the leadership signup, the static version gets archived.

Both can run in parallel during the transition.

## Working on this repo

- The static project is plain HTML and a `.gs` file — no build step. Open the HTML files in a browser to test. See `signup-static/README.md` and `signup-static/VOLUNTEER-SIGNUP-SETUP.md` for the deployment workflow.
- The app project is a normal Node/Next.js codebase. See `app/README.md` for setup.

## Troop contact

Troopmaster: Nick Stromwall — Troop MN-9871, hosted at The North Church (BBC North).
