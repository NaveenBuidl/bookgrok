# BookGrok Prototype v8.4 — Claude Code Handoff

## 0. Version summary

**Version:** v8.4
**Tool:** Claude Code
**Goal:** A same-day static BookGrok prototype that tests one thing above all — **does the concept resonate**: that serious, dense nonfiction gets finished when you read it with a small cohort, a host, and a structure. The mechanical flow (discover → register → access → join) is the vehicle for that test.

### What changed from v8.3

1. **Homepage cards: Register only.** "Buy the book" removed from homepage cards. It remains on the access page (post-registration is the right moment to nudge purchase).
2. **Pricing: flat `$9`, no euros, anywhere.** This is mock pricing to make the gate feel real — not the eventual price.
3. **Host name → LinkedIn (feature-flagged).** New `hostLinkedIn` field in the schema. Stored but NOT rendered as a link in v8.4. Reserved for a later version. Do not build the link behavior now.
4. **Share-with-colleague feature.** A "Share" control on both homepage cards and the access page. Copies the track URL to clipboard (and offers a prefilled mailto). This serves BookGrok's anti-isolation DNA — bring a peer.
5. **Book curation: 30 dense, serious, long-form nonfiction titles.** The anti-book-club. Books people buy and abandon. Mix of recent-popular (2023–2025) and Lindy (time-tested). See `samples/tracks_sample.csv`.
6. **Homepage structure: "Open now" + "Full library".** With 30 tracks, the homepage features a small set at top and lists the rest below, so a first-time visitor grasps the concept before facing the full wall.
7. **Homepage search with demand tracking.** A client-side search bar filters tracks by title, author, or category. When a search returns nothing, the query is logged to a Google Form (the demand signal — what people want that isn't offered), and the empty state links to a "request a book" form. New file `src/search.js`; new `CONFIG.requestBookUrl`.

---

## 1. Product concept (the thing being tested)

### Homepage headline

**Most serious books never get finished.**

### Homepage subhead

**BookGrok brings together a small cohort, a host who has read seriously, and a chapter-by-chapter structure that gets you through the books that matter — the dense, demanding ones you keep meaning to read.**

### Product thesis

- The target book is **dense, long-form, demanding nonfiction** — the kind that needs real thinking and working-through. The opposite of light book-club fare.
- These are books people **buy and abandon**: Gödel Escher Bach, Capital, The Power Broker, Being and Time, Infinite Jest.
- Solo reading fails on these. The cohort, the host, and the chapter structure are the completion mechanism.
- Completion is the product. Anti-isolation is the philosophy.

This is not decorative copy. Render the headline and subhead above the track listing on the homepage. They are the resonance test.

---

## 2. What v8.4 tests

### Primary (concept)

Does a serious reader, seeing this, think: *"Yes — this is how I'd finally get through [that book I never finished]"*? The signal lives in registration-form responses to "What have you tried before that didn't work?"

### Secondary (mechanical)

1. Can a cold visitor understand the concept within 10 seconds?
2. Can they evaluate a track from book, author, category, host, cadence, start date, spots, price?
3. Does the Google Form registration feel like a real commitment gate?
4. Does the hidden access page work as a member hub?
5. Do calendar links, Meet links, homework, and Slack instructions render correctly and only after registration?
6. Does the Share control work?
7. Can the host operate everything from a Google Sheet without touching code?

### Does not test (deferred)

Real payment, auth, access enforcement, Slack automation, prep visibility, attendance, completion tracking, host LinkedIn links, member identity.

---

## 3. Architecture (unchanged from v8.3)

```
Public homepage  →  Google Form (gate)  →  Hidden access page  →  Meet / Calendar / Homework / Slack
```

Static HTML/CSS/JS on Vercel. Google Sheets (published CSV) as CMS. No backend, no auth, no payment.

---

## 4. Three-page structure

| Page | URL | Visibility | Purpose |
|---|---|---|---|
| Homepage | `bookgrok.mandava.in` | Public | Concept hook + "Open now" + "Full library" |
| Google Form | `forms.gle/...` | Public via Register | Registration + resonance probe |
| Access page | `bookgrok.mandava.in/access/?track=TRACK-ID` | Registered (by obscurity) | Sessions, calendar, homework, Slack, share |

Access gating is simulated by URL obscurity. Not secure. Acceptable for the mock.

---

## 5. Homepage — rendering requirements

### Required, in order

1. Wordmark: `BookGrok`
2. Headline: `Most serious books never get finished.`
3. Subhead (as in §1)
4. **Search bar** — filters tracks by title, author, or category (client-side)
5. **"Open now"** section — featured tracks (the first N by `sortOrder`, default N=6)
6. **"Full library"** section — the remaining published tracks

### Per track card — render (public fields only)

- Book cover (or initials fallback)
- Host photo (or initials fallback)
- Title
- Author
- Category (small label/eyebrow)
- Host name + host role
- Session count · cadence · start date (derived from first session)
- Spots remaining + progress bar
- Price (`$9`)
- **Register** button → `formUrl`
- **Share** control → copies track URL, offers mailto

### Homepage — NEVER render

Meet links · calendar links · homework URLs · Slack links · access page URL · "Buy the book" · `hostLinkedIn` link.

### Share control behavior

On click: copy the track's public URL to clipboard (homepage anchors to the card, e.g. `bookgrok.mandava.in/#track-nexus`). Show a brief "Link copied" confirmation. Optionally provide a `mailto:` with a prefilled subject and body inviting a colleague. No backend, no tracking in v8.4.

### Search behavior

A search input sits between the subhead and the track sections. As the user types, it filters the already-loaded tracks (no refetch) by `title`, `author`, or `category` — case-insensitive substring match. Empty input restores the "Open now" / "Full library" view.

When a search returns **zero** matches:
- Render an empty state: "No tracks for '[query]' yet" plus a link to `CONFIG.requestBookUrl` ("request this book").
- After a 1.2s debounce (so one search logs once, not per keystroke), POST the raw query to a hidden "search log" Google Form via `fetch(..., { mode: "no-cors" })`. Configure the form action URL and entry ID in `src/search.js`. Until configured, missed queries `console.log` instead.

This is the demand-capture mechanism: the search-log Sheet becomes a running list of books people want that BookGrok doesn't yet offer — direct input to the curation roadmap.

---

## 6. Access page — rendering requirements

URL: `/access/?track=TRACK-ID`. Read `track` from query string, match to Track `id`.

### Required

1. Back link `← All tracks` → `/`
2. Access notice: `You are registered. Bookmark this page.`
3. Title, author, category
4. Host name + role (no LinkedIn link in v8.4)
5. **Buy the book** (if `buyBookUrl`)
6. **Share** control (same behavior as homepage, shares the public track URL)
7. Session table (published sessions, ordered by `number`):
   - Session number
   - Chapter description
   - Date + time in visitor local timezone
   - `+ Calendar` button
   - `Join` button (`meetLink`)
   - `Submit HW` button (if `homeworkFormUrl`)
8. Community block (if `communityPlatform`):
   - Platform + channel name
   - `Join cohort discussion` link if `communityUrl`, else `communityInstructions`

---

## 7. Data model

Full model in `docs/bookgrok_data_model_v8_4.md`. Summary: two physical tables (Track, Session) joined on `trackId = id`. Host denormalized into Track. Registration and Member are logical-only (Google Form). Field visibility rules in §8 of the data model are security-critical and mirror §5/§6 here.

### tracks schema (21 columns)

```
id, status, sortOrder, title, author, category, host, hostRole, hostLinkedIn,
spotsLeft, spotsTotal, sessionCount, cadence, price,
bookCoverUrl, hostPhotoUrl, buyBookUrl, formUrl, homeworkFormUrl,
communityPlatform, communityChannelName, communityUrl, communityInstructions
```

### sessions schema (9 columns)

```
trackId, number, chapters, datetimeUTC, durationMins, meetLink,
calTitle, calDescription, status
```

---

## 8. Sample data

`samples/tracks_sample.csv` — 30 curated tracks.
`samples/sessions_sample.csv` — full sessions for the first 6 tracks (37 rows), exercising every rendering path. The remaining 24 tracks render on the homepage from their track row; their sessions are added in the Sheet during operations. A track with no sessions shows an empty-state on its access page — this is handled.

### The 30 books (why these)

Selected for one property: **dense, demanding nonfiction people buy and don't finish alone.** Categories: Technology & Society, History & Civilization, Economics & Money, Mind & Behavior, Philosophy, Science, Politics & Power, Literature & Ideas. Mix of recent-popular (Nexus, Empire of AI, The Scaling Era, The Coming Wave, AI Snake Oil) and Lindy (The Republic, Meditations, Wealth of Nations, Gödel Escher Bach, The Power Broker, Debt, Being and Time, The Brothers Karamazov). The two literature entries (Karamazov, Infinite Jest) are included as demanding long-form that fits the "never finished" thesis even though not nonfiction — flag for the founder to confirm whether to keep fiction in scope.

---

## 9. Technical rules (carried from v8.3, still binding)

### CSV
- PapaParse. No naive parser.
- `header: true`, `skipEmptyLines: true`, `dynamicTyping: false`.
- Trim headers and values. Lowercase `status`. Warn on missing `id`/`trackId`.

### Paths
- CSV URLs in `config.js` must be **absolute** (`/samples/...`) so the access page (in `/access/`) resolves them from root. This was a v8.3 bug — keep them absolute.

### Security
- Validate URLs (`http`/`https` only) before rendering. Hide element if blank/invalid.
- Escape all CSV text before DOM insertion. No raw `innerHTML` of CSV content.
- Never render `javascript:` URLs.

### Timezone
- Store UTC, convert with `toLocaleString(undefined, ...)`. No timezone picker.

### Calendar
- `YYYYMMDDTHHMMSSZ` format, end = start + `durationMins`. Embed Meet link in details + location. Access page only.

---

## 10. File structure

```
bookgrok-mock/
  CLAUDE.md
  AGENTS.md
  index.html
  styles.css
  README.md
  access/
    index.html
  src/
    config.js      (absolute CSV paths, featuredCount, requestBookUrl)
    data.js        (fetch, parse, validate, escape, helpers)
    app.js         (homepage render: Open now + Full library + Share)
    access.js      (access page render + Share)
    share.js       (share control: copy URL + mailto)
    search.js      (homepage search + not-found demand logging)
  assets/
    books/         (fallback placeholder)
    hosts/         (fallback placeholder)
  samples/
    tracks_sample.csv     (30 tracks)
    sessions_sample.csv   (37 sessions, first 6 tracks)
  docs/
    bookgrok_v8_4_claudecode_handoff.md
    bookgrok_data_model_v8_4.md
```

`share.js` and `search.js` are new in v8.4. Everything else carries from v8.3 with the changes in §0.

---

## 11. Registration form

Per track. Fields: First name; Email; "What have you tried before that didn't work?" (paragraph, helper: *Reading alone, book clubs, summaries, courses — honest is fine.*).

**Confirmation message (emphatic bookmark):**

```
You are registered for [BOOK].

YOUR ACCESS PAGE — BOOKMARK IT NOW:
https://bookgrok.mandava.in/access/?track=TRACK-ID

This page has your Join links, calendar buttons, homework, and cohort discussion. If you lose it, reply to the confirmation email.

Please buy or borrow the book before Session 1.
```

**Host obligation (new in v8.4):** Within one hour of a registration, email the access link from the Form response sheet. This prevents lost-link drop-off from contaminating the concept-resonance signal.

---

## 12. Operations (Google Sheets as CMS)

Add/edit/archive tracks and sessions by editing the Sheet. No code changes. Add a track: insert track row (`status=draft`), add session rows, create Form + Meet + Slack channel, fill URLs, test access page, set `status=published`. Edit/cancel: change cells / set status. Session edits do not auto-update saved calendar events — email registrants.

---

## 13. Known limitations

URL-obscurity gating · public CSV (no sensitive data) · manual Slack invites · homework needs Google sign-in · calendar events don't auto-update · Meet links shareable · no payment/auth/member-state. All acceptable for v8.4.

---

## 14. Build sequence

1. **Plan first (Plan mode).** Read CLAUDE.md + this doc + data model. Produce file plan and rendering logic. No code. Get approval.
2. **Build Stage 1** on local sample CSVs. All files per §10.
3. **Test locally:** `python -m http.server 8000`
   - Homepage: headline, search bar, "Open now" (6 cards), "Full library" (24 cards), Register + Share only, no gated links
   - Search: typing "harari" shows Nexus; "philosophy" shows 3; clearing restores full view; a nonsense query shows the empty state + request link
   - `?track=nexus`: full session table, Calendar/Join/Submit HW, Slack block, Buy book, Share
   - `?track=empire-of-ai`: no Submit HW (no homeworkFormUrl)
   - `?track=the-coming-wave`: no Submit HW
   - A track beyond the first 6 (e.g. `?track=meditations`): renders, session table shows empty-state
   - Share: click copies URL, shows confirmation
   - Mobile: table scrolls/stacks, search bar full-width
4. **Stage 2:** wire Google Sheets (publish CSV, update `config.js`).
5. **Deploy:** GitHub → Vercel → domain.

---

## 15. Success criteria

### Mechanical
Homepage renders from CSV; Open now / Full library split works; search filters by title/author/category; no gated links public; Register opens correct form; Share copies URL; access page renders correct sessions in local time; Calendar/Join/HW correct and gated; community block correct; host operates from Sheet.

### Demand signal
Not-found searches accumulate in the search-log Google Form Sheet. This is a second concept signal alongside registrations: it shows latent demand for books not yet offered. A recurring missed title is a strong candidate for the next track.

### Concept (the real test)
Form responses to Q3 contain language like: *"I bought it years ago and never got past chapter 3"*, *"I always stall on the dense ones"*, *"book clubs are too light for these"*, *"I need people to read it with."* If responses are generic, rewrite headline/subhead before building further.

---

## 16. Open questions for the founder

1. **Fiction in scope?** Two demanding novels (Karamazov, Infinite Jest) are included as "books people never finish." Keep, or nonfiction-only?
2. **"Open now" count** — default featured = 6. Confirm or change.
3. **Share = copy URL** is the v8.4 behavior. Native share sheet / referral tracking deferred. OK?
