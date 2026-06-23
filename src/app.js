// BookGrok homepage render logic
// Runs on index.html
// NEVER renders Meet links, Calendar links, homework URLs, Slack links, or access page URLs

function renderHomepage(tracks, sessions) {
  const main = document.getElementById("main");
  if (!main) return;

  if (tracks.length === 0) {
    main.innerHTML = `<p class="empty-state">No tracks available right now. Check back soon.</p>`;
    return;
  }

  main.innerHTML = tracks.map(track => buildTrackCard(track, sessions)).join("");
}

function buildTrackCard(track, sessions) {
  const firstSession = getFirstSession(sessions, track.id);
  const startDate = firstSession ? formatLocalDate(firstSession.datetimeUTC) : "";
  const pct = spotsPercent(track);

  // Image: use src only if valid URL, else show initials fallback
  const coverImg = isValidUrl(track.bookCoverUrl)
    ? `<img class="book-cover" src="${track.bookCoverUrl}" alt="${escapeHtml(track.title)} cover" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
    : "";
  const coverFallback = `<div class="book-cover-fallback" style="${isValidUrl(track.bookCoverUrl) ? 'display:none' : ''}">${escapeHtml(track.title.charAt(0))}</div>`;

  const hostImg = isValidUrl(track.hostPhotoUrl)
    ? `<img class="host-photo" src="${track.hostPhotoUrl}" alt="${escapeHtml(track.host)}" onerror="this.style.display='none'">`
    : `<div class="host-photo host-photo-fallback">${escapeHtml(track.host.charAt(0))}</div>`;

  const buyBtn = isValidUrl(track.buyBookUrl)
    ? `<a class="btn-secondary" href="${track.buyBookUrl}" target="_blank" rel="noopener">Buy the book</a>`
    : "";

  const registerBtn = isValidUrl(track.formUrl)
    ? `<a class="btn-primary" href="${track.formUrl}" target="_blank" rel="noopener">Register</a>`
    : "";

  return `
    <article class="card">
      <div class="card-top">
        <div class="image-wrap">
          ${coverImg}${coverFallback}
          ${hostImg}
        </div>
        <div class="card-meta">
          <h2 class="track-title">${escapeHtml(track.title)}</h2>
          <p class="track-author">${escapeHtml(track.author)}</p>
          <p class="host-line">Hosted by <strong>${escapeHtml(track.host)}</strong></p>
          <p class="host-role">${escapeHtml(track.hostRole)}</p>
          <div class="track-details">
            <span class="detail-item">${escapeHtml(track.sessionCount)} sessions</span>
            <span class="detail-sep">·</span>
            <span class="detail-item">${escapeHtml(track.cadence)}</span>
            ${startDate ? `<span class="detail-sep">·</span><span class="detail-item">Starts ${startDate}</span>` : ""}
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
              ${buyBtn}
              ${registerBtn}
            </div>
          </div>
        </div>
      </div>
    </article>
  `;
}

// ─── Init ─────────────────────────────────────────────────────────────────────

(async function init() {
  const main = document.getElementById("main");

  // Show loading state
  if (main) main.innerHTML = `<p class="loading-state">Loading tracks…</p>`;

  try {
    const { tracks, sessions } = await loadData();
    renderHomepage(tracks, sessions);
  } catch (err) {
    if (main) {
      main.innerHTML = `<p class="error-state">Could not load tracks. Please refresh the page.<br><small>${escapeHtml(err.message || "")}</small></p>`;
    }
  }
})();
