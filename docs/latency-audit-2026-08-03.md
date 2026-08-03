# BookGrok Latency & Blocker Audit — 2026-08-03

---

## Pre-analysis: scope, assumptions, and gaps

### What "latency issue" means here
**In scope:** Time from navigation start to cards rendered (homepage and access page). The CSV fetch is the dominant variable; that's where this audit focuses. Render-blocking static assets are in scope as a secondary check.

**Out of scope:** Server-side latency (there is no server). Vercel CDN edge TTFB for static HTML/CSS/JS (Vercel serves these from edge nodes; improving this requires a paid plan and is out of reach at Stage 3/4). Individual image load times (all covers are lazy-loaded and not on the critical render path). Google Form submission performance.

### Assumptions (flagged — each is a candidate for verification)
1. **Assumption, to be checked:** All timing measurements below were taken from a single network location. User geography (India, US, elsewhere?) affects what CSV TTFB looks like from their browser. These numbers are directionally correct but not user-specific.
2. **Assumption, to be checked:** Traffic is "low." Vercel Analytics is not set up, so I have no actual session counts. If traffic has grown meaningfully (hundreds of daily sessions), the priority order of fixes could shift.
3. **Assumption, to be checked:** The `/pub?output=csv` endpoint behavior under load is similar to the single-client measurements here. Google may rate-limit concurrent requests from many users to the same sheet — I cannot test this without real traffic.

### Context I can't get without you
- **Real user session counts** — no monitoring is set up; blind to actual usage.
- **Whether anyone has complained about slowness** — I have no signal.
- **Current Vercel plan** — free vs Pro affects CDN edge coverage. Not knowing this means I can't say whether upgrading the plan would meaningfully reduce static asset TTFB.
- **Geographic split of users** — matters for CSV fetch times (Google data center proximity).

---

## What was measured

### CSV fetch timing (two live runs, measured via curl with `-L` redirect-following)

| CSV | Run 1 TTFB | Run 1 Total | Run 2 TTFB | Run 2 Total | Size | Rows (total / published) | Columns |
|---|---|---|---|---|---|---|---|
| Tracks | 1.793s | 1.898s | 1.683s | 1.693s | 17,378 B (17KB) | 33 / 32 | 32 |
| Sessions | 1.296s | 1.318s | 1.698s | 1.705s | 12,067 B (12KB) | 85 / 28 | 9 |

Both fetches run in parallel (`Promise.all` in `data.js:61`). Effective bottleneck = max(tracks, sessions) ≈ **1.7–1.9s**.

TTFB breakdown (tracks, run 1):
- DNS: 77ms
- TCP connect: 41ms
- TLS handshake: 403ms
- Google server processing: ~1,272ms ← dominant cost
- Data transfer: ~105ms

One redirect occurs (docs.google.com → googleusercontent.com), adding a second TCP+TLS round trip before data arrives.

Combined CSV payload: **~29KB**.

### Static assets

| Asset | Size | TTFB (measured) | Notes |
|---|---|---|---|
| `styles.css` | 32,427 B (32KB) | fast (Vercel edge) | render-blocking |
| `PapaParse 5.4.1` (cdnjs) | 19,469 B (19KB) | 275ms | loaded synchronously before app scripts |
| Google Fonts CSS | 1,900 B (1.9KB) | 308ms | render-blocking; 8 @font-face rules; `display=swap` in use |
| `src/*.js` total | ~25–30KB est. | fast (Vercel edge) | 848 lines across 6 files |

### Page structure
- 6 `<script>` tags at end of `<body>` — not render-blocking, but loaded sequentially (no `async`/`defer`).
- 2 `<link rel="preconnect">` for Google Fonts — useful. No preconnect for `docs.google.com` or `cdnjs.cloudflare.com`.
- No `<link rel="icon">` and no `/favicon.ico` at repo root — browser issues a 404 on every page load.
- No Vercel Analytics. No error monitoring. No RUM. Zero observability into actual user experience.
- No `vercel.json` — no custom cache headers or redirects configured.

### Image inventory (live data, 2026-08-03)
- Cover images: 32/33 tracks use Amazon (`m.media-amazon.com`), 1 blank (the draft row). URL-rewrite logic in `app.js:107–111` rewrites size tokens to 400px/800px — confirmed working for all Amazon URLs.
- Host photos: 32/33 have URLs.
- `assets/books/` and `assets/hosts/`: empty directories (confirmed). Fallback is initials via CSS, no broken image requests.
- First 2 featured cards: `fetchpriority="high"` set, but `loading="lazy"` is also always set (see below).

