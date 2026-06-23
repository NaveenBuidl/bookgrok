// BookGrok share control
// Copies the public track URL to clipboard and offers a prefilled mailto.
// No backend, no tracking in v8.4.

function trackPublicUrl(trackId) {
  // Homepage anchor to the specific card
  return `${window.location.origin}/#track-${trackId}`;
}

function buildMailto(track) {
  const url = trackPublicUrl(track.id);
  const subject = encodeURIComponent(`Read "${track.title}" with me on BookGrok`);
  const body = encodeURIComponent(
    `I'm thinking of joining a BookGrok cohort to read "${track.title}" by ${track.author} — a small group, a host, one chapter at a time.\n\n` +
    `Want to do it with me?\n\n${url}`
  );
  return `mailto:?subject=${subject}&body=${body}`;
}

async function copyTrackLink(trackId, buttonEl) {
  const url = trackPublicUrl(trackId);
  try {
    await navigator.clipboard.writeText(url);
    flashCopied(buttonEl);
  } catch (e) {
    // Fallback for older browsers / insecure context
    const ta = document.createElement("textarea");
    ta.value = url;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); flashCopied(buttonEl); }
    catch (err) { console.warn("Copy failed:", err); }
    document.body.removeChild(ta);
  }
}

function flashCopied(buttonEl) {
  if (!buttonEl) return;
  const original = buttonEl.textContent;
  buttonEl.textContent = "Link copied";
  buttonEl.classList.add("is-copied");
  setTimeout(() => {
    buttonEl.textContent = original;
    buttonEl.classList.remove("is-copied");
  }, 1600);
}

// Wire up share buttons after render. Each share button carries data-track-id.
function initShareButtons(tracks) {
  document.querySelectorAll("[data-share-track]").forEach(btn => {
    const id = btn.getAttribute("data-share-track");
    btn.addEventListener("click", () => copyTrackLink(id, btn));
  });
  document.querySelectorAll("[data-mailto-track]").forEach(link => {
    const id = link.getAttribute("data-mailto-track");
    const track = tracks.find(t => t.id === id);
    if (track) link.setAttribute("href", buildMailto(track));
  });
}
