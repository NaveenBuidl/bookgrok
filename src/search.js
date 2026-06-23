// BookGrok homepage search
// Client-side filter over already-loaded tracks.
// Logs "not found" queries to a Google Form (no backend).

// Paste your hidden "search log" Google Form's submission URL + entry ID here.
// Setup: create a Form with one short-answer question, get a pre-filled link to
// find the entry ID, then replace /viewform with /formResponse for the action URL.
const SEARCH_LOG = {
  formActionUrl: "https://docs.google.com/forms/d/e/REPLACE_FORM_ID/formResponse",
  queryEntryId: "entry.REPLACE_ENTRY_ID"
};

let _allTracks = [];
let _allSessions = [];
let _notFoundTimer = null;

function initSearch(tracks, sessions) {
  _allTracks = tracks;
  _allSessions = sessions;
  const input = document.getElementById("search-input");
  if (!input) return;
  input.addEventListener("input", onSearchInput);
}

function onSearchInput(e) {
  const q = e.target.value.trim().toLowerCase();
  clearTimeout(_notFoundTimer);

  if (q === "") {
    renderHomepage(_allTracks, _allSessions);
    return;
  }

  const matches = _allTracks.filter(t =>
    (t.title || "").toLowerCase().includes(q) ||
    (t.author || "").toLowerCase().includes(q) ||
    (t.category || "").toLowerCase().includes(q)
  );

  renderSearchResults(matches, q);

  // If nothing matched, log the query after the user pauses typing (1.2s debounce)
  if (matches.length === 0) {
    _notFoundTimer = setTimeout(() => logNotFound(e.target.value.trim()), 1200);
  }
}

function renderSearchResults(matches, q) {
  const main = document.getElementById("main");
  if (!main) return;

  if (matches.length === 0) {
    const requestUrl = (typeof CONFIG !== "undefined" && CONFIG.requestBookUrl) || "#";
    const requestLink = isValidUrl(requestUrl)
      ? `<a href="${requestUrl}" target="_blank" rel="noopener">request this book</a>`
      : `request this book`;
    main.innerHTML = `
      <div class="search-empty">
        <p class="search-empty-title">No tracks for "${escapeHtml(q)}" yet.</p>
        <p class="search-empty-sub">We're noting what people search for. Want to read it with a cohort? ${requestLink}.</p>
      </div>`;
    return;
  }

  main.innerHTML = `
    <section class="track-section">
      <p class="section-eyebrow">${matches.length} result${matches.length > 1 ? "s" : ""}</p>
      <div class="track-list">
        ${matches.map(t => buildTrackCard(t, _allSessions)).join("")}
      </div>
    </section>`;
  initShareButtons(matches);
}

function logNotFound(rawQuery) {
  if (!rawQuery) return;
  if (SEARCH_LOG.formActionUrl.includes("REPLACE")) {
    console.log("[search-not-found]", rawQuery, "(search-log Google Form not configured yet)");
    return;
  }
  const data = new FormData();
  data.append(SEARCH_LOG.queryEntryId, rawQuery);
  fetch(SEARCH_LOG.formActionUrl, { method: "POST", mode: "no-cors", body: data })
    .catch(err => console.warn("search log failed:", err));
}
