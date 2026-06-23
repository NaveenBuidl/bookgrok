// BookGrok access page render logic
// Runs on access/index.html
// Renders Join links, Calendar buttons, Submit HW, and community block

function getTrackIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("track") || "";
}

function renderAccessPage(tracks, sessions) {
  const trackId = getTrackIdFromUrl();
  const main = document.getElementById("main");
  const titleEl = document.getElementById("page-title");
  const subtitleEl = document.getElementById("page-subtitle");

  if (!main) return;

  if (!trackId) {
    main.innerHTML = `<p class="error-state">No track specified. <a href="/">Browse all tracks</a>.</p>`;
    return;
  }

  const track = tracks.find(t => t.id === trackId);

  if (!track) {
    main.innerHTML = `<p class="error-state">Track not found. It may have been removed or the URL is incorrect. <a href="/">Browse all tracks</a>.</p>`;
    return;
  }

  const trackSessions = getSessionsForTrack(sessions, trackId);

  // Update page title and subtitle
  if (titleEl) titleEl.textContent = track.title;
  if (subtitleEl) subtitleEl.textContent = `${track.author} · Hosted by ${track.host} · ${track.hostRole}`;
  document.title = `${track.title} — BookGrok`;

  main.innerHTML =
    buildAccessNotice() +
    buildBuyBookSection(track) +
    buildSessionTable(trackSessions, track) +
    buildCommunityBlock(track);
}

function buildAccessNotice() {
  return `
    <div class="access-notice">
      You are registered. Bookmark this page — it has your Join links, calendar buttons, and cohort discussion.
    </div>
  `;
}

function buildBuyBookSection(track) {
  if (!isValidUrl(track.buyBookUrl)) return "";
  return `
    <div class="buy-book-wrap">
      <a class="btn-secondary" href="${track.buyBookUrl}" target="_blank" rel="noopener">Buy the book</a>
    </div>
  `;
}

function buildSessionTable(trackSessions, track) {
  if (trackSessions.length === 0) {
    return `<p class="empty-state">No sessions scheduled yet. Check back soon.</p>`;
  }

  const hasHomework = isValidUrl(track.homeworkFormUrl);

  const rows = trackSessions.map(s => {
    const calUrl = buildCalUrl(s);
    const joinBtn = isValidUrl(s.meetLink)
      ? `<a class="btn-join" href="${s.meetLink}" target="_blank" rel="noopener">Join</a>`
      : "";
    const calBtn = calUrl !== "#"
      ? `<a class="btn-cal" href="${calUrl}" target="_blank" rel="noopener">+ Calendar</a>`
      : "";
    const hwBtn = hasHomework
      ? `<a class="btn-hw" href="${track.homeworkFormUrl}" target="_blank" rel="noopener">Submit HW</a>`
      : "";

    return `
      <tr>
        <td class="col-session">Session ${escapeHtml(s.number)}</td>
        <td class="col-chapters">${escapeHtml(s.chapters)}</td>
        <td class="col-datetime">${formatLocalDatetime(s.datetimeUTC)}</td>
        <td class="col-actions">
          ${calBtn}
          ${joinBtn}
          ${hwBtn}
        </td>
      </tr>
    `;
  }).join("");

  return `
    <section class="sessions-section">
      <p class="section-label">Session schedule — times in your local timezone</p>
      <div class="table-scroll">
        <table class="session-table">
          <thead>
            <tr>
              <th>Session</th>
              <th>Reading</th>
              <th>Date &amp; time</th>
              <th></th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </section>
  `;
}

function buildCommunityBlock(track) {
  if (!track.communityPlatform) return "";

  const channelName = track.communityChannelName
    ? `<span class="community-channel">${escapeHtml(track.communityChannelName)}</span>`
    : "";

  let content = "";
  if (isValidUrl(track.communityUrl)) {
    content = `<a class="btn-secondary" href="${track.communityUrl}" target="_blank" rel="noopener">Join cohort discussion</a>`;
  } else if (track.communityInstructions) {
    content = `<p class="community-instructions">${escapeHtml(track.communityInstructions)}</p>`;
  }

  return `
    <section class="community-section">
      <p class="section-label">Cohort discussion</p>
      <div class="community-block">
        <span class="community-platform">${escapeHtml(track.communityPlatform)}</span>
        ${channelName}
        ${content}
      </div>
    </section>
  `;
}

// ─── Init ─────────────────────────────────────────────────────────────────────

(async function init() {
  const main = document.getElementById("main");
  if (main) main.innerHTML = `<p class="loading-state">Loading your session details…</p>`;

  try {
    const { tracks, sessions } = await loadData();
    renderAccessPage(tracks, sessions);
  } catch (err) {
    if (main) {
      main.innerHTML = `<p class="error-state">Could not load session details. Please refresh the page.<br><small>${escapeHtml(err.message || "")}</small></p>`;
    }
  }
})();
