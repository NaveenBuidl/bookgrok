# Host Runbook — Add a Track (v8.4)

For a host adding a new track end-to-end, with no code changes and no
developer involved. Follow the stages in order. Each stage names the tool
you're in, what you do, and what you paste back into the Sheet.

Two stages depend on the canonical templates below — duplicate them, don't
build from scratch:

- **Registration Form template:** https://forms.gle/vaMuzdewgotzjCE4A
- **Meet link (reusable room):** https://meet.google.com/onz-rsai-ork

**Meet link convention:** this is one personal Meet room, reused as the
`meetLink` value for *every session row, in every track*. It is not a
per-track or per-session link. Confirmed against `samples/sessions_sample.csv`,
where every session belonging to the same track already repeats one
identical Meet URL across all its rows. Paste the same URL into every
session row you add.

Before publishing, run the validation script (Stage 11) — see
`scripts/validate-tracks.js`.

---

## Stage 1 — Draft the track row

**Tool:** Google Sheets (`tracks` sheet)

Insert a new row with `status = draft`. Fill in:

- `id` — slug: lowercase, hyphens only, no spaces (e.g. `the-way-of-excellence`). Must be unique and must match the `trackId` you'll use on every session row.
- `sortOrder` — an integer. Checkpoint: see below — do not reuse a number already in use by another **published** track.
- `title`, `author`, `category`, `host`, `hostRole`, `hostLinkedIn` (LinkedIn URL is stored but not rendered anywhere in v8.4 — fine to leave blank).
- `spotsLeft`, `spotsTotal` — spotsTotal is your cohort cap (typically 8); spotsLeft starts equal to spotsTotal.
- `sessionCount` — fill this in only after Stage 2 is done (see checkpoint below).
- `cadence` — human-readable, e.g. `Weekly, Mondays`.
- `price` — must be exactly `$9`. Nothing enforces this in code; it's a free-text cell.
- `bookCoverUrl`, `hostPhotoUrl` — see Stage 8 for how to source these.
- Leave `formUrl`, `homeworkFormUrl`, `buyBookUrl`, `communityUrl` blank for now — filled in later stages.

Two columns exist in the sheet (`sub-title`, `pagecount`) that **nothing in the code reads**. You can fill them for your own reference, but they will not appear anywhere on the site. Don't rely on them.

> **Checkpoint 1 — sortOrder collision.** Before moving on, scan the `tracks` sheet for any other row with `status = published` and the same `sortOrder` value. Nothing in the code de-duplicates this — a collision doesn't error, it just ties by array order, and your new track may render in an unpredictable position relative to the other. Fix by picking an unused integer (highest existing + 1 is simplest).

---

## Stage 2 — Add session rows

**Tool:** Google Sheets (`sessions` sheet)

One row per session. For each row:

- `trackId` — must exactly match the `id` from Stage 1.
- `number` — 1, 2, 3… in order.
- `chapters` — reading assignment / description shown to registrants.
- `datetimeUTC` — **must be genuine UTC, and must end in `Z`.** See checkpoint below — this is the single most common silent-corruption point.
- `durationMins` — integer, e.g. `90`.
- `meetLink` — paste the canonical Meet template URL (see top of this doc) into every row.
- `calTitle`, `calDescription` — shown in the generated `+Calendar` button (see Stage 6 — no separate calendar action needed).
- `status` — leave as `draft` until Stage 11.

> **Checkpoint 2 — UTC correctness.** `datetimeUTC` is trusted as-is and converted straight to the visitor's local time client-side (`formatLocalDatetime` in `src/data.js`). There is no timezone picker and no server-side correction. If you type your own local time here without converting to UTC first, every visitor sees the wrong session time and nothing will look broken — the field parses fine, it's just wrong. Convert deliberately (e.g. "Saturday 2pm IST" → `08:30:00Z`) before pasting.
>
> **Checkpoint 3 — sessionCount match.** Once all session rows for this track are added, count how many have (or will have) `status = published`, and set the track row's `sessionCount` field (Stage 1) to that number. Nothing cross-checks these two — a mismatch won't error, it will just make the homepage/access page session count claim wrong relative to what's actually listed.

---

## Stage 3 — Create the registration Form `[template available]`

**Tool:** Google Forms

Duplicate the canonical template: https://forms.gle/vaMuzdewgotzjCE4A

1. Open the template, use Forms' "Make a copy" (⋮ menu).
2. Rename the copy to match this track (e.g. "BookGrok — The Way of Excellence — Registration").
3. Update any book-specific text in the description if the template has placeholder copy.
4. Do not change the three question fields (First name; Email; "What have you tried before that didn't work?") — the resonance-signal question is the point of the product test; keep it as-is.
5. Set the confirmation message per handoff doc §11 (bookmark-emphatic access link), substituting this track's `id` into the access URL.
6. Get the shareable Form link (Send → link icon).

**Paste into Sheet:** `formUrl` on the track row (Stage 1).

> **Checkpoint 4 — real URL, not placeholder.** Before leaving this stage, open the `formUrl` value in a private/incognito tab and confirm it loads a real, live Google Form — not a `REPLACE_*` placeholder string left over from copying another row. A placeholder is not `http(s)://`, so `isValidUrl()` fails and the Register button on the homepage **silently disappears** — no console warning visible to a non-technical host, the card just renders without a Register button.

