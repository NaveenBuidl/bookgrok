# BookGrok Mock v8.3

Static site prototype for bookgrok.mandava.in. The BookGrok page is the single command center; Google Forms, Google Meet, Google Calendar, and Slack are spokes.

## What this tests

- Can a cold visitor understand the concept within 10 seconds?
- Does the registration gate feel like a real commitment step?
- Do session links, calendar buttons, and homework submission work on the access page?
- Can the host manage tracks and sessions from a Google Sheet without touching code?

## What this does not test

Real payment, auth, access enforcement, Slack automation, attendance tracking, completion tracking.

---

## Local development

### Prerequisites

- Python 3 installed (for local server)
- Chrome or any modern browser

### Run

```bash
python -m http.server 8000
```

Open in browser:

- Homepage: `http://localhost:8000`
- Access page: `http://localhost:8000/access/?track=nexus`

Test all five track IDs: `nexus`, `thinking-machine`, `empire-of-ai`, `ai-snake-oil`, `build-llm`

---

## File structure

```
bookgrok-mock/
  CLAUDE.md              Claude Code instructions
  AGENTS.md              Mirror of CLAUDE.md
  index.html             Public homepage
  styles.css             Shared styles
  README.md              This file

  access/
    index.html           Member access page (/access/?track=TRACK-ID)

  src/
    config.js            CSV URLs — edit once to switch to Google Sheets
    data.js              Fetch, parse, validate CSV data
    app.js               Homepage render logic
    access.js            Access page render logic

  assets/
    books/               Book cover images (or placeholder)
    hosts/               Host photos (or placeholder)

  samples/
    tracks_sample.csv    All tracks with full schema
    sessions_sample.csv  All sessions with full schema

  docs/
    bookgrok_v8_3_claudecode_handoff.md  Full spec
```

---

## Stage 1 → Stage 2: switching to Google Sheets

1. Create a Google Spreadsheet with two tabs: `tracks` and `sessions`
2. Copy data from `samples/` into each tab
3. Publish each tab as CSV: File → Share → Publish to web → select tab → CSV → Publish
4. Copy the two published CSV URLs
5. Open `src/config.js` and replace the local paths with the published URLs

```js
const CONFIG = {
  tracksCsvUrl: "https://docs.google.com/spreadsheets/d/SHEET_ID/gviz/tq?tqx=out:csv&sheet=tracks",
  sessionsCsvUrl: "https://docs.google.com/spreadsheets/d/SHEET_ID/gviz/tq?tqx=out:csv&sheet=sessions"
};
```

After that, all content changes happen in the Sheet. No code edits required.

**Note:** Sheet edits may take a few minutes to appear. Hard-refresh the browser before debugging.

---

## Managing tracks

### Add a track

1. Add row to `tracks` sheet with `status = draft`
2. Add session rows to `sessions` sheet for this track
3. Create Google Form (registration) — set confirmation page to show access URL
4. Create Google Form (homework, optional)
5. Create Google Meet link
6. Create Slack private channel
7. Add all URLs to the track row in the sheet
8. Test: `http://localhost:8000/access/?track=YOUR-TRACK-ID`
9. Change `status` to `published`

### Edit a track

Edit cells in the sheet. If changes affect registered members, email them from the form response sheet.

### Archive a track

Set `status = archived`. Do not delete unless it was never shared.

---

## Managing sessions

### Add a session

Add row to `sessions` sheet with `status = published`.

### Edit a session

Edit the row. **Important:** if users already added sessions to their Google Calendar, their events will not auto-update. Email them with the new details and ask them to delete the old invite and re-add from the access page.

### Cancel a session

Set `status = cancelled`. The access page hides cancelled sessions.

---

## Registration form setup

Per track, create a Google Form with:

1. First name — short answer, required
2. Email — short answer, required, email validation
3. What have you tried before that did not work? — paragraph, required (helper: *Reading alone, book clubs, summaries, courses — honest is fine.*)

**Confirmation message:**

```
You are registered.

Your session access page:
https://bookgrok.mandava.in/access/?track=TRACK-ID

Bookmark this page. It has your Join links, calendar buttons, homework submission, and cohort discussion instructions.

Please buy or borrow the book before Session 1.
```

Replace `TRACK-ID` with the track's `id` value.

---

## Revoking access (emergency)

1. Rotate the Google Meet link(s) in the sheet
2. Optionally change the track `id` in the sheet (changes the access page URL)
3. Email remaining members with updated links

There is no true access revocation in v8.3. The access page is gated by URL obscurity only.

---

## Deployment

```bash
git init
git add .
git commit -m "BookGrok mock v8.3"
git remote add origin YOUR_GITHUB_REPO_URL
git branch -M main
git push -u origin main
```

In Vercel:

1. Import repo
2. Framework preset: Other
3. Build command: leave empty
4. Output directory: leave empty
5. Deploy
6. Settings → Domains → add `bookgrok.mandava.in`
7. Add the CNAME record Vercel shows at your DNS provider (use exact value from Vercel)
8. Verify: `https://bookgrok.mandava.in`
9. Verify access page: `https://bookgrok.mandava.in/access/?track=nexus`

---

## Known limitations

1. Access is by hidden URL only — anyone with the URL can share it
2. Published Google Sheet CSV is publicly readable — do not put sensitive data in the sheet
3. Slack invites are manual — no automation in v8.3
4. Homework file upload requires Google sign-in
5. Calendar events do not auto-update when session details change
6. Meet links can be shared freely
7. No payment, no true member state, no access revocation, no prep/attendance/completion tracking

---

## Success criteria

### Mechanical

1. Homepage loads from CSV, headline visible above fold
2. All five track cards render correctly
3. Public homepage never exposes Meet links, Calendar links, homework URLs, or Slack links
4. Register button opens the correct Google Form
5. Access page renders correct session table in visitor's local timezone
6. Calendar buttons generate correct events with Meet link embedded
7. Join buttons open Google Meet
8. Submit HW button appears only when `homeworkFormUrl` is set
9. Community block shows channel name and instructions

### Concept

Form question 3 responses should contain pain language:
- "I never finish serious books."
- "I stall halfway."
- "Book clubs are too casual."

If responses are generic, rewrite the homepage headline and subhead before building further.
