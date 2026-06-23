# BookGrok Prototype v8.3 — Claude Code Handoff

## 0. Version summary

**Version:** v8.3
**Tool:** Claude Code (not Codex)
**Goal:** Build a same-day static BookGrok prototype where the BookGrok page is the **single command center**, while external tools handle registration, sessions, homework, and cohort discussion.

### What changed from v8.2

- v8.2 was written for Codex. v8.3 is written for Claude Code.
- Instruction file is `CLAUDE.md` (not `AGENTS.md`).
- Sample CSVs are now complete — all columns including homework and community fields are present.
- Homepage headline/subhead are now explicit rendering requirements, not just concept notes.
- Build sequence uses `python -m http.server 8000` (Python already installed in dev environment).
- Minor schema clarification: `startDate` is derived from the first published session, not stored separately.

---

## 1. Core product concept

### Homepage headline

**Most serious books never get finished.**

### Homepage subhead

**BookGrok brings together a small cohort, a host who has read seriously, and a chapter-by-chapter structure that gets you to the end.**

This is not decorative copy. Render it above the track cards on every page load. It is the resonance test for the whole mock.

### Product thesis

- Serious books require serious work.
- Serious work needs commitment.
- Commitment is stronger with other serious people.
- The host is not a lecturer — the host is someone who has read seriously and can hold the room.
- Completion is the product.

---

## 2. What v8.3 tests

### Tests

1. Can a cold visitor understand the concept within 10 seconds?
2. Can they evaluate a track from book, host, cadence, price, start date, and spots?
3. Can Google Sheets act as a no-code CMS for tracks and sessions?
4. Can a Google Form act as a registration gate?
5. Can a hidden access page act as the mock member hub?
6. Can Google Calendar links and Google Meet links work cleanly from the access page?
7. Can a Google Form file upload handle homework submission?
8. Can Slack provide a cohort discussion space without becoming the main container?
9. Can the host/admin operate tracks without editing code?

### Does not test

- Real payment
- Proper login/auth
- Private access enforcement
- Automated Slack invites
- Real access revocation
- Prep visibility
- Attendance tracking
- Completion tracking
- Credits, certificates, AI summaries
- Facilitator marketplace

---

## 3. Architecture

```
Public visitor
  ↓
bookgrok.mandava.in  (homepage — public discovery)
  ↓
Google Form registration  (commitment gate)
  ↓
Hidden access page  (bookgrok.mandava.in/access/?track=TRACK-ID)
  ↓
Google Calendar / Google Meet / Homework Form / Slack channel
```

### Tool roles

| Layer | Tool | Role |
|---|---|---|
| Public discovery | Static BookGrok homepage | Concept hook + track cards |
| Content CMS | Google Sheets (published CSV) | Tracks, sessions, links, images, community fields |
| Registration | Google Form | Name, email, resonance question |
| Member access | Hidden BookGrok access page | Session command center |
| Live session | Google Meet | Video session |
| Calendar | Google Calendar URL | Add sessions to calendar |
| Homework | Google Form file upload | Submit homework/file to Drive |
| Discussion | Slack | Private cohort-track channel |
| Hosting | Vercel | Static site at `bookgrok.mandava.in` |
| Code | Claude Code | Build/maintain static site |

---

## 4. Three-page structure

| Page | URL | Who sees it | Purpose |
|---|---|---|---|
| Homepage | `bookgrok.mandava.in` | Public | Concept hook + track cards |
| Google Form | `forms.gle/...` | Public via Register button | Registration gate + resonance probe |
| Access page | `bookgrok.mandava.in/access/?track=TRACK-ID` | Registered users by obscurity | Session links, calendar, homework, Slack |

The access page URL is the mock gate. It appears **only** on the Google Form confirmation page after submission.

**Known limitation:** Anyone with the access page URL can share it. No true enforcement exists in v8.3. This is acceptable for the mock.

---

## 5. Homepage — what to render

### Required elements (in order)

1. Site name: `BookGrok`
2. Headline: `Most serious books never get finished.`
3. Subhead: `BookGrok brings together a small cohort, a host who has read seriously, and a chapter-by-chapter structure that gets you to the end.`
4. Track cards (one per published track, sorted by `sortOrder`)

### Per track card — render

