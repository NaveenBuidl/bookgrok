# BookGrok Mock v8.4 — Agent Instructions (mirror of CLAUDE.md)

Read docs/bookgrok_v8_4_claudecode_handoff.md and docs/bookgrok_data_model_v8_4.md before writing any code.

## What v8.4 changes from v8.3

- Homepage cards: Register + Share only. NO "Buy the book" on homepage (it stays on access page).
- Pricing: flat `$9` everywhere. No euros.
- New `hostLinkedIn` field: stored, NOT rendered as a link in v8.4 (feature-flagged).
- New Share control on homepage cards and access page: copies public track URL + mailto. See src/share.js.
- Homepage splits tracks into "Open now" (first CONFIG.featuredCount) and "Full library" (rest).
- 30 curated dense-nonfiction tracks in samples/tracks_sample.csv.

## Hard constraints

- Static HTML/CSS/JS only. No React, Vue, Next, Vite, framework.
- No Supabase, Firebase, backend, API routes, server code.
- No auth, no real payment.
- No Luma, Circle, Slack API, Google API auth.
- Use published Google Sheets CSV URLs only.

## Data

- PapaParse only. Trim headers/values. Lowercase status. Skip empty rows.
- CSV paths in config.js MUST be absolute (/samples/...) so /access/ resolves from root.

## Security

- Validate URLs (http/https only). Hide element if blank/invalid.
- Escape all CSV text before DOM insertion. No raw innerHTML of CSV content.
- Never render javascript: URLs.

## Access gating

- Homepage NEVER shows: Meet links, Calendar links, homework URLs, Slack links, access URL, Buy book, hostLinkedIn link.
- Access page may show: Join, Calendar, Submit HW, community block, Buy book, Share.

## Build order

1. Plan first (Plan mode). Get approval before code.
2. Build Stage 1 with local sample CSVs.
3. Wire Google Sheets only after Stage 1 passes.

## Local test

```
python -m http.server 8000
```
Homepage: http://localhost:8000
Access: http://localhost:8000/access/?track=nexus
