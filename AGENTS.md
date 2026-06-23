# BookGrok Mock v8.3 — Agent Instructions

This file mirrors CLAUDE.md. If using Claude Code, CLAUDE.md takes precedence.

Read docs/bookgrok_v8_3_claudecode_handoff.md before writing any code.

## Hard constraints

- Static HTML/CSS/JS only.
- No React, Vue, Next.js, Vite, or any frontend framework.
- No Supabase, Firebase, backend, API routes, or server-side code.
- No auth or login of any kind.
- No real payment.
- No Luma, Circle, or third-party community platforms.
- No Slack API automation.
- No Google Sheets authenticated API — use published CSV URLs only.
- No Google Drive API upload.
- No admin dashboard.

## Data

- Use PapaParse for CSV parsing.
- Start with local sample CSVs in `samples/`.
- Trim all header names and values after parsing.
- Normalize `status` to lowercase.
- Skip empty rows.

## Security

- Validate all URLs. Accept only `http://` and `https://`.
- Escape all CSV-derived text before DOM insertion.
- Never inject raw CSV content into `innerHTML` directly.

## Access gating

- Homepage must NEVER show: Meet links, Calendar links, access page URLs, homework URLs, Slack links.
- Access page may show: Join links, Calendar buttons, Submit HW, community block.

## Build order

1. Plan first. Get approval before writing code.
2. Build with local sample CSVs.
3. Wire Google Sheets only after local build passes.