- Book cover image (`bookCoverUrl`)
- Book title (`title`)
- Author (`author`)
- Host photo (`hostPhotoUrl`)
- Host name (`host`)
- Host role (`hostRole`)
- Session count (`sessionCount` sessions)
- Cadence (`cadence`)
- Start date (derived: `datetimeUTC` of the first published session for this track, formatted to local date)
- Spots remaining (`spotsLeft` of `spotsTotal` spots left)
- Mock price (`price`)
- **Buy the book** button (if `buyBookUrl` is not blank)
- **Register** button (links to `formUrl`, if not blank)

### Homepage — never render

- Meet links
- Calendar links (they contain Meet links)
- Access page URL
- Homework form URL
- Slack channel link or invite
- Full session table

---

## 6. Access page — what to render

### URL pattern

```
/access/?track=TRACK-ID
```

Read `track` from the query string. Match to `id` in the tracks data.

### Required elements

1. Back link: `← All tracks` (links to `/`)
2. Access notice: `You are registered. Bookmark this page.`
3. Track title
4. Author
5. Host name and host role
6. **Buy the book** button (if `buyBookUrl` exists)
7. Full session table (published sessions only, sorted by `number`)
8. Per session row:
   - Session number
   - Chapter description (`chapters`)
   - Date and time in visitor's local timezone
   - `+ Calendar` button (Google Calendar URL)
   - `Join` button (links to `meetLink`)
   - `Submit HW` button (if `homeworkFormUrl` exists on the track)
9. Community block (if `communityPlatform` is not blank):
   - Platform name (`communityPlatform`)
   - Channel name (`communityChannelName`)
   - If `communityUrl` exists: show `Join cohort discussion` link
   - If `communityUrl` is blank but `communityInstructions` exists: show instructions text

---

## 7. `tracks` sheet schema

Each row is one book-track cohort.

### All columns (required)

```
id
status
sortOrder
title
author
host
hostRole
spotsLeft
spotsTotal
sessionCount
cadence
price
bookCoverUrl
hostPhotoUrl
buyBookUrl
formUrl
homeworkFormUrl
communityPlatform
communityChannelName
communityUrl
communityInstructions
```

### Field notes

**`id`** — Stable slug. Lowercase, hyphens only.
Good: `alignment-problem`, `nexus`, `build-llm`
Bad: `The Alignment Problem`, `alignment problem 2`

**`status`** — `published` | `draft` | `archived`. Homepage shows only `published`.

**`sortOrder`** — Integer. Lower number = shown first.

**`bookCoverUrl` / `hostPhotoUrl`** — Public HTTPS image URLs. If blank or invalid, show a fallback placeholder. Never show a broken image tag.

**`buyBookUrl`** — Amazon or publisher link. If blank, hide the button entirely.

**`formUrl`** — Registration form. If blank, hide the Register button.

**`homeworkFormUrl`** — Homework submission form. If blank, hide `Submit HW` buttons on access page.

**`communityUrl`** — Direct Slack invite link. May be blank (private channel, gated manually).

**`communityInstructions`** — Shown when `communityUrl` is blank. Example: `Slack invite will be sent after registration.`

---

## 8. `sessions` sheet schema

Each row is one session.

### All columns (required)

```
trackId
number
chapters
datetimeUTC
durationMins
meetLink
calTitle
calDescription
status
```

### Field notes

**`trackId`** — Must match `id` in the tracks sheet exactly.

**`datetimeUTC`** — Always UTC ISO format ending in `Z`. Example: `2026-07-06T14:00:00Z`. Never store `6 July 7:30 PM`. The site converts UTC to local time.

**`status`** — `published` | `draft` | `cancelled`. Access page shows only `published` sessions.

**`durationMins`** — Integer. Used to calculate calendar event end time.

**`meetLink`** — Full HTTPS URL. Never expose on public homepage.

---

## 9. Google Calendar link generation

Each `+ Calendar` button on the access page generates a static Google Calendar URL.

Format:

```
https://calendar.google.com/calendar/render?action=TEMPLATE
  &text=ENCODED_TITLE
  &dates=YYYYMMDDTHHMMSSZ/YYYYMMDDTHHMMSSZ
  &details=ENCODED_DESCRIPTION_WITH_MEET_LINK
  &location=ENCODED_MEET_LINK
```

Rules:

- Dates must be in UTC, format: `YYYYMMDDTHHMMSSZ` (no dashes, no colons, no milliseconds)
- End time = start time + `durationMins` minutes
- `details` must include chapter description and Meet link
- Use `URLSearchParams` to encode all values
- These links must appear **only** on the access page

---

## 10. Timezone conversion

