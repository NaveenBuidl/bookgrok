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

  const featuredCount = parseInt((CONFIG && CONFIG.featuredCount) || 6, 10) || 6;
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
    ? `<img class="book-cover" src="${track.bookCoverUrl}" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
    : "";
  const coverFallback = `<div class="book-cover-fallback" style="${isValidUrl(track.bookCoverUrl) ? 'display:none' : ''}">${escapeHtml(track.title.charAt(0))}</div>`;

  const hostImg = isValidUrl(track.hostPhotoUrl)
    ? `<img class="host-photo" src="${track.hostPhotoUrl}" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
    : "";
  const hostImgFallback = `<div class="host-photo-fallback" style="${isValidUrl(track.hostPhotoUrl) ? 'display:none' : ''}">${escapeHtml((track.host || "?").charAt(0))}</div>`;

  const registerBtn = isValidUrl(track.formUrl)
    ? `<a class="btn-primary" href="${track.formUrl}" target="_blank" rel="noopener">Register</a>`
    : "";

  const shareIcon = `<svg class="share-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.6" y1="10.5" x2="15.4" y2="6.5"/><line x1="8.6" y1="13.5" x2="15.4" y2="17.5"/></svg>`;
  const shareBtn = `<button class="btn-share" type="button" data-share-track="${escapeHtml(track.id)}" aria-label="Share">${shareIcon}</button>`;

  const category = track.category
    ? `<p class="track-category">${escapeHtml(track.category)}</p>` : "";

  const subtitle = track["sub-title"]
    ? `<p class="track-subtitle">${escapeHtml(track["sub-title"])}</p>` : "";

  const author = track.author
    ? `<p class="track-author">${escapeHtml(track.author)}${track.pagecount ? ` · ${escapeHtml(track.pagecount)} pages` : ""}</p>` : "";

  const hostName = track.host
    ? `<p class="host-name">Hosted by ${escapeHtml(track.host)}</p>` : "";
  const hostRole = track.hostRole
    ? `<p class="host-role">${escapeHtml(track.hostRole)}</p>` : "";
  const linkedInIcon = `<svg class="linkedin-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><rect width="24" height="24" rx="5" fill="#0A66C2"/><path fill="#fff" d="M7.5 9.5h2.7v8h-2.7zM8.85 8.3a1.55 1.55 0 1 1 0-3.1 1.55 1.55 0 0 1 0 3.1zM12.5 9.5h2.6v1.1h.04c.36-.68 1.24-1.4 2.56-1.4 2.74 0 3.25 1.8 3.25 4.14v4.66h-2.7v-4.13c0-.98-.02-2.25-1.37-2.25-1.37 0-1.58 1.07-1.58 2.18v4.2h-2.7z"/></svg>`;
  const linkedInBtn = isValidUrl(track.hostLinkedIn)
    ? `<a class="btn-linkedin" href="${track.hostLinkedIn}" target="_blank" rel="noopener" aria-label="LinkedIn">${linkedInIcon}</a>` : "";

  const detailParts = [];
  if (track.sessionCount) detailParts.push(`<span>${escapeHtml(track.sessionCount)} sessions</span>`);
  if (track.cadence) detailParts.push(`<span>${escapeHtml(track.cadence)}</span>`);
  if (startDate) detailParts.push(`<span>Starts ${startDate}</span>`);
  const details = detailParts.length
    ? `<div class="track-details">${detailParts.join('<span class="detail-sep">·</span>')}</div>` : "";

  const spotsTotalNum = parseInt(track.spotsTotal, 10);
  const spotsLeftNum = parseInt(track.spotsLeft, 10);
  const hasSpots = track.spotsLeft !== "" && track.spotsLeft != null && track.spotsTotal !== "" && track.spotsTotal != null
    && Number.isInteger(spotsTotalNum) && spotsTotalNum > 0
    && Number.isInteger(spotsLeftNum) && spotsLeftNum >= 0 && spotsLeftNum <= spotsTotalNum;
  const spots = hasSpots
    ? (() => {
        const takenCount = spotsTotalNum - spotsLeftNum;
        const dots = Array.from({ length: spotsTotalNum }, (_, i) =>
          `<span class="spot-dot${i < takenCount ? " is-taken" : ""}"></span>`
        ).join("");
        return `<div class="spots">
        <span class="spots-label">${escapeHtml(track.spotsLeft)} of ${escapeHtml(track.spotsTotal)} spots left</span>
        <div class="spots-dots" role="img" aria-label="${takenCount} of ${spotsTotalNum} spots taken">${dots}</div>
      </div>`;
      })()
    : "";

  const price = track.price
    ? `<span class="price">${escapeHtml(track.price)}</span>` : "";

  return `
    <article class="card" id="track-${escapeHtml(track.id)}">
      <div class="card-head">
        <div class="image-wrap">
          ${coverImg}${coverFallback}
        </div>
        <div class="identity-stack">
          <div class="identity-box">
            ${category}
            <h2 class="track-title">${escapeHtml(track.title)}</h2>
            ${subtitle}
            ${author}
          </div>
          <div class="host-box">
            ${hostImg}${hostImgFallback}
            <div class="host-text">
              ${hostName}
              ${hostRole}
              ${linkedInBtn}
            </div>
          </div>
        </div>
      </div>
      <div class="card-footer">
        <div class="footer-top">
          ${details}
          ${price}
        </div>
        ${spots}
        <div class="btn-group">
          <a class="btn-preview" href="/access/?track=${escapeHtml(track.id)}&preview=1">See sessions</a>
          ${shareBtn}
          ${registerBtn}
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
