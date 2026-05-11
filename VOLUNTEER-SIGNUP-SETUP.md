# Volunteer Signup Pages — Setup Guide
Trail Life MN-9871 | 2026-2027 Season

---

## What you have

Three files in the Trail Life project folder:

- `2026-2027-Volunteer-Signup-Adults.html` — adult roles page (20 roles)
- `2026-2027-Volunteer-Signup-Youth.html` — youth leadership roles page (9 roles, 25 total spots)
- `google-apps-script.gs` — Google Apps Script backend (shared by both pages)

**Tonight (Google Sheets + Apps Script):** works in about 5 minutes. Dads sign up, data lands in a Google Sheet you can see live.

**Tomorrow (Firebase upgrade):** real-time push without polling. Optional but faster. Notes at the bottom.

---

## Part 1: Set up the Google Sheet (2 minutes)

1. Open Google Sheets and create a new blank spreadsheet.
2. Name it something like `Trail Life 9871 Volunteer Signups 2026-27`.
3. Leave it open in your browser — you'll come back to it in step 4.

---

## Part 2: Create the Apps Script (2 minutes)

1. In your new Google Sheet, go to **Extensions > Apps Script**.
2. Delete any existing code in the editor (the default `myFunction` stub).
3. Open `google-apps-script.gs` from the Trail Life project folder and copy all of its contents.
4. Paste into the Apps Script editor.
5. Click **Save** (disk icon or Cmd+S).

---

## Part 3: Initialize the sheets (30 seconds)

1. In the Apps Script editor, use the function dropdown (top center) to select `initializeSheet`.
2. Click **Run**.
3. The first time, Google will ask for permissions — click through and allow.
4. You should see log output: "Sheets initialized. Adult roles: 20, Youth roles: 9."
5. Go back to your Google Sheet — you will now see three tabs: `Adult Roles`, `Youth Roles`, and `Signups Log`.

---

## Part 4: Deploy as a Web App (2 minutes)

1. In the Apps Script editor, click **Deploy > New deployment**.
2. Click the gear icon next to "Select type" and choose **Web app**.
3. Set:
   - **Description:** Trail Life Signup Backend
   - **Execute as:** Me (your Google account)
   - **Who has access:** Anyone
4. Click **Deploy**.
5. Click **Authorize access** if prompted and follow the OAuth prompts.
6. Copy the **Web app URL** — it will look like:
   `https://script.google.com/macros/s/AKfycb.../exec`

---

## Part 5: Wire the URL into the HTML pages (1 minute)

Open both HTML files in a text editor (TextEdit, VS Code, or anything).

In each file, find this line near the top of the `<script>` section:

```javascript
const SCRIPT_URL = 'YOUR_APPS_SCRIPT_URL_HERE';
```

Replace `'YOUR_APPS_SCRIPT_URL_HERE'` with your actual Web app URL in quotes:

```javascript
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycb.../exec';
```

Save both files.

---

## Part 6: Generate QR codes (2 minutes)

For the meeting, you'll want QR codes so dads and boys can scan without typing a URL.

Option A — **Host the files on Google Drive:**
1. Upload both HTML files to your Google Drive (make sure sharing is set to "Anyone with the link can view").
2. Open the file in Drive, get the shareable URL, then paste it into a QR generator like [qr-code-generator.com](https://www.qr-code-generator.com) or [goqr.me](https://goqr.me).

Option B — **Use a simple local web server tonight** (if you have a Mac):
1. Open Terminal and run: `cd ~/Downloads && python3 -m http.server 8080`
2. Move both HTML files to `~/Downloads`.
3. Open `http://localhost:8080/2026-2027-Volunteer-Signup-Adults.html` in a browser on the same Wi-Fi network — other devices can access via your Mac's local IP address.
4. For a QR code, use your IP address (find it in System Settings > Wi-Fi > Details).

Option C — **Easiest: open the file directly on a big screen** and let dads walk up if the room has a shared display.

---

## How the live sync works

- Both pages poll the Apps Script backend every 5 seconds.
- When a dad signs up, the page makes an optimistic update immediately (the card turns green on his phone), then sends the data to the Sheet in the background.
- Every other phone picks up the change within 5 seconds on next poll.
- You can watch signups come in live by leaving your Google Sheet open.

---

## Live monitoring during the meeting

Open your Google Sheet on a laptop or tablet. As dads sign up:
- The `Adult Roles` tab shows filled count and names per role.
- The `Youth Roles` tab does the same.
- The `Signups Log` tab shows every signup in timestamp order.

You can sort, filter, and print from there after the meeting.

---

## Tomorrow: Firebase upgrade (optional, for speed)

If you want true push updates (cards flip the instant anyone signs up, no 5-second lag):

1. Go to [console.firebase.google.com](https://console.firebase.google.com) and create a new project.
2. Add a Realtime Database (or Firestore — Realtime Database is simpler here).
3. In each HTML file, replace the `fetchUpdates` + `setInterval` polling block with Firebase's `onValue` listener.
4. Replace the `submitSignup` POST block with a Firebase `set` or `push` call.
5. The role data structure maps cleanly: one object per role with `filled`, `names`, and `status` keys.

Total upgrade time: about 30 to 45 minutes for someone comfortable with JavaScript. The HTML files are structured to make this swap straightforward.

---

## Troubleshooting

**Signups are not showing up in the Sheet:**
- Make sure the Web app is deployed with "Anyone" access (not "Anyone with Google account").
- Re-deploy after any code changes — Apps Script requires a new deployment to push updates.

**Cards are not syncing across phones:**
- Confirm `SCRIPT_URL` in both HTML files matches exactly (no trailing slash, no extra spaces).
- Check that the sheet tab names match (`Adult Roles`, `Youth Roles`) — the script is case-sensitive.

**"Authorization required" error on first run:**
- This is normal. Click "Review permissions," log in with your Google account, and click "Allow." You only do this once.

**Forms are submitting but data is wrong:**
- Open the `Signups Log` tab in your Sheet to see raw incoming data — that will tell you which field is off.

---

*Built for Trail Life MN-9871, May 2026.*
