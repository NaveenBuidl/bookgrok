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

function fetchCsv(url) {
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
      error: (err) => { console.error("CSV parse error:", url, err); reject(err); }
    });
  });
}

async function loadData() {
  const [rawTracks, rawSessions] = await Promise.all([
    fetchCsv(CONFIG.tracksCsvUrl),
    fetchCsv(CONFIG.sessionsCsvUrl)
  ]);

  rawTracks.forEach((r, i) => { if (!r.id) console.warn(`tracks row ${i + 2}: missing id`); });
  rawSessions.forEach((r, i) => { if (!r.trackId) console.warn(`sessions row ${i + 2}: missing trackId`); });

  const tracks = rawTracks
    .filter(t => t.id && t.status === "published")
    .sort((a, b) => parseInt(a.sortOrder, 10) - parseInt(b.sortOrder, 10));

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
