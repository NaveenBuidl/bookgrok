# BookGrok Mock v8.3 — Claude Code Instructions

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

- Use PapaParse for CSV parsing. Never write a naive CSV parser.
- Start with local sample CSVs in `samples/`. Do not connect Google Sheets until local build works.
- Trim all header names and values after parsing.
- Normalize `status` to lowercase.
- Skip empty rows.

## Security

- Validate all URLs before rendering. Accept only `http://` and `https://`. Hide buttons if URL is blank or invalid.
- Escape all CSV-derived text before DOM insertion. Use `textContent` for text nodes.
- Never inject raw CSV content into `innerHTML` directly.
- Never render `javascript:` URLs.

## Access gating

- Homepage must NEVER render: Meet links, Calendar links (they contain Meet links), access page URLs, homework form URLs, or Slack links.
- Access page may render: Join links, Calendar buttons, Submit HW button, community block.
- This is simulated gating by URL obscurity. Do not describe it as secure.

## Build order

1. Produce an implementation plan first. Get approval before writing code.
2. Build Stage 1 with local sample CSVs.
3. Only wire Google Sheets after Stage 1 passes local testing.

## Local testing command

```bash
python -m http.server 8000
```

Homepage: `http://localhost:8000`
Access page: `http://localhost:8000/access/?track=nexus`
