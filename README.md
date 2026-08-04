# BookGrok Mock v8.4

Static prototype for bookgrok.mandava.in. Tests whether the concept resonates — that dense, demanding nonfiction gets finished with a cohort, a host, and structure — plus the mechanical flow (discover → register → access → join).

## What changed from v8.3

- Homepage cards show Register + Share only (Buy the book moved to access page)
- Flat `$9` pricing, no euros
- `hostLinkedIn` field added — renders as an icon link in the host block (homepage and access page)
- Share control (copy URL + mailto) on homepage and access page
- Homepage split into "Open now" and "Full library"
- 30 curated dense-nonfiction tracks

## Conceptual map

Start here if you're new to the repo — this is the top-down view before the
file-by-file listing further down.

**What this is:** BookGrok tests whether people will commit to reading dense
nonfiction in a small cohort with a host, on a chapter-by-chapter schedule.
A visitor browses tracks (book+cohort offerings) on the homepage, registers
via a Google Form, and lands on a private "access page" holding their
session schedule, Meet links, calendar buttons, and community info. Plain
HTML/CSS/JS, Google Sheets as the database — no backend, no auth, no real
payment.

**Major subsystems:**

| Subsystem | Job | Files |
|---|---|---|
| Data layer | Fetch + parse the two Google Sheets CSVs, hand back plain JS objects | `src/config.js`, `src/data.js`, `src/papaparse.min.js` |
| Homepage | Render the public track list, search, entrance animation | `index.html`, `src/app.js`, `src/search.js` |
| Access page | Render the gated per-track member hub | `access/index.html`, `src/access.js` |
| Share | Copy-link + mailto, used by both pages | `src/share.js` |
| Styling | All visual design, one shared stylesheet | `styles.css` |
| Session-host tools | Standalone timer/wheel/question tool a host runs live during a session | `tools/*.js`, `tools/session-host.html` |
| Ops & validation | Scripts a human runs manually — not part of the live site | `scripts/*.js` |
| Content & rules | Sample data, docs, and the instructions governing how this repo should be worked on | `samples/*.csv`, `docs/*.md`, `CLAUDE.md`, `AGENTS.md`, `README.md` |

**Inside each subsystem:**

- *Data layer* — `config.js` holds the two published-CSV URLs. `data.js`'s
  `loadData()` fetches both in parallel via PapaParse, filters to
  `status=published`, sorts, and returns `{tracks, sessions}` — this return
  value is the seam where Sheets could later be swapped for a real backend
  without touching anything downstream. `data.js` also holds shared helpers
  used everywhere: `escapeHtml`, `isValidUrl`, date formatters,
  `buildCalUrl()`.
- *Homepage* — see "How data actually flows" below for the exact load order.
  `renderHomepage()` splits tracks into "Open now" / "Full library" and
  calls `buildTrackCard()` per track, which composes six smaller pieces
  (cover, host block, seat math, price math, meta lines, commitment line).
  `search.js` filters the already-loaded tracks client-side and re-calls the
  same card builder.
- *Access page* — reads `?track=` from the URL, finds the matching track,
  and renders four blocks in sequence: notice banner, top actions
  (Buy/Share/Session tools), session table (Join/Calendar/Submit HW per row
  — gated, never shown on the homepage), community block.
- *Share* — one small file both pages call into: builds a public per-track
  URL, copies it, offers a prefilled mailto.
- *Session-host tools* — a separate, self-contained dark-mode page
  (`tools/session-host.html`) linked from the access page's "Session tools"
  button. Uses ES modules (the one place in the repo that does) — timer with
  an SVG hourglass, a random-name-picker wheel, an editable
  discussion-question box, a cover-image display.
- *Ops & validation* — `validate-tracks.js` checks a CSV before a host
  publishes a track. `smoke-test.js` and `screenshot-check.js` are
  Playwright-based (structural checks vs. visual screenshots).
  `extract-cover-colors.js` is a one-off color-extraction tool feeding the
  `coverTint` CMS column. None of these run automatically — all are manual
  `npm run ...` commands.

**Pointers, not explanations — go read the code/docs directly for these:**

- Card-building internals → `src/app.js`: `buildCoverMarkup`,
  `buildHostBlockMarkup`, `computeSeatState`, `computePriceDisplay`,
  `buildMetaLines`, `buildCommitmentAndIncludes`
- Amazon cover-image URL rewriting → `amazonResizedUrl()` in `src/app.js`
- Full data schema (every column, required/optional, visibility rules) →
  `docs/bookgrok_data_model_v8_4.md`
- How a host adds a new track end-to-end →
  `docs/host_add_track_runbook.md`
- Pure-logic test coverage → `tests/logic.test.js`
- Standing engineering judgment-call rules → `CLAUDE.md`, "Engineering
  bars" section

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
first calls `initHeaderScrollHairline()` (before any data has loaded — it's
a scroll-position effect, not data-dependent), then `loadData()`, then
`renderHomepage()`, then `initSearch()`. `initShareButtons()` and
`initCardEntranceObserver()` aren't called directly by `init()` — they're
called from inside `renderHomepage()` itself, right after it sets the card
HTML.

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