---

## Stage 4 — Create the homework Form (optional)

**Tool:** Google Forms

Only needed if this track has a homework/submission component. If not, skip — `homeworkFormUrl` stays blank and the "Submit HW" button is correctly hidden on the access page.

If needed: duplicate the same registration template or build a minimal single-question upload/text Form, matching this track's chapter structure.

**Paste into Sheet:** `homeworkFormUrl` on the track row.

---

## Stage 5 — Set up the Meet link `[template available]`

**Tool:** Google Meet

Use the canonical reusable Meet room: `https://meet.google.com/onz-rsai-ork`

No new Meet room is created per track or per session. This single URL is pasted as the `meetLink` value on **every session row** for **every track** (you likely already did this in Stage 2 — this stage is a confirmation checkpoint, not new work).

> **Checkpoint 5 — Meet link validity.** Same real-URL check as Checkpoint 4: confirm every session row's `meetLink` is the live template URL above, not blank or a leftover placeholder. A blank/invalid `meetLink` hides the "Join" button on that session row on the access page — again silently, no error.

---

## Stage 6 — Calendar

**Tool:** none — no host action.

The `+ Calendar` button on the access page is generated client-side from each session's `calTitle`, `calDescription`, `datetimeUTC`, and `durationMins` (see `buildCalUrl()` in `src/data.js`). There is no separate calendar-creation step and no Calendar API call. As long as Stage 2's session fields are correct, this works automatically.

Note: if you later edit a session's date/time after registrants have already added it to their own calendars, their existing calendar entries do **not** auto-update (per handoff doc §12/§13). Email registrants directly for schedule changes.

---

## Stage 7 — Create the Slack channel

**Tool:** Slack (manual — no API, no Google Chat, no automated invite)

1. Create a channel named to match the track, e.g. `#the-way-of-excellence-cohort`.
2. Decide your invite mechanism: either a Slack invite link you place in `communityUrl`, or manual-invite instructions you place in `communityInstructions` (used only if `communityUrl` is blank).

**Paste into Sheet:** `communityPlatform = Slack`, `communityChannelName`, and either `communityUrl` or `communityInstructions`.

---

## Stage 8 — Source book cover and host photo images

**Tool:** browser (image hosting — see convention below)

`bookCoverUrl` and `hostPhotoUrl` must be public, direct-loading image URLs (`http`/`https`, no auth wall). If blank or invalid, the site falls back to initials — not broken, but worth avoiding deliberately.

**Convention — book cover:** reuse the Amazon product image URL, same as every row in the existing sample data (e.g. `https://m.media-amazon.com/images/I/....jpg`). Find the book's Amazon listing, right-click the cover image, "Copy image address." This is already the pattern in `samples/tracks_sample.csv` — no new convention needed, just keep using it.

**Convention — host photo:** use a Google Drive share link converted to a direct-view URL:

1. Upload the photo to Drive, set sharing to "Anyone with the link."
2. Copy the share link: `https://drive.google.com/file/d/FILE_ID/view?usp=sharing`
3. Transform it to direct-view format: `https://drive.google.com/uc?export=view&id=FILE_ID`
4. Paste the transformed URL (step 3's format) into `hostPhotoUrl` — not the raw share link from step 2, which will not render as an image.

> **Checkpoint 6 — image URL sanity.** Paste both URLs into a fresh private browser tab. If either doesn't render a bare image (e.g. shows a Google login wall or a "request access" page), it will silently fall back to initials on the live site. Fix sharing permissions before publishing.

---

## Stage 9 — Final paste-back pass

**Tool:** Google Sheets

Before publishing, re-scan the track row and all its session rows for any leftover `REPLACE_*` string, blank required field, or copy-pasted value from a different track (a common mistake when duplicating an existing row as a starting point — e.g. a `communityChannelName` that still says `#nexus-cohort` on a different track's row).

---

## Stage 10 — Test on the access page before publishing

**Tool:** browser, local or deployed site

Visit `/access/?track=YOUR-TRACK-ID` and confirm:

- Title, author, host render correctly.
- Session table shows the expected number of rows, correct dates in your local time (cross-check one against the UTC value you entered).
- `+ Calendar` and `Join` buttons appear on each session row.
- `Submit HW` appears only if you set a `homeworkFormUrl`.
- Community block shows the right channel name and either a working Join link or your instructions text.
- `Buy the book` appears if `buyBookUrl` is set.

> **Checkpoint 7 — zero-session publish.** If the session table shows the "No sessions scheduled yet" empty state and that's *not* intentional (i.e., you meant to have sessions live at launch), stop — do not flip to published yet. A published track with zero published sessions is valid per the data model but is very likely not what you meant to ship.

---

## Stage 11 — Run the validation script, then publish

**Tool:** terminal, then Google Sheets

Export both sheets as CSV (or point the script at the published CSV URLs — see script header) and run:

```
node scripts/validate-tracks.js
```

Fix anything it flags. Then, in the Sheet:

1. Set every intended session row's `status` to `published`.
2. Set the track row's `status` to `published`.
3. Re-visit the access page once more to confirm it now matches the "registered" (non-preview) view.

Done.
