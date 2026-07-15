#!/usr/bin/env node
// Standalone pre-publish validator for BookGrok tracks/sessions CSVs.
// Run manually before flipping a track's status to "published". Not wired
// into any build step or pipeline — see docs/host_add_track_runbook.md Stage 11.
//
// Usage:
//   node scripts/validate-tracks.js
//   node scripts/validate-tracks.js path/to/tracks.csv path/to/sessions.csv
//
// Defaults to samples/tracks_sample.csv and samples/sessions_sample.csv.

const fs = require("fs");
const path = require("path");

const tracksPath = process.argv[2] || path.join(__dirname, "..", "samples", "tracks_sample.csv");
const sessionsPath = process.argv[3] || path.join(__dirname, "..", "samples", "sessions_sample.csv");

// Minimal CSV parser matching src/data.js conventions: header row, trim
// headers/values, lowercase status, skip empty lines. Handles quoted fields
// (commas/newlines inside quotes) since track titles and descriptions use them.
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  const s = text;

  while (i < s.length) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      field += c; i++; continue;
    }
    if (c === '"') { inQuotes = true; i++; continue; }
    if (c === ",") { row.push(field); field = ""; i++; continue; }
    if (c === "\r") { i++; continue; }
    if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; i++; continue; }
    field += c; i++;
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }

  const filtered = rows.filter(r => r.some(v => v.trim() !== ""));
  if (filtered.length === 0) return [];
  const headers = filtered[0].map(h => h.trim());
  return filtered.slice(1).map(r => {
    const obj = {};
    headers.forEach((h, idx) => { obj[h] = (r[idx] || "").trim(); });
    if (obj.status) obj.status = obj.status.toLowerCase();
    return obj;
  });
}

function isValidUrl(url) {
  if (!url || typeof url !== "string") return false;
  const t = url.trim();
  return t.startsWith("https://") || t.startsWith("http://");
}

function looksLikePlaceholder(url) {
  return typeof url === "string" && /REPLACE/i.test(url);
}

function isUtcZ(dt) {
  if (!dt || typeof dt !== "string") return false;
  return /Z$/.test(dt.trim()) && !isNaN(Date.parse(dt));
}

function main() {
  if (!fs.existsSync(tracksPath)) { console.error(`Tracks CSV not found: ${tracksPath}`); process.exit(1); }
  if (!fs.existsSync(sessionsPath)) { console.error(`Sessions CSV not found: ${sessionsPath}`); process.exit(1); }

  const tracks = parseCsv(fs.readFileSync(tracksPath, "utf8"));
  const sessions = parseCsv(fs.readFileSync(sessionsPath, "utf8"));

  const errors = [];
  const warnings = [];

  // --- sortOrder collisions among published tracks ---
  const publishedTracks = tracks.filter(t => t.status === "published");
  const sortOrderMap = new Map();
  publishedTracks.forEach(t => {
    const key = t.sortOrder;
    if (!sortOrderMap.has(key)) sortOrderMap.set(key, []);
    sortOrderMap.get(key).push(t.id);
  });
  for (const [order, ids] of sortOrderMap.entries()) {
    if (ids.length > 1) {
      errors.push(`sortOrder collision: sortOrder=${order} used by published tracks: ${ids.join(", ")}`);
    }
  }

  // --- per-track checks ---
  const sessionsByTrack = new Map();
  sessions.forEach(s => {
    if (!s.trackId) return;
    if (!sessionsByTrack.has(s.trackId)) sessionsByTrack.set(s.trackId, []);
    sessionsByTrack.get(s.trackId).push(s);
  });

  tracks.forEach((t, idx) => {
    const rowLabel = `track "${t.id || "(missing id)"}" (row ${idx + 2})`;

    if (!t.id) { errors.push(`${rowLabel}: missing id`); return; }

    const trackSessions = sessionsByTrack.get(t.id) || [];
    const publishedSessions = trackSessions.filter(s => s.status === "published");

    if (t.status === "published") {
      // zero-session published track
      if (publishedSessions.length === 0) {
        errors.push(`${rowLabel}: status=published but has 0 published sessions`);
      }

      // sessionCount mismatch
      const declared = parseInt(t.sessionCount, 10);
      if (isNaN(declared)) {
        warnings.push(`${rowLabel}: sessionCount is not a number ("${t.sessionCount}")`);
      } else if (declared !== publishedSessions.length) {
        errors.push(`${rowLabel}: sessionCount=${declared} but ${publishedSessions.length} published session row(s) found`);
      }

      // price drift
      if (t.price !== "$9") {
        errors.push(`${rowLabel}: price="${t.price}" — expected flat "$9"`);
      }

      // URL fields: formUrl required, others optional-but-must-be-valid-if-present
      if (!isValidUrl(t.formUrl)) {
        errors.push(`${rowLabel}: formUrl is missing or invalid ("${t.formUrl}")`);
      } else if (looksLikePlaceholder(t.formUrl)) {
        errors.push(`${rowLabel}: formUrl still contains a REPLACE placeholder`);
      }

      ["homeworkFormUrl", "buyBookUrl", "communityUrl", "bookCoverUrl", "hostPhotoUrl"].forEach(field => {
        const val = t[field];
        if (val && looksLikePlaceholder(val)) {
          errors.push(`${rowLabel}: ${field} still contains a REPLACE placeholder`);
        } else if (val && !isValidUrl(val)) {
          errors.push(`${rowLabel}: ${field} is set but not a valid http(s) URL ("${val}")`);
        }
      });
    }

    // session-level checks (run regardless of track status, since drafts get fixed before publish)
    trackSessions.forEach(s => {
      const sLabel = `session ${s.number} of track "${t.id}"`;
      if (s.status !== "published") return;

      if (!isUtcZ(s.datetimeUTC)) {
        errors.push(`${sLabel}: datetimeUTC "${s.datetimeUTC}" is missing, unparseable, or doesn't end in Z`);
      }
      if (!isValidUrl(s.meetLink)) {
        errors.push(`${sLabel}: meetLink is missing or invalid ("${s.meetLink}")`);
      } else if (looksLikePlaceholder(s.meetLink)) {
        errors.push(`${sLabel}: meetLink still contains a REPLACE placeholder`);
      }
      if (!s.durationMins || isNaN(parseInt(s.durationMins, 10))) {
        errors.push(`${sLabel}: durationMins is missing or not a number`);
      }
    });
  });

  // --- orphan sessions (trackId doesn't match any track row) ---
  const trackIds = new Set(tracks.map(t => t.id));
  sessions.forEach((s, idx) => {
    if (s.trackId && !trackIds.has(s.trackId)) {
      warnings.push(`session row ${idx + 2}: trackId "${s.trackId}" does not match any track id`);
    }
  });

  console.log(`Checked ${tracks.length} track row(s), ${sessions.length} session row(s).\n`);

  if (warnings.length) {
    console.log(`WARNINGS (${warnings.length}):`);
    warnings.forEach(w => console.log(`  - ${w}`));
    console.log("");
  }

  if (errors.length) {
    console.log(`ERRORS (${errors.length}):`);
    errors.forEach(e => console.log(`  - ${e}`));
    console.log("\nFix the above before setting status=published.");
    process.exit(1);
  }

  console.log("No blocking errors found.");
  process.exit(0);
}

main();
