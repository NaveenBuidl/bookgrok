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
      ${featured.map((t, i) => buildTrackCard(t, sessions, i < 2)).join("")}
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
  initCardEntranceObserver();
}

// Entrance stagger — progressive enhancement only. Cards render fully visible by
// default (see .card in styles.css — no opacity/transform gating on the base class).
// This function OPTS cards INTO the animated entrance by adding .entrance-pending
// (which is what carries the opacity:0/offset starting state) immediately before
// observing each one, so there's never a frame where a card is invisible without an
// observer already committed to revealing it. If IntersectionObserver doesn't exist,
// or anything here throws, we bail before adding the class — cards simply stay in
// their normal visible resting state. Reduced-motion users are skipped entirely.
function initCardEntranceObserver() {
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (typeof IntersectionObserver === "undefined") return;
  try {
    const cards = document.querySelectorAll(".card:not(.entrance-pending)");
    if (!cards.length) return;
    const io = new IntersectionObserver((entries, observer) => {
      let batchIndex = 0;
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        el.style.transitionDelay = `${batchIndex * 40}ms`;
        el.classList.add("is-visible");
        observer.unobserve(el);
        batchIndex++;
      });
    }, { threshold: 0.1 });
    cards.forEach(card => {
      card.classList.add("entrance-pending");
      io.observe(card);
    });
  } catch (e) {
    console.warn("Entrance animation unavailable, cards render statically:", e);
  }
}

// Header scroll hairline (item 6) — a 12px sentinel sits right after the header; once
// it scrolls fully out of view (12px of scroll has happened), the header gets its
// bottom hairline. IntersectionObserver over a scroll listener, per the sentinel approach.
// Guarded the same way as initCardEntranceObserver: this runs before loadData() in init(),
// so an uncaught throw here would abort rendering entirely and leave the whole homepage
// blank — purely cosmetic, must never be allowed to break card rendering.
function initHeaderScrollHairline() {
  if (typeof IntersectionObserver === "undefined") return;
  try {
    const header = document.querySelector(".site-header");
    const sentinel = document.getElementById("header-scroll-sentinel");
    if (!header || !sentinel) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        header.classList.toggle("is-scrolled", !entry.isIntersecting);
      });
    }, { threshold: 0 });
    io.observe(sentinel);
  } catch (e) {
    console.warn("Header scroll hairline unavailable:", e);
  }
}

// Amazon cover URL rewrite (item 3) — m.media-amazon.com URLs carry a size segment like
// "_SY1500_", "_SL1500_", "_SY445_SX342_FMwebp_", or "_SX342_SY445_FMwebp_" right before the
// file extension. Consecutive "S[XYL]<digits>_" tokens share their underscores (no leading "_"
// on the 2nd token), so the match is one leading "_" then 1-2 "S[XYL]<digits>_" tokens, optionally
// followed by "FMwebp_". Replaces the size tokens with a fixed target width/height, keeping
// FMwebp if present. Any URL that doesn't match this shape (or isn't m.media-amazon.com) passes
// through unchanged — never break a working URL for a pattern we didn't anticipate.
const AMAZON_SIZE_RE = /_(?:S[XYL]\d+_){1,2}(?:FMwebp_)?(?=\.[a-zA-Z]+$)/;

