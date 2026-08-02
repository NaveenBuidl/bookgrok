#!/usr/bin/env node
/**
 * scripts/extract-cover-colors.js
 *
 * Extracts a dominant color per book cover from the live tracks CSV and
 * NORMALIZES it in OKLCH to a fixed lightness and chroma, preserving only hue,
 * for use as a 3px card border / spine-emboss tint / panel wash (src/app.js
 * already reads track.coverTint into --cover-tint).
 *
 * Why normalize rather than clamp: raw extracted swatches varied ~3.9x in OKLCH
 * chroma (0.044 to 0.172) and across 0.47-0.85 lightness. No single CSS effect
 * strength can serve that spread — a strength where the near-neutral covers are
 * still invisible has already tipped the saturated ones into a colored panel.
 * Removing the variance at the source is what lets one strength serve the whole
 * library. Same principle as Material You: the seed contributes hue, chroma is a
 * fixed constant per role. Fidelity to the cover's literal color is explicitly
 * NOT a goal here; shelf coherence is.
 *
 * Runs in Node (not the browser) specifically because CORS blocks canvas
 * pixel-sampling of m.media-amazon.com images client-side; a Node fetch has
 * no such restriction.
 *
 * Local, manual, re-runnable tool. Not part of build/deploy. Output is a
 * trackId,coverTint CSV you paste into the Sheet yourself — this script
 * never writes to the Sheet.
 *
 *   npm run extract-colors
 */

const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");
const Vibrant = require("node-vibrant");

const REPO_ROOT = path.join(__dirname, "..");
const OUT_CSV = path.join(REPO_ROOT, "cover-colors.csv");
const GITIGNORE = path.join(REPO_ROOT, ".gitignore");

// Same published gviz CSV URL src/config.js uses for the tracks tab.
const CONFIG_SRC = fs.readFileSync(path.join(REPO_ROOT, "src", "config.js"), "utf8");
const TRACKS_CSV_URL = (CONFIG_SRC.match(/tracksCsvUrl:\s*["']([^"']+)["']/) || [])[1];

// --- OKLCH normalization targets -------------------------------------------
// Every surviving swatch is rewritten to exactly this lightness and chroma; only
// its hue carries through from the cover.
//
// TARGET_L 0.62: dark enough to separate from the cream panel it washes over
// (#ede5d8 is L~0.92) while staying light enough that the 3px left rule doesn't
// read as a black bar on white.
//
// TARGET_C 0.075: the median of the measured live spread, so normalization pulls
// the four hot reds down further than it pushes the near-neutrals up — no hue has
// to travel far. Also comfortably inside the sRGB gamut at EVERY hue: the binding
// constraint is cyan (~200 deg), which caps at C~0.105 at this lightness, so 0.075
// leaves headroom and no hue silently clips (clipping would shift hue, which is
// the one property we are trying to preserve).
const TARGET_L = 0.62;
const TARGET_C = 0.075;

// Minimum chroma for a cover to be considered to HAVE a hue at all. Below this,
// the extracted swatch is essentially achromatic and its hue angle is sampling
// noise — normalizing it would invent a color out of nothing, so these are gated
// out entirely and render as the untinted neutral instead.
//
// 0.020 is the OKLCH analogue of Material You's CAM16 chroma >= 5 threshold. It
// also matches direct observation: near-grey probes are indistinguishable from
// #808080 at C~0.011, while a warm cast becomes legible by C~0.023.
const MIN_CHROMA = 0.020;

function ensureGitignored() {
  const entry = "cover-colors.csv";
  let contents = "";
  try { contents = fs.readFileSync(GITIGNORE, "utf8"); } catch (e) { /* no .gitignore yet */ }
  if (contents.split(/\r?\n/).some(line => line.trim() === entry)) return;
  const sep = contents.length && !contents.endsWith("\n") ? "\n" : "";
  fs.writeFileSync(GITIGNORE, contents + sep + entry + "\n");
}

function fetchText(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("https://") ? https : http;
    lib.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(fetchText(res.headers.location));
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      let data = "";
      res.setEncoding("utf8");
      res.on("data", chunk => { data += chunk; });
      res.on("end", () => resolve(data));
    }).on("error", reject);
  });
}

