# BookGrok Mock v8.4 — Claude Code Instructions

Read docs/bookgrok_v8_4_claudecode_handoff.md and docs/bookgrok_data_model_v8_4.md before writing any code.

## What v8.4 changes from v8.3

- Homepage cards: Register + Share only. NO "Buy the book" on homepage (it stays on access page).
- Pricing: flat `$9` everywhere. No euros.
- `hostLinkedIn` field: rendered as an icon link in the homepage card's host block (and access page). The host's verifiable identity is part of the card's trust signal.
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

- Homepage NEVER shows: Meet links, Calendar links, homework URLs, Slack links, access URL, Buy book.
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

## Data source discipline

samples/tracks_sample.csv is a stale offline fixture. It is NOT
the source of truth and drifts behind the live Sheet.

Any question about what a track's actual field values are —
cover URLs, image dimensions, metadata completeness, row order,
counts — must be answered by fetching the live gviz CSV from
config.js. Never grep the sample file to answer these.

The sample file is only for offline rendering when the network
is unavailable. If you use it, say so explicitly in your report.

The published CSV can lag a Sheet edit by 1-2 minutes. If values
look stale right after I say I've updated the Sheet, wait and
retry before concluding nothing changed.

## Card — optional content fields

Optional card lines (host proof stats, commitment microcopy,
includes line) are a menu, not a stack. Pick one persuasion
register per card. Populating all of them at once is a misuse,
not a supported state — the card was not designed to hold all
six simultaneously without growing materially taller.

## Branching workflow
- Before any multi-step or visually significant change, create a feature branch first: `git checkout -b <feature-name>`. Never commit directly to main mid-feature.
- Work and commit on the branch following the existing pattern: leave changes staged, wait for Naveen to review and approve before committing.
- Push the branch to trigger a Vercel preview deployment: `git push -u origin <feature-name>`.
- Surface the Vercel preview URL to Naveen (Vercel dashboard → Overview → Active Branches, or Deployments tab) for testing — this is the live deployed render, not localhost.
- Only merge to main after Naveen confirms the preview is correct: `git checkout main && git merge <feature-name> && git push origin main`.
- Delete the branch after merging or abandoning: `git branch -d <feature-name>` and `git push origin --delete <feature-name>`.
- Skip branching for genuine one-line fixes — the existing staged-commit review gate covers those.

## Diagnosis discipline

Before proposing a fix or declaring something impossible:

- **State what you're holding fixed.** List the variables you treated as
  constraints and why each can't move. If a reason is "I assumed it" —
  that's a candidate to change, not a constraint. Most dead ends are a
  frozen variable, not a real limit.
- **Measure before explaining.** If you have a theory for why something
  behaves as it does, test the theory before acting on it. A plausible
  mechanism that turns out wrong costs a full round.
- **Verify geometry against the running page, not the source.** Percentages,
  flex/grid sizing, and aspect-ratio boxes resolve to different pixel values
  at different viewports. Read real values (getBoundingClientRect, computed
  styles) before reasoning about position or size.
- **When a fix invalidates earlier tests, say so unprompted.** If you find a
  bug in the test setup, every conclusion drawn with it is suspect. Name
  which ones.

"This can't be done" is a valid answer, but only in the form:
*X fails because Y; I tried A, B, C; the untested lever is D.*
Never as a bare verdict.

## Evaluating visual changes

- Define pass/fail criteria before rendering anything. If a change must
  satisfy two properties (e.g. an effect is visible AND existing structure
  survives), test both on every candidate and report both. A candidate
  passing one and failing the other is not a candidate.
- Full unzoomed screenshots at real size are the primary evidence. Zoomed
  crops are a secondary check and never the basis for a verdict — an effect
  that needs 3x magnification to see doesn't exist at 1x.
- Test the extremes of the real data (most and least saturated, the gated
  case), not whichever example is nearest to hand.

## Engineering bars (apply to every change, not just this pass)

These are goals to check against, not steps to follow. Judge any change — yours or a
future engineer's — against these bars. If a change fails one, that's worth raising
with Naveen before proceeding, not silently working around.

1. **Onboarding cost** — Someone unfamiliar with the repo can tell what a file does
   and why it exists without reading it end to end or asking. If you add a file,
   its purpose should be findable in under 30 seconds.

2. **Single source of truth per fact** — Any given fact about the system (a rule, a
   schema field's behavior, a constraint) lives in exactly one place. Other files
   defer to it rather than restating it. If you're about to write the same fact in
   a second place, stop and make it a pointer instead.

3. **Complexity proportional to current scale** — Nothing exists because it "might
   be needed later." Nothing load-bearing today is left fragile because "it's fine
   for now." Match effort to what actually matters at this stage, not a future one.

4. **Protect the seams you know will move** — Sheets→backend, and eventually
   auth/payments, are known future swaps. Code that touches these should not leak
   implementation details (e.g. CSV-specific shapes) into code that shouldn't care.

5. **Every artifact has a live owner or a recorded decision** — Nothing sits in an
   ambiguous state. A file is either actively used, or there's a findable, explicit
   note saying why it's parked. Don't leave "is this dead?" as an open question for
   the next person to reverse-engineer from git history.

6. **Verifiability matches consequence** — Logic where a silent bug costs real money
   or trust (pricing, seat counts, access gating) should be checkable by something
   other than a human eyeballing a screenshot.

7. **Reversibility over polish** — Prefer changes that are cheap to undo if wrong
   over changes that lock in structure prematurely. If an assumption here breaks in
   3 months, the blast radius should be small and estimable.

8. **Security/data hygiene never regresses** — Existing guards (escapeHtml,
   isValidUrl, no raw CSV innerHTML) apply to any new code path touching untrusted
   data, with no exceptions.

