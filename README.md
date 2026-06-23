# BookGrok Mock v8.4

Static prototype for bookgrok.mandava.in. Tests whether the concept resonates — that dense, demanding nonfiction gets finished with a cohort, a host, and structure — plus the mechanical flow (discover → register → access → join).

## What changed from v8.3

- Homepage cards show Register + Share only (Buy the book moved to access page)
- Flat `$9` pricing, no euros
- `hostLinkedIn` field added (stored, not linked yet)
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

## File structure

```
CLAUDE.md / AGENTS.md   Instructions
index.html              Homepage
access/index.html       Access page
styles.css              Shared styles
src/config.js           CSV URLs (absolute paths) + featuredCount
src/data.js             Fetch, parse, validate
src/share.js            Share control (copy URL + mailto)
src/app.js              Homepage render (Open now / Full library)
src/access.js           Access page render
samples/tracks_sample.csv     30 tracks
samples/sessions_sample.csv   37 sessions (first 6 tracks)
docs/bookgrok_v8_4_claudecode_handoff.md
docs/bookgrok_data_model_v8_4.md
assets/books, assets/hosts    Image folders
```

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