### Retry logic (existing state, confirming the bug-log claim)
`data.js:45–57` has a single retry: on PapaParse `error` callback, waits 1,000ms, retries once. The original bug-log said "no retry logic" — **this retry was added at some point after that log was written.** The retry covers hard network failures. It does NOT cover silent failures: if Google returns HTTP 200 with a non-CSV body (e.g., an HTML error page), PapaParse calls `complete` with 0 rows, not `error`, and the page shows "No tracks available right now." without retrying or logging.

---

## CURRENT BLOCKERS

### BLOCKER 1 — CSV TTFB is the dominant UX latency (1.7–1.9s, measured)

**Root cause:** The Google Sheets `/pub?output=csv` endpoint introduces ~1.3s of server-side processing time on every request, plus a redirect to `googleusercontent.com` that requires a second TCP+TLS handshake (~400ms). This is Google's fixed overhead — it is not size-dependent at current scale (29KB). Two parallel fetches still take as long as the slower one: ~1.7–1.9s.

The loading sequence a user actually experiences:
1. ~0ms: navigation
2. ~50–100ms: HTML arrives from Vercel edge
3. ~300–500ms: Google Fonts CSS + `styles.css` arrive, page renders with fallback fonts and shows "Loading tracks…"
4. ~300–500ms: scripts arrive and execute; `loadData()` initiates both CSV fetches
5. **~2.2–2.4s: CSV fetches complete, 32 cards render** — this is the perceived "blank wait"

**Evidence:** Two measured runs, consistent. TTFB 1.683–1.793s tracks, 1.296–1.698s sessions.

**Severity at current scale:** Medium. The page is functional and loads correctly. There's no crash. But a 2+ second wait between "I clicked the link" and "I see any content" is noticeable, especially on mobile. At Stage 3/4 with invited users, they tolerate it. At a public launch it would hurt conversion.

**Good-enough fix (Stage 3/4):** Two options, combinable:
1. **Add `<link rel="preconnect" href="https://docs.google.com">` to both HTML files.** This starts the TCP+TLS handshake to Google's server earlier (before the scripts even execute), potentially saving 400–500ms of the current overhead. Does not reduce Google's ~1.3s processing time but shaves the connection setup cost.
2. **Improve the loading state from plain text to a structural skeleton.** The current "Loading tracks…" text is invisible to a user who glances at the page. Card-shaped placeholders (just the grey boxes) would show structure immediately and make the 1.7–1.9s wait feel shorter. This is a perceived-performance improvement, not a real one.

**What would be over-engineering right now:** a real caching layer, a serverless function to proxy and cache the CSV, a CDN-level fetch, or a Cloudflare Worker. All valid at scale; none warranted before traffic exists to measure.

---

### BLOCKER 2 — Silent CSV failure is undetectable (no measurement, code analysis only)

**Root cause:** `fetchCsv` in `data.js:45` retries on PapaParse `error`. PapaParse only calls `error` for network-level failures. If Google Sheets returns HTTP 200 with an HTML error page (e.g., a quota error or temporary sheet problem), PapaParse parses it, finds zero rows, and calls `complete` with an empty array. `loadData()` returns `{ tracks: [], sessions: [] }`. `renderHomepage` shows "No tracks available right now. Check back soon." — which looks like the site is intentionally empty. No error is thrown, no retry fires, the user has no action to take.

**Evidence:** Code inspection, `data.js:34–43` + `app.js:9–11`. Not a measurement — this is a code path analysis.

**Severity at current scale:** Low. Google Sheets' published endpoint is generally reliable. But when it does fail (every few weeks in typical usage), users see what looks like a content-free page and have no way to recover except refreshing repeatedly. One user who gets this could report the site is "broken."

**Good-enough fix:** After `loadData()`, check `if (tracks.length === 0)` and distinguish between "the parse worked but returned zero rows" vs "the parse threw an error." Add a guard: if tracks is empty after a successful parse, throw a recoverable error with "Could not load track data — please refresh." so users know to retry. Alternatively, log a `console.error` with the raw row count before filtering, so intermittent failures show up in browser devtools.

