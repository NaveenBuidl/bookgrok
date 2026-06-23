// BookGrok homepage render logic
// Renders: headline, "Open now" featured tracks, "Full library" rest.
// Per card: Register + Share only. NEVER Meet/Calendar/Homework/Slack/access/Buy.

function renderHomepage(tracks, sessions) {
  const main = document.getElementById("main");
  if (!main) return;

  if (tracks.length === 0) {
    main.innerHTML = `<p class="empty-state">No tracks available right now. Check back soon.</p>`;
    return;
  }

  const featuredCount = (CONFIG && CONFIG.featuredCount) || 6;
  const featured = tracks.slice(0, featuredCount);
  const library = tracks.slice(featuredCount);

  let html = "";

  html += `<section class="track-section">
    <p class="section-eyebrow">Open now</p>
    <div class="track-list">
      ${featured.map(t => buildTrackCard(t, sessions)).join("")}
    </div>
  </section>`;

  if (library.length > 0) {
    html += `<section class="track-section">
      <p class="section-eyebrow">Full library</p>
      <div class="track-list">
        ${library.map(t => buildTrackCard(t, sessions)).join("")}
      </div>
    </section>`;
  }

  main.innerHTML = html;
  initShareButtons(tracks);
}

function buildTrackCard(track, sessions) {
  const firstSession = getFirstSession(sessions, track.id);
  const startDate = firstSession ? formatLocalDate(firstSession.datetimeUTC) : "";
  const pct = spotsPercent(track);

  const coverImg = isValidUrl(track.bookCoverUrl)
    ? `<img class="book-cover" src="${track.bookCoverUrl}" alt="${escapeHtml(track.title)} cover" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
    : "";
  const coverFallback = `<div class="book-cover-fallback" style="${isValidUrl(track.bookCoverUrl) ? 'display:none' : ''}">${escapeHtml(track.title.charAt(0))}</div>`;

  const hostImg = isValidUrl(track.hostPhotoUrl)
    ? `<img class="host-photo" src="${track.hostPhotoUrl}" alt="${escapeHtml(track.host)}" onerror="this.style.display='none'">`
    : `<div class="host-photo host-photo-fallback">${escapeHtml(track.host.charAt(0))}</div>`;

  const registerBtn = isValidUrl(track.formUrl)
    ? `<a class="btn-primary" href="${track.formUrl}" target="_blank" rel="noopener">Register</a>`
    : "";

  const shareBtn = `<button class="btn-share" type="button" data-share-track="${escapeHtml(track.id)}">Share</button>`;

  const category = track.category
    ? `<p class="track-category">${escapeHtml(track.category)}</p>` : "";

  return `
    <article class="card" id="track-${escapeHtml(track.id)}">
      <div class="card-top">
        <div class="image-wrap">
          ${coverImg}${coverFallback}
          ${hostImg}
        </div>
        <div class="card-meta">
          ${category}
          <h2 class="track-title">${escapeHtml(track.title)}</h2>
          <p class="track-author">${escapeHtml(track.author)}</p>
          <p class="host-line">Hosted by <strong>${escapeHtml(track.host)}</strong></p>
          <p class="host-role">${escapeHtml(track.hostRole)}</p>
          <div class="track-details">
            <span>${escapeHtml(track.sessionCount)} sessions</span>
            <span class="detail-sep">·</span>
            <span>${escapeHtml(track.cadence)}</span>
            ${startDate ? `<span class="detail-sep">·</span><span>Starts ${startDate}</span>` : ""}
          </div>
          <div class="spots">
            <span class="spots-label">${escapeHtml(track.spotsLeft)} of ${escapeHtml(track.spotsTotal)} spots left</span>
            <div class="spots-bar" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100">
              <span class="spots-fill" style="width:${pct}%"></span>
            </div>
          </div>
          <div class="card-actions">
            <span class="price">${escapeHtml(track.price)}</span>
            <div class="btn-group">
              ${shareBtn}
              ${registerBtn}
            </div>
          </div>
        </div>
      </div>
    </article>
  `;
}

(async function init() {
  const main = document.getElementById("main");
  if (main) main.innerHTML = `<p class="loading-state">Loading tracks…</p>`;
  try {
    const { tracks, sessions } = await loadData();
    renderHomepage(tracks, sessions);
    initSearch(tracks, sessions);
  } catch (err) {
    if (main) main.innerHTML = `<p class="error-state">Could not load tracks. Please refresh.<br><small>${escapeHtml(err.message || "")}</small></p>`;
  }
})();
