# BookGrok Mock v8.4 — Claude Code Instructions

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

## Visual verification

`npm run screenshot` screenshots the site at 375px/780px/1440px into ./screenshots
(gitignored) — no arguments needed, it starts its own server automatically.

Run it whenever a change could affect layout or rendering (CSS, grid/flex,
new components, breakpoints, images). View the PNGs before saying the change
is done. Skip it for non-visual changes (CMS data, logic-only JS, copy edits).

## Scope discipline

When diagnosing a bug: state your root-cause hypothesis and confidence
level as soon as you have one, before continuing to investigate further.
If the evidence already explains the symptom, stop gathering more —
proceed to propose a fix rather than seeking additional confirmation.

Flaky/non-deterministic bugs (network timing, race conditions under real
network calls) often can't be reproduced on demand — establishing a
plausible mechanism is sufficient, don't try to force a deterministic
repro by adding artificial throttling, retries, or escalating conditions.

Match effort to stakes. Reasonable defaults:
- Cosmetic/low-stakes bugs: fix directly, skip elaborate diagnosis.
- Bugs with an unclear cause: diagnose enough to state a confident
  root-cause hypothesis, then stop and either fix or ask.
- Irreversible/high-stakes changes (data loss, security, payment,
  anything touching CLAUDE.md's hard constraints): stop and ask before
  proceeding, even if you're confident.

If a task is taking meaningfully longer or touching more files than the
request implied, pause and check in rather than continuing on your own
judgment of what's warranted.

Delete scratch/repro scripts you create for investigation before
finishing a task — don't leave them in the repo.

## Owner-identity steps — don't automate, ask instead

Some checks require being logged into the human's own Google/Slack/etc. 
account (not a service account, not anonymous). Recognize these BEFORE 
attempting automation, not after failing at it:
- Google Form Settings/Responses tabs (form owner only)
- Slack workspace admin actions (channel privacy, invites)
- Any "check X in your account" step

When you hit one: don't search Drive/APIs looking for a workaround. 
Instead, stop and give the human:
1. The exact URL or menu path
2. The exact toggle/field to check
3. What answer you need back from them

Then continue once they report back. This is faster and more reliable 
than attempting tool-based access to authenticated owner-only surfaces.