function amazonResizedUrl(url, px) {
  if (!/^https?:\/\/m\.media-amazon\.com\//i.test(url)) return url;
  if (!AMAZON_SIZE_RE.test(url)) return url;
  const isWebp = /FMwebp_/.test(url.match(AMAZON_SIZE_RE)[0]);
  return url.replace(AMAZON_SIZE_RE, `_SY${px}_SX${Math.round(px * 0.65)}_${isWebp ? "FMwebp_" : ""}`);
}

// Crop-threshold fallback — .book-cover-frame is a fixed aspect-ratio: 0.65 box (see
// styles.css) so covers reserve their footprint before decoding, with object-fit: cover
// filling that box for every cover by default. That's the right call for most covers
// (they're close enough to 0.65 that cover just reads as a slightly bold, zoomed-in
// crop), but a source image far enough from 0.65 loses a lot of width/height under
// cover — computed live per-image from naturalWidth/naturalHeight, not hardcoded per
// track, so any future outlier self-heals the same way without needing a CMS column or
// an exceptions list. Above CROP_THRESHOLD, switch that one <img> to object-fit: contain
// (letterboxed against the frame's tint/background) instead of over-cropping it.
const COVER_FRAME_RATIO = 0.65; // must match .book-cover-frame's aspect-ratio in styles.css
const COVER_CROP_THRESHOLD = 0.08; // 8% — max width/height loss tolerated under object-fit: cover

function applyCoverFitThreshold(img) {
  const w = img.naturalWidth, h = img.naturalHeight;
  if (!w || !h) return;
  const imgRatio = w / h;
  let cropFraction;
  if (imgRatio > COVER_FRAME_RATIO) {
    cropFraction = 1 - (h * COVER_FRAME_RATIO) / w; // cover crops left+right
  } else if (imgRatio < COVER_FRAME_RATIO) {
    cropFraction = 1 - (w / COVER_FRAME_RATIO) / h; // cover crops top+bottom
  } else {
    cropFraction = 0;
  }
  if (cropFraction > COVER_CROP_THRESHOLD) img.classList.add("is-contain");
}

// Cover image markup: <img> (with Amazon srcset rewrite) + initials fallback div.
function buildCoverMarkup(track, isPriority) {
  const priorityAttrs = isPriority ? ' fetchpriority="high"' : "";
  const coverHasImg = isValidUrl(track.bookCoverUrl);
  const cover1x = coverHasImg ? amazonResizedUrl(track.bookCoverUrl, 400) : "";
  const cover2x = coverHasImg ? amazonResizedUrl(track.bookCoverUrl, 800) : "";
  // srcset only added when the 2x rewrite actually differs (i.e. it's a recognized Amazon
  // size pattern) — for pass-through URLs (non-Amazon, or an unrecognized Amazon pattern)
  // there's no known 2x variant to offer, so we just serve the single src.
  const coverSrcset = coverHasImg && cover2x !== cover1x ? ` srcset="${cover1x} 1x, ${cover2x} 2x" sizes="(max-width: 480px) 90vw, 260px"` : "";
  const coverImg = coverHasImg
    ? `<img class="book-cover" src="${cover1x}"${coverSrcset} alt="" loading="${isPriority ? 'eager' : 'lazy'}" decoding="async"${priorityAttrs} onload="applyCoverFitThreshold(this);this.classList.add('is-loaded')" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
    : "";
  const coverFallback = `<div class="book-cover-fallback" style="${coverHasImg ? 'display:none' : ''}">${escapeHtml((track.title || "?").charAt(0))}</div>`;
  return coverImg + coverFallback;
}

// Host block markup: photo + fallback, name, proof/role line, LinkedIn link.
function buildHostBlockMarkup(track) {
  const hostImg = isValidUrl(track.hostPhotoUrl)
    ? `<img class="host-photo" src="${track.hostPhotoUrl}" alt="" loading="lazy" decoding="async" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
    : "";
  const hostImgFallback = `<div class="host-photo-fallback" style="${isValidUrl(track.hostPhotoUrl) ? 'display:none' : ''}">${escapeHtml((track.host || "?").charAt(0))}</div>`;

  const hostName = track.host
    ? `<p class="host-name"><span class="host-name-label">Hosted by</span> ${escapeHtml(track.host)}</p>` : "";
  const linkedInIcon = `<svg class="linkedin-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><rect width="24" height="24" rx="5" fill="#0A66C2"/><path fill="#fff" d="M7.5 9.5h2.7v8h-2.7zM8.85 8.3a1.55 1.55 0 1 1 0-3.1 1.55 1.55 0 0 1 0 3.1zM12.5 9.5h2.6v1.1h.04c.36-.68 1.24-1.4 2.56-1.4 2.74 0 3.25 1.8 3.25 4.14v4.66h-2.7v-4.13c0-.98-.02-2.25-1.37-2.25-1.37 0-1.58 1.07-1.58 2.18v4.2h-2.7z"/></svg>`;
  const linkedInBtn = isValidUrl(track.hostLinkedIn)
    ? `<a class="btn-linkedin" href="${track.hostLinkedIn}" target="_blank" rel="noopener" aria-label="${escapeHtml(track.host || 'Host')} on LinkedIn">${linkedInIcon}</a>` : "";

  // Host proof line — placeholder data pending real cohort/completion/rating tracking.
  // These three Sheet columns (hostCohortsHosted, hostCompletionRate, hostRating) do not yet
  // reflect audited numbers. This is a private prototype; do not ship these to a public
  // launch without replacing them with real tracked values.
  const proofLines = [];
  if (track.hostCohortsHosted && track.hostCohortsHosted.trim()) {
    const n = parseInt(track.hostCohortsHosted, 10);
    if (!isNaN(n)) proofLines.push(`${n} cohort${n === 1 ? "" : "s"} hosted`);
  }
  if (track.hostCompletionRate && track.hostCompletionRate.trim()) {
    const n = parseFloat(track.hostCompletionRate);
    if (!isNaN(n)) proofLines.push(`${n}% finished the book`);
  }
  if (track.hostRating && track.hostRating.trim()) {
    const n = parseFloat(track.hostRating);
    if (!isNaN(n)) {
      const readerCount = track.hostRatingCount && track.hostRatingCount.trim() ? parseInt(track.hostRatingCount, 10) : null;
      proofLines.push(`${n.toFixed(1)} avg${readerCount && !isNaN(readerCount) ? ` from ${readerCount} readers` : ""}`);
    }
  }
  const hostProof = proofLines.length
    ? `<div class="host-proof">${proofLines.map(l => `<p class="host-proof-line">${escapeHtml(l)}</p>`).join("")}</div>`
    : (track.hostRole ? `<p class="host-role">${escapeHtml(track.hostRole)}</p>` : "");

  return hostImg + hostImgFallback + `<div class="host-text">${hostName}${hostProof}${linkedInBtn}</div>`;
}

// Pure seat-state derivation: whether spotsLeft/spotsTotal are usable, and sold-out status.
function computeSeatState(track) {
  const spotsTotalNum = parseInt(track.spotsTotal, 10);
  const spotsLeftNum = parseInt(track.spotsLeft, 10);
  const hasSpots = track.spotsLeft !== "" && track.spotsLeft != null && track.spotsTotal !== "" && track.spotsTotal != null
    && Number.isInteger(spotsTotalNum) && spotsTotalNum > 0
    && Number.isInteger(spotsLeftNum) && spotsLeftNum >= 0 && spotsLeftNum <= spotsTotalNum;
  const isSoldOut = hasSpots && spotsLeftNum === 0;
  return { hasSpots, isSoldOut, spotsLeftNum, spotsTotalNum };
}

// Pure price-display derivation: total text + per-week breakdown text.
// price is stored as "$9" (see CLAUDE.md: flat $9 everywhere) — strip a leading currency
// symbol before parsing so the per-week derivation actually runs instead of silently NaN-ing.
function computePriceDisplay(track) {
  const priceNum = parseFloat(String(track.price || "").replace(/^[^\d.-]+/, ""));
  const isPricedFree = !track.price || !track.price.trim() || (!isNaN(priceNum) && priceNum === 0);
  const sessionCountNum = parseInt(track.sessionCount, 10);
  let priceTotalText, priceUnitText;
  if (isPricedFree) {
    priceTotalText = "Free";
    priceUnitText = track.sessionCount ? `${escapeHtml(track.sessionCount)} session${sessionCountNum === 1 ? "" : "s"}` : "";
  } else {
    priceTotalText = escapeHtml(track.price);
    if (!isNaN(priceNum) && Number.isInteger(sessionCountNum) && sessionCountNum > 0) {
      const perWeek = priceNum / sessionCountNum;
      const perWeekText = perWeek < 1 ? perWeek.toFixed(2) : (Number.isInteger(perWeek) ? perWeek.toFixed(0) : perWeek.toFixed(2));
      priceUnitText = `for ${escapeHtml(track.sessionCount)} session${sessionCountNum === 1 ? "" : "s"} · $${perWeekText} a week`;
    } else if (track.sessionCount) {
      priceUnitText = `for ${escapeHtml(track.sessionCount)} session${sessionCountNum === 1 ? "" : "s"}`;
    } else {
      priceUnitText = "";
    }
  }
  return { priceTotalText, priceUnitText };
}

// Builds the three "meta" lines (schedule/weekday-time, weeks+start-date, seat dots+scarcity
// text) plus the price block they sit beside. Needs firstSession/startDate/sessionTime/
// sessionTimeTz (already derived from sessions data by the caller) and the seat state.
function buildMetaLines(track, firstSession, startDate, sessionTime, sessionTimeTz, seatState) {
  const { hasSpots, isSoldOut, spotsLeftNum, spotsTotalNum } = seatState;

  // Weekday name from the first session's date (falls back to parsing cadence's "…, <Weekday>s" tail)
  let weekdayPlural = "";
  if (firstSession && firstSession.datetimeUTC) {
    const wdDate = new Date(firstSession.datetimeUTC);
    if (!isNaN(wdDate.getTime())) {
      weekdayPlural = `${wdDate.toLocaleDateString(undefined, { weekday: "long" })}s`;
    }
  }
  if (!weekdayPlural && track.cadence) {
    const m = track.cadence.match(/,\s*([A-Za-z]+)/);
    if (m) weekdayPlural = m[1];
  }

  // --- Meta line 1: "{Weekday}s, {time} · your time" — time/"your time" omitted if datetimeUTC
  // missing/unparseable. Full offset (e.g. "GMT+5:30") kept as a title-attribute tooltip so the
  // precise timezone is still one hover away, but the reading copy states "your time" literally.
  let metaLine1Html;
  if (weekdayPlural && sessionTime) {
    metaLine1Html = `<span class="meta-time-primary">${escapeHtml(weekdayPlural)}, ${escapeHtml(sessionTime)}</span> <span class="meta-time-secondary"${sessionTimeTz ? ` title="${escapeHtml(sessionTimeTz)}"` : ""}>your time</span>`;
  } else if (weekdayPlural) {
    metaLine1Html = `<span class="meta-time-primary">${escapeHtml(weekdayPlural)}</span>`;
  } else {
    metaLine1Html = "";
  }

  // --- Meta line 2: "{N} weeks from {date}" — omitted piecewise if sessionCount/startDate missing
  const line2Parts = [];
  if (track.sessionCount) line2Parts.push(`${escapeHtml(track.sessionCount)} weeks`);
  if (startDate) line2Parts.push(`from ${startDate}`);
  const metaLine2 = line2Parts.join(" ");

  // --- Meta line 3: seat dots + honest scarcity framing
  const spotsTotalCapped = hasSpots ? Math.min(spotsTotalNum, 20) : 0; // sanity cap, not a real-world limit
  const seatDots = hasSpots
    ? `<span class="seat-dots" role="img" aria-label="${spotsTotalNum - spotsLeftNum} of ${spotsTotalNum} seats taken">${
        Array.from({ length: spotsTotalCapped }, (_, i) => `<span class="seat-dot${i < (spotsTotalNum - spotsLeftNum) ? " is-taken" : ""}"></span>`).join("")
      }</span>`
    : "";
  let seatText = "";
  let seatTextClass = "spots-neutral";
  if (isSoldOut) {
    seatText = "Cohort full";
    seatTextClass = "scarcity";
  } else if (hasSpots && spotsLeftNum <= 2) {
    seatText = `${escapeHtml(track.spotsLeft)} seat${spotsLeftNum === 1 ? "" : "s"} left of ${escapeHtml(track.spotsTotal)}`;
    seatTextClass = "scarcity";
  } else if (hasSpots) {
    seatText = `Capped at ${escapeHtml(track.spotsTotal)} · ${escapeHtml(String(spotsTotalNum - spotsLeftNum))} joined`;
    seatTextClass = "spots-neutral";
  }
  const metaLine3 = hasSpots
    ? `${seatDots}<span class="${seatTextClass}">${seatText}</span>`
    : "";

  const { priceTotalText, priceUnitText } = computePriceDisplay(track);

  return `<div class="schedule-price-row">
    <div class="meta-lines">
      ${metaLine1Html ? `<p class="track-schedule meta-line-1">${metaLine1Html}</p>` : ""}
      ${metaLine2 ? `<p class="track-schedule">${metaLine2}</p>` : ""}
      ${metaLine3 ? `<p class="track-schedule meta-line-3">${metaLine3}</p>` : ""}
    </div>
    <div class="price-lines">
      <p class="price-total">${priceTotalText}</p>
      ${priceUnitText ? `<p class="price-unit">${priceUnitText}</p>` : ""}
    </div>
  </div>`;
}

// Commitment microcopy + includes line — both optional, derived only from explicit Sheet
// fields, never guessed.
function buildCommitmentAndIncludes(track) {
  const commitmentParts = [];
  if (track.sessionMinutes && !isNaN(parseInt(track.sessionMinutes, 10))) {
    commitmentParts.push(`~${parseInt(track.sessionMinutes, 10)} min live weekly`);
  }
  if (track.pagesPerSession && !isNaN(parseInt(track.pagesPerSession, 10))) {
    commitmentParts.push(`~${parseInt(track.pagesPerSession, 10)} pages between sessions`);
  }
  const commitmentLine = commitmentParts.length
    ? `<p class="commitment-line">${commitmentParts.join(" · ")}</p>` : "";

  // Includes line — pipe-separated optional Sheet field, rendered verbatim (escaped), omitted if blank.
  const includesLine = track.includes && track.includes.trim()
    ? `<p class="includes-line">${track.includes.split("|").map(s => escapeHtml(s.trim())).filter(Boolean).join(" · ")}</p>`
    : "";

  return commitmentLine + includesLine;
}

function buildTrackCard(track, sessions, isPriority) {
  const firstSession = getFirstSession(sessions, track.id);
  const startDate = firstSession ? formatLocalDateShort(firstSession.datetimeUTC) : "";
  const sessionTime = firstSession ? formatLocalTimeOnly(firstSession.datetimeUTC) : "";
  const sessionTimeTz = firstSession ? formatLocalTimeShort(firstSession.datetimeUTC) : "";

  const coverTintAttr = track.coverTint && track.coverTint.trim() ? ` style="--cover-tint: ${escapeHtml(track.coverTint.trim())}"` : "";
  const coverMarkup = buildCoverMarkup(track, isPriority);
  const hostBlockMarkup = buildHostBlockMarkup(track);

  const seatState = computeSeatState(track);
  const registerBtn = seatState.isSoldOut
    ? `<span class="btn-primary btn-join-cohort btn-sold-out" aria-disabled="true">Cohort full</span>`
    : (isValidUrl(track.formUrl)
      ? `<a class="btn-primary btn-join-cohort" href="${track.formUrl}" target="_blank" rel="noopener">Join this cohort</a>`
      : "");

  const shareIcon = `<svg class="share-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.6" y1="10.5" x2="15.4" y2="6.5"/><line x1="8.6" y1="13.5" x2="15.4" y2="17.5"/></svg>`;
  const shareBtn = `<button class="btn-share btn-share-card" type="button" data-share-track="${escapeHtml(track.id)}" aria-label="Share">${shareIcon}</button>`;

  const category = track.category
    ? `<p class="track-category">${escapeHtml(track.category)}</p>` : "";

  const author = track.author
    ? `<p class="track-author">${escapeHtml(track.author)}</p>` : "";

  const metaBlock = buildMetaLines(track, firstSession, startDate, sessionTime, sessionTimeTz, seatState);
  const commitmentAndIncludes = buildCommitmentAndIncludes(track);

  return `
    <article class="card" id="track-${escapeHtml(track.id)}"${coverTintAttr}>
      <div class="image-wrap">
        <div class="book-cover-frame">
          ${coverMarkup}
        </div>
        ${shareBtn}
      </div>
      <div class="card-body">
        <div class="title-block">
          ${category}
          <h3 class="track-title">${escapeHtml(track.title)}</h3>
          ${author}
        </div>
        <div class="host-block">
          ${hostBlockMarkup}
        </div>
        ${metaBlock}
        ${registerBtn}
        ${commitmentAndIncludes}
        <a class="session-preview-link" href="/access/?track=${escapeHtml(track.id)}&preview=1">Preview the sessions</a>
      </div>
    </article>
  `;
}

(async function init() {
  const main = document.getElementById("main");
  if (main) main.innerHTML = `<p class="loading-state">Loading tracks…</p>`;
  initHeaderScrollHairline();
  try {
    const { tracks, sessions } = await loadData();
    renderHomepage(tracks, sessions);
    initSearch(tracks, sessions);
  } catch (err) {
    if (main) main.innerHTML = `<p class="error-state">Could not load tracks. Please refresh.<br><small>${escapeHtml(err.message || "")}</small></p>`;
  }
})();
