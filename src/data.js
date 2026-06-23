// BookGrok data layer
// Fetches and parses CSV data using PapaParse
// All CSV values are escaped/validated before use

// ─── Utilities ───────────────────────────────────────────────────────────────

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
  const trimmed = url.trim();
  return trimmed.startsWith("https://") || trimmed.startsWith("http://");
}

function trimRow(row) {
  const trimmed = {};
  for (const [key, val] of Object.entries(row)) {
    trimmed[key.trim()] = typeof val === "string" ? val.trim() : val;
  }
  return trimmed;
}

// ─── CSV Fetcher ──────────────────────────────────────────────────────────────

function fetchCsv(url) {
  return new Promise((resolve, reject) => {
    Papa.parse(url, {
      download: true,
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,
      complete: (results) => {
        const rows = results.data.map(trimRow);
        rows.forEach((row, i) => {
          // Normalize status to lowercase
          if (row.status) row.status = row.status.toLowerCase();
        });
        resolve(rows);
      },
      error: (err) => {
        console.error("CSV parse error:", url, err);
        reject(err);
      }
    });
  });
}

// ─── Data Accessors ───────────────────────────────────────────────────────────

async function loadData() {
  try {
    const [rawTracks, rawSessions] = await Promise.all([
      fetchCsv(CONFIG.tracksCsvUrl),
      fetchCsv(CONFIG.sessionsCsvUrl)
    ]);

    // Validate and warn
    rawTracks.forEach((row, i) => {
      if (!row.id) console.warn(`tracks row ${i + 2}: missing id`);
    });
    rawSessions.forEach((row, i) => {
      if (!row.trackId) console.warn(`sessions row ${i + 2}: missing trackId`);
    });

    const tracks = rawTracks.filter(t => t.id && t.status === "published");
    const sessions = rawSessions.filter(s => s.trackId && s.status === "published");

    // Sort tracks by sortOrder ascending
    tracks.sort((a, b) => parseInt(a.sortOrder, 10) - parseInt(b.sortOrder, 10));

    // Sort sessions by trackId then number
    sessions.sort((a, b) => {
      if (a.trackId !== b.trackId) return a.trackId.localeCompare(b.trackId);
      return parseInt(a.number, 10) - parseInt(b.number, 10);
    });

    return { tracks, sessions };
  } catch (err) {
    console.error("Failed to load data:", err);
    throw err;
  }
}

function getSessionsForTrack(sessions, trackId) {
  return sessions.filter(s => s.trackId === trackId);
}

function getFirstSession(sessions, trackId) {
  const trackSessions = getSessionsForTrack(sessions, trackId);
  return trackSessions.length > 0 ? trackSessions[0] : null;
}

// ─── Formatters ───────────────────────────────────────────────────────────────

function formatLocalDatetime(utcString) {
  if (!utcString) return "";
  try {
    const date = new Date(utcString);
    return date.toLocaleString(undefined, {
      weekday: "short",
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short"
    });
  } catch (e) {
    console.warn("Invalid date:", utcString);
    return utcString;
  }
}

function formatLocalDate(utcString) {
  if (!utcString) return "";
  try {
    const date = new Date(utcString);
    return date.toLocaleDateString(undefined, {
      day: "numeric",
      month: "long",
      year: "numeric"
    });
  } catch (e) {
    return utcString;
  }
}

function buildCalUrl(session) {
  try {
    const start = new Date(session.datetimeUTC);
    const end = new Date(start.getTime() + parseInt(session.durationMins, 10) * 60000);

    function toCalFmt(d) {
      return d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    }

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
  } catch (e) {
    console.warn("buildCalUrl error:", e);
    return "#";
  }
}

// ─── Spots bar ────────────────────────────────────────────────────────────────

function spotsPercent(track) {
  const total = parseInt(track.spotsTotal, 10) || 8;
  const left = parseInt(track.spotsLeft, 10) || 0;
  const filled = total - left;
  return Math.round((filled / total) * 100);
}