All session times are stored as UTC. The frontend converts using browser JS:

```js
new Date(datetimeUTC).toLocaleString(undefined, {
  weekday: "short",
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
  timeZoneName: "short"
})
```

No timezone picker. No user input. Visitor always sees their own local time automatically.

---

## 11. Data fetching

### Stage 1 (local development)

Use local sample CSV files:

```
samples/tracks_sample.csv
samples/sessions_sample.csv
```

Load them with `fetch()` relative to the server root.

### Stage 2 (Google Sheets live)

Replace local paths with published Google Sheets CSV URLs in `src/config.js`.

### CSV parsing rules (critical)

- Use PapaParse. Do not write a naive CSV parser.
- `header: true` — first row is headers.
- `skipEmptyLines: true` — ignore blank rows.
- `dynamicTyping: false` — keep all values as strings. Convert numbers explicitly where needed.
- Trim all header names and values after parsing.
- Normalize `status` to lowercase after trimming.
- Log a console warning for any row with a missing `id` or `trackId`.

### URL validation

Before rendering any link or image:

- Check that the URL starts with `https://` or `http://`
- If blank or invalid, hide the element — never show a broken link or broken image
- Never render a `javascript:` URL

### XSS prevention

- Escape all text values from the CSV before inserting into the DOM.
- Use `textContent` for text nodes.
- Only use `innerHTML` where strictly necessary and only with pre-escaped content.
- Never inject raw CSV content into `innerHTML` directly.

---

## 12. File structure

```
bookgrok-mock/
  CLAUDE.md               ← Claude Code instruction file
  AGENTS.md               ← Mirror of CLAUDE.md (for compatibility)
  index.html              ← Public homepage shell
  styles.css              ← Shared styles
  README.md               ← Setup and operating instructions

  access/
    index.html            ← Access page shell

  src/
    config.js             ← CSV URLs (edit once)
    data.js               ← Fetch, parse, validate CSV data
    app.js                ← Homepage render logic
    access.js             ← Access page render logic

  assets/
    books/                ← Fallback book cover placeholder
    hosts/                ← Fallback host photo placeholder

  samples/
    tracks_sample.csv     ← Full schema sample (all columns)
    sessions_sample.csv   ← Full schema sample

  docs/
    bookgrok_v8_3_claudecode_handoff.md  ← This file
```

---

## 13. `src/config.js`

```js
const CONFIG = {
  tracksCsvUrl: "samples/tracks_sample.csv",
  sessionsCsvUrl: "samples/sessions_sample.csv"
};

// Stage 2: replace with published Google Sheets CSV URLs
// const CONFIG = {
//   tracksCsvUrl: "https://docs.google.com/spreadsheets/d/SHEET_ID/gviz/tq?tqx=out:csv&sheet=tracks",
//   sessionsCsvUrl: "https://docs.google.com/spreadsheets/d/SHEET_ID/gviz/tq?tqx=out:csv&sheet=sessions"
// };
```

---

## 14. Registration form

Create one Google Form per track.

### Fields

1. First name — short answer, required
2. Email — short answer, required, email validation
3. What have you tried before that did not work? — paragraph, required

Helper text for question 3:

```
Reading alone, book clubs, summaries, courses — honest is fine.
```

### Confirmation message

```
You are registered.

Your session access page:
https://bookgrok.mandava.in/access/?track=TRACK-ID

Bookmark this page. It has your Join links, calendar buttons, homework submission, and cohort discussion instructions.

Please buy or borrow the book before Session 1.
```

Replace `TRACK-ID` with the track's `id` value from the sheet.

The form response Sheet becomes the member list for that track.

---

## 15. Slack setup

### Workspace

One BookGrok Slack workspace. Example channels:

```
#announcements
#help
#nexus-jul-2026
#thinking-machine-jul-2026
#empire-of-ai-jul-2026
#ai-snake-oil-jul-2026
#build-llm-aug-2026
```

### Channel naming convention

`#book-slug-month-year`

### Manual gating flow (v8.3)

1. Member registers via Google Form.
2. Email appears in Google Sheet.
3. Host manually invites them to BookGrok Slack workspace.
4. Host manually adds them to the correct private channel.
5. Access page shows: `Slack invite will be sent after registration.`

Do not automate Slack invites in v8.3. That requires Slack API setup and is out of scope.

---

## 16. Operations: managing tracks and sessions

### Add a track

