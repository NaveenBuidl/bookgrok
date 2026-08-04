# BookGrok Mock v8.4

Static prototype for bookgrok.mandava.in. Tests whether the concept resonates — that dense, demanding nonfiction gets finished with a cohort, a host, and structure — plus the mechanical flow (discover → register → access → join).

## What changed from v8.3

- Homepage cards show Register + Share only (Buy the book moved to access page)
- Flat `$9` pricing, no euros
- `hostLinkedIn` field added — renders as an icon link in the host block (homepage and access page)
- Share control (copy URL + mailto) on homepage and access page
- Homepage split into "Open now" and "Full library"
- 30 curated dense-nonfiction tracks

## Local development

```bash
python -m http.server 8000
```

- Homepage: `http://localhost:8000`
- Access page: `http://localhost:8000/access/?track=nexus`

Test track IDs include: `nexus`, `empire-of-ai`, `the-scaling-era`, `the-coming-wave`, `ai-snake-oil`, `build-llm`, and 24 more in the Full library.

`npm run test` runs plain Node-assert checks (`tests/logic.test.js`) against
the pure price/seat-math/date-formatting logic — no framework, no new
dependency. It's runnable on demand only: nothing else in the repo calls it
(no pre-commit hook, no CI). Wiring it into either is a deliberate later
decision, not an oversight — revisit once there's a reason to make it a gate
rather than an opt-in check.

## File structure

```
CLAUDE.md / AGENTS.md   Instructions
index.html              Homepage
access/index.html       Access page
styles.css              Shared styles
src/config.js           CSV URLs (absolute paths) + featuredCount
src/data.js             Fetch, parse, validate
src/share.js            Share control (copy URL + mailto)
src/search.js           Homepage search + not-found demand logging
src/app.js              Homepage render (Open now / Full library)
src/access.js           Access page render
tests/logic.test.js     Plain-assert tests for price/seat/date logic (npm run test)
samples/tracks_sample.csv     30 tracks
samples/sessions_sample.csv   37 sessions (first 6 tracks)
docs/bookgrok_v8_4_claudecode_handoff.md
docs/bookgrok_data_model_v8_4.md
bookgrok-origin/index.html    Finished draft landing page, predates the bookgrok.io
                               domain migration and current Newsreader/Inter type
                               system. Intentionally unlinked — parked pending a
                               future cleanup pass, not part of the active site.
```

### How data actually flows

`index.html` loads scripts in order: PapaParse → `config.js` (sets `CONFIG`,
the CSV URLs) → `data.js` (defines `loadData()`, which fetches + parses both
CSVs) → `share.js` → `search.js` → `app.js`. `app.js`'s trailing `init()`
calls `loadData()`, then `renderHomepage()`, then `initSearch()` and
`initShareButtons()`.

One non-obvious forward reference: `search.js` loads *before* `app.js` in
the tag order, and registers its input listener immediately — but that
listener only *calls* `app.js`'s `renderHomepage()` later, when the user
types. By then `app.js` has finished loading, so this works, but reading the
tag order top-to-bottom alone doesn't make the dependency obvious.

`access/index.html` shares the exact same `loadData()` path, but its
`access.js` calls `renderAccessPage()` instead of `app.js`'s
`renderHomepage()` — `access.js` never loads `app.js` at all, it has its own
render functions.

## Switching to Google Sheets (Stage 2)

1. Create a Sheet with `tracks` and `sessions` tabs
2. Paste headers + data from `samples/`
3. Format `datetimeUTC` column as Plain text
4. Publish each tab as CSV (File → Share → Publish to web → CSV)
5. Update `src/config.js` with the two published URLs (keep `featuredCount`)

## Operations

Add/edit/archive tracks and sessions in the Sheet. No code changes. Within one hour of a registration, email the access link from the Form response sheet — this prevents lost-link drop-off from contaminating the concept-resonance test.

## Known limitations

URL-obscurity gating · public CSV (no sensitive data) · manual Slack invites · homework needs Google sign-in · calendar events don't auto-update · no payment/auth/member-state.

## Success criteria

**Mechanical:** homepage renders from CSV; Open now / Full library split works; no gated links on homepage; Register opens form; Share copies URL; access page shows correct sessions in local time; Calendar/Join/HW gated; community block correct.

**Concept:** Form Q3 responses contain language like "I bought it and never finished," "I always stall on the dense ones," "book clubs are too light," "I need people to read it with." Generic responses mean rewrite the headline/subhead.
