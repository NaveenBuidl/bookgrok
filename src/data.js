// BookGrok data layer — fetch, parse, validate CSV data with PapaParse
// All CSV values escaped/validated before use

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function isValidUrl(url) {
  if (!url || typeof url !== "string") return false;
  const t = url.trim();
  return t.startsWith("https://") || t.startsWith("http://");
}

function trimRow(row) {
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    out[k.trim()] = typeof v === "string" ? v.trim() : v;
  }
  return out;
}

function fetchCsvOnce(url) {
  return new Promise((resolve, reject) => {
    Papa.parse(url, {
      download: true,
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,
      complete: (results) => {
        const rows = results.data.map(trimRow);
        rows.forEach(r => { if (r.status) r.status = r.status.toLowerCase(); });
        resolve(rows);
      },
      error: (err) => reject(err)
    });
  });
}

async function fetchCsv(url) {
  try {
    return await fetchCsvOnce(url);
  } catch (err) {
    console.warn("CSV fetch failed, retrying once:", url, err);
    await new Promise(r => setTimeout(r, 1000));
    try {
      return await fetchCsvOnce(url);
    } catch (err2) {
      console.error("CSV fetch failed after retry:", url, err2);
      throw err2;
    }
  }
}

// loadData() returning {tracks, sessions} as plain arrays of plain objects is the seam
// where the CSV source gets swapped for a real backend API later — nothing downstream
// of this function (app.js, access.js, search.js, share.js) should assume CSV-specific
// shape (string-typed fields, PapaParse quirks, etc). Anything CSV-specific belongs
// above this line; everything below the return should read as "just JS objects."
async function loadData() {
  const [rawTracks, rawSessions] = await Promise.all([
    fetchCsv(CONFIG.tracksCsvUrl),
    fetchCsv(CONFIG.sessionsCsvUrl)
  ]);

  rawTracks.forEach((r, i) => { if (!r.id) console.warn(`tracks row ${i + 2}: missing id`); });
  rawSessions.forEach((r, i) => { if (!r.trackId) console.warn(`sessions row ${i + 2}: missing trackId`); });

  const tracks = rawTracks
    .filter(t => t.id && t.status === "published")
    .sort((a, b) => {
      const aOrder = parseInt(a.sortOrder, 10) || 999;
      const bOrder = parseInt(b.sortOrder, 10) || 999;
      return aOrder - bOrder;
    });

  // Known gap (was docs/latency-audit-2026-08-03.md Fix 5, now recorded here instead of
  // in that now-deleted doc): this only logs to console. A CSV response that's silently
  // broken (e.g. an HTML error page where valid CSV was expected) renders to readers as
  // a generic "No tracks available right now" empty state, not a visible error — there's
  // no throw, so the error-state UI in app.js/access.js never triggers from this path.
  // Deliberately out of scope to fix here; revisit if this needs to surface to the operator.
  if (rawTracks.length > 0 && tracks.length === 0) {
    const rowsWithId = rawTracks.filter(r => r.id).length;
    if (rowsWithId === 0) {
      console.error(`[BookGrok] tracks CSV returned ${rawTracks.length} rows but none have an "id" column — response may not be valid CSV (HTML error page?). Check Sheet publish settings.`);
    } else {
      console.warn(`[BookGrok] tracks CSV has ${rowsWithId} rows with ids but 0 are published — all tracks may be set to draft or archived.`);
    }
  }

  const sessions = rawSessions
    .filter(s => s.trackId && s.status === "published")
    .sort((a, b) => {
      if (a.trackId !== b.trackId) return a.trackId.localeCompare(b.trackId);
      return parseInt(a.number, 10) - parseInt(b.number, 10);
    });

  return { tracks, sessions };
}

function getSessionsForTrack(sessions, trackId) {
  return sessions.filter(s => s.trackId === trackId);
}

function getFirstSession(sessions, trackId) {
  const t = getSessionsForTrack(sessions, trackId);
  return t.length ? t[0] : null;
}

function formatLocalDatetime(utcString) {
  if (!utcString) return "";
  try {
    return new Date(utcString).toLocaleString(undefined, {
      weekday: "short", day: "numeric", month: "long",
      hour: "2-digit", minute: "2-digit", timeZoneName: "short"
    });
  } catch (e) { console.warn("Invalid date:", utcString); return utcString; }
}

function formatLocalDate(utcString) {
  if (!utcString) return "";
  try {
    return new Date(utcString).toLocaleDateString(undefined, {
      day: "numeric", month: "long", year: "numeric"
    });
  } catch (e) { return utcString; }
}

function formatLocalDateShort(utcString) {
  if (!utcString) return "";
  const d = new Date(utcString);
  if (isNaN(d.getTime())) return "";
  try {
    return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
  } catch (e) { return ""; }
}

// Local session time with an unambiguous short timezone offset, e.g. "7:00 PM GMT+5:30".
// Returns "" if utcString is missing/unparseable — callers must not render a partial string.
function formatLocalTimeShort(utcString) {
  if (!utcString) return "";
  const d = new Date(utcString);
  if (isNaN(d.getTime())) return "";
  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: "numeric", minute: "2-digit", timeZoneName: "shortOffset"
    }).format(d);
  } catch (e) { return ""; }
}

// Local session time with no timezone suffix, e.g. "7:00 PM" — paired with the literal
// phrase "your time" in the UI instead of a GMT offset, since the offset still requires
// mental conversion and the phrase does not.
function formatLocalTimeOnly(utcString) {
  if (!utcString) return "";
  const d = new Date(utcString);
  if (isNaN(d.getTime())) return "";
  try {
    return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(d);
  } catch (e) { return ""; }
}

function buildCalUrl(session) {
  try {
    const start = new Date(session.datetimeUTC);
    const end = new Date(start.getTime() + parseInt(session.durationMins, 10) * 60000);
    const toCalFmt = d => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    const details = escapeHtml(session.calDescription) +
      (isValidUrl(session.meetLink) ? " Join: " + session.meetLink : "");
    const params = new URLSearchParams({
      action: "TEMPLATE",
      text: session.calTitle || "",
      dates: toCalFmt(start) + "/" + toCalFmt(end),
      details: details,
      location: isValidUrl(session.meetLink) ? session.meetLink : ""
    });
    return "https://calendar.google.com/calendar/render?" + params.toString();
  } catch (e) { console.warn("buildCalUrl error:", e); return "#"; }
}

function spotsPercent(track) {
  const total = parseInt(track.spotsTotal, 10) || 8;
  const left = parseInt(track.spotsLeft, 10) || 0;
  return Math.round(((total - left) / total) * 100);
}