1. Add row to `tracks` sheet with `status = draft`
2. Add session rows to `sessions` sheet
3. Create Google Form (registration)
4. Create Google Form (homework, if needed)
5. Create Google Meet link
6. Create Slack private channel
7. Add all URLs to the sheet
8. Test access page at `/access/?track=TRACK-ID`
9. Set `status = published`

No code changes required.

### Edit a track

Edit cells in the `tracks` sheet. No code changes. If changes affect registered members, email them from the Google Sheet.

### Archive a track

Set `status = archived`. Do not delete unless it was never shared.

### Add a session

Add row to `sessions` sheet with `status = published`. If registrants already added sessions to their calendar, email them — calendar events do not auto-update.

### Cancel a session

Set `status = cancelled`. The access page hides cancelled sessions.

### Revoke access (emergency)

1. Rotate the Google Meet link(s)
2. Update the sheet
3. Optionally rotate the access page URL by changing the track `id`
4. Email remaining members with updated links

---

## 17. Known limitations

1. Access is by hidden URL only — anyone with the URL can share it.
2. Published Google Sheet CSV data is public — do not put sensitive data in the sheet.
3. Slack invites are manual — no automation.
4. Homework file upload requires Google sign-in.
5. Calendar events do not auto-update after sheet changes.
6. Meet links can be shared.
7. No payment, no true member state, no access revocation, no prep/attendance/completion tracking.

These are all acceptable for v8.3.

---

## 18. Build sequence

### Step 1 — Claude Code: review and plan

```
Read CLAUDE.md and docs/bookgrok_v8_3_claudecode_handoff.md.
Do not write code yet.
Produce an implementation plan:
- files you will create
- rendering logic for homepage and access page
- how you will handle missing/invalid field values
- how you will prevent homepage from leaking gated links
- build order
```

Review the plan. If it proposes Supabase, React, backend, auth, or Slack API — stop and correct.

### Step 2 — Claude Code: build Stage 1

```
Implement Stage 1 using samples/tracks_sample.csv and samples/sessions_sample.csv.
Create all files per the folder structure.
Homepage must render headline, subhead, and track cards.
Access page must render session table with Calendar and Join buttons.
Homepage must never expose Meet links, Calendar links, homework, Slack, or access URLs.
```

### Step 3 — Test locally

```bash
python -m http.server 8000
```

Check:
- `http://localhost:8000` — homepage loads, headline visible
- `http://localhost:8000/access/?track=nexus` — access page loads
- Calendar buttons generate correct events
- Join links only on access page
- Submit HW visible only if `homeworkFormUrl` exists
- Slack block shows correct instructions
- Mobile: session table scrolls or stacks correctly

### Step 4 — Stage 2: Google Sheets CMS

Create Google Sheet, add `tracks` and `sessions` tabs, paste sample data, publish both tabs as CSV, replace paths in `config.js`. Test live fetch.

### Step 5 — Deploy

```bash
git init
git add .
git commit -m "BookGrok mock v8.3"
git remote add origin YOUR_GITHUB_REPO_URL
git branch -M main
git push -u origin main
```

In Vercel: import repo, framework preset Other, build command empty, output directory empty, deploy, add `bookgrok.mandava.in` domain, add CNAME record from Vercel's settings.

---

## 19. Success criteria

### Mechanical

1. Homepage loads from CSV data.
2. Editing the sheet updates the homepage (allow a few minutes for CSV cache).
3. Public homepage never exposes Meet/Calendar/Homework/Slack/access links.
4. Register button opens correct Google Form.
5. Form confirmation gives the correct access page URL.
6. Access page renders correct session table in local timezone.
7. Calendar links create correct events with Meet link embedded.
8. Join links open Google Meet.
9. Submit HW opens Google Form upload (if URL exists).
10. Community block shows channel name and instructions.
11. Host can manage most changes from Google Sheets without touching code.

### Concept

Form responses should contain pain language like:

- "I never finish serious books."
- "I stall halfway."
- "Book clubs are too casual."
- "Summaries are not enough."
- "I need a group to show up with."

If responses are generic, rewrite the homepage hook before building more.

---

## 20. When to move beyond v8.3

Move beyond v8.3 only after concept and mechanical flow both pass.

Next version tests the accountability loop:

- Real payment (Stripe or Razorpay)
- Per-session link drip
- Prep status before each session
- Cohort roster visible to members
- Post-session summary delivery
- Attendance visibility

At that point: Supabase + Next.js. Firebase Auth with Google Sign-In as the auth layer.