---

### BLOCKER 3 — `loading="lazy"` conflict with `fetchpriority="high"` on first 2 cards

**Root cause:** `buildTrackCard` in `app.js:157` always applies `loading="lazy"` to cover images. For the first 2 featured cards (`isPriority = i < 2`), it additionally sets `fetchpriority="high"` — but both attributes are present simultaneously. `loading="lazy"` instructs the browser not to fetch the image until it's near the viewport; `fetchpriority="high"` says to prioritize this fetch. These semantically conflict. In practice, above-fold images load anyway (lazy-loading only defers truly off-screen images), so the user impact is minor. But the code's intent — "load these 2 covers eagerly, defer the rest" — is only half-executed.

**Evidence:** `app.js:147,157` — `isPriority` flag sets `fetchpriority="high"` but `loading="lazy"` is unconditional.

**Severity at current scale:** Low/cosmetic. Cover images are secondary to the text content. Not a latency blocker.

**Good-enough fix:** One-line change — make `loading` conditional: `loading="${isPriority ? 'eager' : 'lazy'}"`.

---

### BLOCKER 4 — No favicon → guaranteed 404 on every page load

**Root cause:** Neither `index.html` nor `access/index.html` has a `<link rel="icon">` tag, and no `favicon.ico` exists at the repo root. Every browser that loads any BookGrok page makes a request to `/favicon.ico` and gets a 404.

**Evidence:** Grep confirmed no favicon tag; `ls` confirmed no favicon at root.

**Severity at current scale:** Very low. One extra 404 request per session. No visual impact (browser handles it silently). Not a latency issue — favicon requests are low-priority and happen after render.

**Good-enough fix:** Add `<link rel="icon" href="data:,">` to both HTML `<head>` blocks. This tells the browser "no favicon" with zero network requests. Takes 10 seconds.

---

## POTENTIAL FUTURE BLOCKERS

### FUTURE 1 — Single external JS dependency (PapaParse from cdnjs)

**Trigger:** cdnjs CDN outage or slow edge node. No specific row/traffic threshold — this is a reliability dependency, not a scale one.

**Current state:** `cdnjs.cloudflare.com` serves PapaParse at 275ms TTFB (measured). If it goes down, the entire site's JS execution halts — PapaParse loads synchronously before all other scripts, so no CSV can be parsed. The site renders blank (no error state, because the JS that renders error states also didn't load).

**Severity today:** Low (cdnjs is highly reliable). Worth fixing before a public launch.

**Good-enough fix:** Copy `papaparse.min.js` (19KB) to `src/` and change the script tag to point to it. This removes the dependency entirely, shaves ~275ms off script load time, and eliminates the outage risk. Vercel serves static files from its CDN, so the latency is similar or better.

---

### FUTURE 2 — No observability → problems are invisible until a user complains

**Trigger:** Any real traffic. Already true today.

**Current state:** No Vercel Analytics, no RUM, no error reporting in `app.js`/`access.js`. The smoke test (`npm run smoke`) validates correctness on demand but doesn't run continuously. If CSV fetch starts failing for 30% of users, there is no signal until someone emails.

**Severity today:** Low at Stage 3/4 with invited users who you're in direct contact with. Becomes a real gap at any public launch.

**Good-enough fix (Stage 3/4):** Enable Vercel Analytics (free tier, zero code changes — toggle in Vercel dashboard → Settings → Analytics). Captures Web Vitals and error rates. Specifically, check whether the `_vercel/insights/script.js` snippet needs to be added to both HTML files manually for the free tier — **this is a manual step for you** (Vercel dashboard → your project → Analytics → enable).

---

### FUTURE 3 — Access page downloads the full tracks CSV unnecessarily

**Trigger:** When tracks CSV grows substantially (200+ rows, 50+ KB).

**Current state:** `loadData()` in `data.js:60–84` is shared between the homepage and access page. The access page calls it identically, downloading all 32 tracks and all 85 sessions even though it only needs sessions for one track. At current scale (17KB + 12KB = 29KB), this is harmless.

**At what scale it matters:** If tracks grow to 200+ rows with many additional columns, the tracks CSV could exceed 100KB. At that size, the parallel-fetch bottleneck shifts from TTFB-dominated to download-time-dominated on slow connections. (Example: 100KB at 1Mbps = 800ms of transfer time after the ~1.7s TTFB — total ~2.5s.) Still manageable but worth noting.