function fetchBuffer(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("https://") ? https : http;
    const req = lib.get(url, { timeout: 15000 }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(fetchBuffer(res.headers.location));
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      const chunks = [];
      res.on("data", chunk => chunks.push(chunk));
      res.on("end", () => resolve(Buffer.concat(chunks)));
    });
    req.on("error", reject);
    req.on("timeout", () => req.destroy(new Error("request timed out")));
  });
}

// Minimal CSV parser: handles quoted fields, embedded commas/quotes, matches
// what PapaParse{header:true} gives src/data.js — good enough for a CMS export.
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") { row.push(field); field = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(field); field = "";
        if (row.length > 1 || row[0] !== "") rows.push(row);
        row = [];
      } else field += c;
    }
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }

  if (!rows.length) return [];
  const headers = rows[0].map(h => h.trim());
  return rows.slice(1)
    .filter(r => r.some(v => v.trim() !== ""))
    .map(r => {
      const obj = {};
      headers.forEach((h, idx) => { obj[h] = (r[idx] || "").trim(); });
      return obj;
    });
}

function isValidUrl(url) {
  if (!url || typeof url !== "string") return false;
  return url.startsWith("https://") || url.startsWith("http://");
}

// Jimp (node-vibrant's image backend) can't decode WebP. Amazon cover URLs carry an
// explicit "_FMwebp_" format token right before the extension (see amazonResizedUrl in
// src/app.js for the full size-token shape) — stripping that token makes Amazon serve
// the same image as JPEG instead. Non-Amazon URLs, or Amazon URLs without the token,
// pass through unchanged.
function preferNonWebp(url) {
  if (!/^https?:\/\/m\.media-amazon\.com\//i.test(url)) return url;
  return url.replace(/FMwebp_(?=\.[a-zA-Z]+$)/, "");
}

// --- sRGB <-> OKLCH ---------------------------------------------------------
// Björn Ottosson's reference OKLab implementation (bottosson.github.io/posts/oklab).
// Inlined rather than pulled from a package: this stays a zero-runtime-dependency
// local script, and the transform is ~30 lines.

function srgbToLinear(c) {
  c /= 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function linearToSrgb(c) {
  return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

function rgbToOklch(r, g, b) {
  const lr = srgbToLinear(r), lg = srgbToLinear(g), lb = srgbToLinear(b);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  const L = 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s;
  const a = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s;
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s;
  let h = Math.atan2(bb, a) * 180 / Math.PI;
  if (h < 0) h += 360;
  return [L, Math.sqrt(a * a + bb * bb), h];
}

function oklchToLinearRgb(L, C, h) {
  const a = C * Math.cos(h * Math.PI / 180);
  const b = C * Math.sin(h * Math.PI / 180);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;
  const l = l_ * l_ * l_, m = m_ * m_ * m_, s = s_ * s_ * s_;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
  ];
}

function inGamut(L, C, h) {
  return oklchToLinearRgb(L, C, h).map(linearToSrgb)
    .every(v => v >= -0.0005 && v <= 1.0005);
}

// TARGET_C is chosen to be in-gamut at every hue, so this binary search is a
// belt-and-braces guard rather than a routine code path. It reduces chroma (never
// lightness, never hue) if a value somehow lands outside sRGB, because hue is the
// one channel that must survive — naive per-channel clipping would shift it.
function oklchToHex(L, C, h) {
  let c = C;
  if (!inGamut(L, c, h)) {
    let lo = 0, hi = c;
    for (let i = 0; i < 32; i++) {
      const mid = (lo + hi) / 2;
      if (inGamut(L, mid, h)) lo = mid; else hi = mid;
    }
    c = lo;
  }
  const rgb = oklchToLinearRgb(L, c, h).map(linearToSrgb)
    .map(v => Math.max(0, Math.min(255, Math.round(v * 255))));
  return "#" + rgb.map(v => v.toString(16).padStart(2, "0")).join("");
}

// Rewrite a swatch to the fixed target lightness/chroma, keeping only its hue.
// Returns null for swatches too achromatic to have a meaningful hue (see
// MIN_CHROMA) — the caller emits an empty coverTint for those, so the card falls
// back to its untinted neutral rendering.
function normalizeSwatch(rgb) {
  const [, chroma, hue] = rgbToOklch(rgb[0], rgb[1], rgb[2]);
  if (chroma < MIN_CHROMA) return null;
  return oklchToHex(TARGET_L, TARGET_C, hue);
}

// Pick the swatch whose hue best represents the cover. Since lightness and chroma
// are now normalized away downstream, the only thing this choice controls is HUE —
// so it prefers the swatch with the most chromatic signal (highest chroma above the
// gate), which is the most reliable hue reading, rather than the old "already in the
// target L/S band" test that existed to minimize how far clamping had to move a color.
function pickBestSwatch(palette) {
  const candidates = ["Vibrant", "DarkVibrant", "LightVibrant", "Muted", "DarkMuted", "LightMuted"]
    .map(name => palette[name])
    .filter(Boolean);
  if (!candidates.length) return null;

  const scored = candidates.map(sw => {
    const rgb = sw.getRgb();
    const [, chroma] = rgbToOklch(rgb[0], rgb[1], rgb[2]);
    return { rgb, chroma, population: sw.getPopulation() };
  });

  const chromatic = scored.filter(s => s.chroma >= MIN_CHROMA);
  if (chromatic.length) {
    chromatic.sort((a, b) => b.chroma - a.chroma);
    return chromatic[0].rgb;
  }

  // Every swatch is achromatic — return the most populous so normalizeSwatch can
  // apply the gate and report it as genuinely neutral.
  scored.sort((a, b) => b.population - a.population);
  return scored[0].rgb;
}

async function extractColor(url) {
  const fetchUrl = preferNonWebp(url);
  const buffer = await fetchBuffer(fetchUrl);
  const palette = await Vibrant.from(buffer).getPalette();
  const rgb = pickBestSwatch(palette);
  if (!rgb) throw new Error("no usable swatch in palette");
  return normalizeSwatch(rgb);
}

async function main() {
  if (!TRACKS_CSV_URL) {
    console.error("Could not find CONFIG.tracksCsvUrl in src/config.js");
    process.exit(1);
  }

  console.log(`Fetching live tracks CSV:\n  ${TRACKS_CSV_URL}\n`);
  const csvText = await fetchText(TRACKS_CSV_URL);
  const rows = parseCsv(csvText).map(row => {
    const out = {};
    for (const [k, v] of Object.entries(row)) out[k.trim()] = v;
    return out;
  });

  const results = [];
  const failures = [];
  const gated = [];

  for (const row of rows) {
    const trackId = row.id;
    const coverUrl = row.bookCoverUrl;
    if (!trackId) continue;

    if (!isValidUrl(coverUrl)) {
      failures.push({ trackId, reason: "missing/invalid bookCoverUrl" });
      results.push({ trackId, coverTint: "" });
      continue;
    }

    try {
      const hex = await extractColor(coverUrl);
      if (hex === null) {
        // Not a failure: the cover is genuinely achromatic, so it correctly gets
        // no tint and renders as the untinted neutral.
        gated.push(trackId);
        results.push({ trackId, coverTint: "" });
        console.log(`  ${trackId}: (gated — below MIN_CHROMA, no meaningful hue)`);
        continue;
      }
      results.push({ trackId, coverTint: hex });
      console.log(`  ${trackId}: ${hex}`);
    } catch (err) {
      console.warn(`  WARNING: ${trackId} (${coverUrl}) failed extraction: ${err.message}`);
      failures.push({ trackId, reason: err.message });
      results.push({ trackId, coverTint: "" });
    }
  }

  const csvLines = ["trackId,coverTint", ...results.map(r => `${r.trackId},${r.coverTint}`)];
  const csvOut = csvLines.join("\n") + "\n";

  ensureGitignored();
  fs.writeFileSync(OUT_CSV, csvOut);

  const succeeded = results.filter(r => r.coverTint).length;
  console.log(`\n${succeeded}/${results.length} rows produced a color ` +
    `(normalized to OKLCH L=${TARGET_L} C=${TARGET_C}, hue preserved).`);
  if (gated.length) {
    console.log(`\nGated as achromatic (${gated.length}) — these render untinted by design:`);
    gated.forEach(id => console.log(`  ${id}`));
  }
  if (failures.length) {
    console.log(`\nFailed rows (${failures.length}):`);
    failures.forEach(f => console.log(`  ${f.trackId}: ${f.reason}`));
  }
  console.log(`\nWritten to ${path.relative(REPO_ROOT, OUT_CSV)}\n`);
  console.log(csvOut);
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