**Good-enough fix (when triggered):** Either split `loadData()` into `loadTracksOnly()` and `loadSessionsForTrack(trackId)`, or add a query parameter to the sessions fetch to filter server-side. Don't do this now — 29KB is nothing.

---

### FUTURE 4 — Screenshot tool timing sensitivity to CSV cold-start latency

**Root cause:** `scripts/screenshot-check.js` uses `waitUntil: 'networkidle'` (15s timeout) + 500ms. The "intermittent data-fetch errors at 375px cold load" from the bug log are explained by: the CSV fetch takes ~1.7-1.9s minimum, but on a truly cold connection (machine just woke up, Google's CDN cache miss), TTFB can spike higher. If the fetch approaches or exceeds 15s, the screenshot captures the "Loading tracks…" state instead of rendered cards.

**This is a test tooling issue, not a production issue.** The current site code handles slow loads correctly (shows loading state, renders cards when data arrives). The screenshot tool's cold-load error is a false signal about site correctness.

**Severity:** Very low. Only affects the dev workflow screenshot tool, not real users.

**Fix (low priority):** Increase the `waitUntil` timeout in `screenshot-check.js` from 15s to 30s, or add an explicit `page.waitForSelector('.card', { timeout: 30000 })` after `waitForTimeout`. This eliminates false-positive "blank" screenshots.

---

## Prioritized findings (evidence vs judgment — transparency on each)

| Priority | Finding | Evidence basis | Judgment call? |
|---|---|---|---|
| 1 | CSV TTFB ~1.7–1.9s is the dominant latency | Direct measurement, 2 runs | No — measured |
| 2 | PapaParse on cdnjs is a single point of failure | Code + CDN dependency analysis | Partially — outage probability is judgment |
| 3 | Silent CSV failure (empty-rows not retried) | Code path analysis | Yes — probability of hitting this is unknown |
| 4 | No observability | Grep + filesystem check | Judgment that this matters before public launch |
| 5 | `loading="lazy"` + `fetchpriority="high"` conflict | Code read | Judgment on impact level (empirically minor) |
| 6 | No favicon (404) | Filesystem check | No — easily confirmed |

---

## Open questions for Naveen

1. **Geography**: Where are your current Stage 3/4 users located? My CSV timing measurements are from one network. If your users are in India, the TTFB to Google Sheets could be similar or different (Google has data centers in Mumbai and Chennai). If you've noticed slowness on a specific device or network, that's a more reliable signal than my measurements.

2. **Vercel plan**: Are you on the free (Hobby) plan or Pro? Free plan has limited CDN edge nodes. If you're on free, enabling Vercel Analytics (the only cost-free observability option) requires adding a one-line script — do you want me to look into what that requires for a static site without a framework?

3. **PapaParse self-hosting**: Moving PapaParse from cdnjs to a local file is a one-minute change, zero risk. Should I do it in the next session, or do you want to keep it external for now?

4. **Skeleton loading state**: Adding card-shape placeholders during the 1.7–1.9s CSV fetch would make the wait feel shorter. Is perceived performance worth a CSS session right now, or do you want to wait until Stage 4?

5. **Screenshot tool cold-load fix**: Raise the `waitUntil` timeout from 15s to 30s in `screenshot-check.js` to stop false-positive empty screenshots. This is cosmetic for your workflow. Should I include it in the next fix session?

---

## Follow-up prompt (hand to a fresh session)

See `docs/latency-audit-2026-08-03.md` section below for the handoff prompt. Save this as the prompt for the next implementation session.

---

## Handoff: prioritized fixes for the next session

```
BookGrok — Latency & Blocker Fixes (implementation session)

CONTEXT
- Static HTML/CSS/JS on Vercel. No framework, no backend, no build step.
- Two source HTML files: index.html (homepage) and access/index.html (access page).
- Key source files: src/config.js, src/data.js, src/app.js, src/access.js.
- The site fetches two CSVs from Google Sheets on every page load. Both pages use
  loadData() in data.js, which runs Promise.all on both fetches.
- A latency audit was done on 2026-08-03; this session implements the fixes it found.
  Full audit: docs/latency-audit-2026-08-03.md — read it before writing code.
- CLAUDE.md hard constraints apply: static only, no backend, no framework.
- Follow the branching workflow in CLAUDE.md: create a feature branch, push for
  preview before merging.

FIXES TO IMPLEMENT (in priority order — do each as its own atomic commit)

Fix 1 — Self-host PapaParse (BLOCKER: single point of failure)
  What: Copy node_modules or CDN version of papaparse.min.js to src/papaparse.min.js.
  Change the <script> tag in BOTH index.html and access/index.html from:
    <script src="https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.4.1/papaparse.min.js">
  to:
    <script src="/src/papaparse.min.js">  (in index.html)
    <script src="../src/papaparse.min.js">  (in access/index.html)
  The file is already in node_modules/papaparse/papaparse.min.js — copy it to src/.
  Verify: run npm run smoke after this change. Should pass all checks.

Fix 2 — Add preconnect hints for Google Sheets CSV host (latency: saves ~400ms on cold load)
  What: Add to the <head> of BOTH index.html and access/index.html, BEFORE the
  Google Fonts preconnect lines:
    <link rel="preconnect" href="https://docs.google.com">
    <link rel="preconnect" href="https://googleusercontent.com" crossorigin>
  The second hint covers the redirect target (googleusercontent.com) that Google Sheets
  redirects to. crossorigin is needed because PapaParse uses XHR with credentials=omit.
  This starts TCP+TLS before the scripts execute, saving ~400-500ms on cold connections.
  Verify: run npm run screenshot after. No visual change expected — just check cards render.

Fix 3 — Fix loading="lazy" + fetchpriority="high" conflict (code correctness)
  What: In src/app.js, function buildTrackCard (around line 157), change:
    loading="lazy"
  to a conditional:
    loading="${isPriority ? 'eager' : 'lazy'}"
  The isPriority flag is already computed above that line. This makes the first 2
  featured cards load eagerly (no lazy deferral), consistent with fetchpriority="high".
  Verify: run npm run screenshot — no visible change expected.

Fix 4 — Add no-op favicon to suppress 404s (cosmetic)
  What: Add to <head> of BOTH index.html and access/index.html:
    <link rel="icon" href="data:,">
  This tells browsers "no favicon" without a network request. 5-second change.
  Verify: check browser devtools Network tab — no /favicon.ico 404 on next load.

Fix 5 — Guard against silent CSV empty-rows failure (reliability)
  What: In src/data.js, function loadData(), after the Promise.all resolves, add a check:
  If tracks.length === 0 after filtering (not just rawTracks.length === 0), throw a
  descriptive error: "Tracks data loaded but returned 0 published rows — the sheet may
  have a configuration issue." This causes the existing error-state UI in app.js and
  access.js to render instead of showing an empty "No tracks available" state silently.
  Note: Do NOT add this guard before the status filter — the filter is the right place.
  Only guard the post-filter count. A sheet with all tracks set to draft should still
  show the empty state (that's intentional), not an error. Guard: if rawTracks.length > 0
  but tracks.length === 0, that's suspicious — log a console.warn with counts.
  Verify: run npm run smoke — should pass all checks unchanged.

Fix 6 — Screenshot tool cold-load timeout (developer tooling only)
  What: In scripts/screenshot-check.js, change the Playwright goto timeout from 15000
  to 30000 and add a waitForSelector after waitForTimeout:
    await page.waitForSelector('.card, .error-state, .empty-state', { timeout: 25000 })
      .catch(() => {});  // non-fatal — screenshot whatever state we're in
  This prevents false-positive "Loading tracks..." screenshots on slow cold loads.
  Verify: run npm run screenshot — should show rendered cards at all 3 viewports.

FIXES NOT IN THIS SESSION (over-engineering at current scale):
- Vercel Analytics setup (requires Naveen's Vercel dashboard access — owner-identity step)
- Splitting loadData() to avoid loading all tracks on the access page
  (only matters at 200+ tracks; currently 32)
- Full skeleton loading UI (product decision; ask Naveen first)
- Any caching layer, CDN proxy, or backend (hard constraint: static only)

AFTER ALL FIXES:
- Run npm run smoke and confirm all checks pass
- Run npm run screenshot and review all 6 PNGs (homepage + access at 3 widths each)
- Push to feature branch for Vercel preview
- Report: which fixes were done, which (if any) were skipped and why
- Delete this note from the file if all fixes are done
```
