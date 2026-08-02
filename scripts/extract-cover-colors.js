#!/usr/bin/env node
/**
 * scripts/extract-cover-colors.js
 *
 * Extracts a dominant color per book cover from the live tracks CSV, clamped
 * to safe bounds for use as a 3px card border / spine-emboss tint / low-alpha
 * radial gradient (src/app.js already reads track.coverTint into --cover-tint).
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

const LIGHTNESS_MIN = 0.30;
const LIGHTNESS_MAX = 0.62;
const SATURATION_MIN = 0.15;
const SATURATION_MAX = 0.55;

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

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;
  if (max === min) { h = s = 0; }
  else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      default: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return [h, s, l];
}

function hue2rgb(p, q, t) {
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
}

function hslToRgb(h, s, l) {
  let r, g, b;
  if (s === 0) { r = g = b = l; }
  else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

function toHex(r, g, b) {
  return "#" + [r, g, b].map(v => Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0")).join("");
}

function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }

// hslToRgb rounds to 8-bit channels, so converting a value clamped to exactly
// [MIN, MAX] can round-trip to a measured S/L a fraction of a percent outside that
// range (quantization, not a logic error). Shrink the target range by one 8-bit
// rounding step (~0.4/255) on each side before clamping, so the post-round value
// always lands inside the true [MIN, MAX] bounds.
const ROUNDING_MARGIN = 1 / 255;

// Clamp a swatch's RGB into the fixed lightness/saturation bounds (HSL), hue preserved.
function clampSwatch(rgb) {
  const [h, s, l] = rgbToHsl(rgb[0], rgb[1], rgb[2]);
  const clampedS = clamp(s, SATURATION_MIN + ROUNDING_MARGIN, SATURATION_MAX - ROUNDING_MARGIN);
  const clampedL = clamp(l, LIGHTNESS_MIN + ROUNDING_MARGIN, LIGHTNESS_MAX - ROUNDING_MARGIN);
  return toHex(...hslToRgb(h, clampedS, clampedL));
}

function pickBestSwatch(palette) {
  // Prefer swatches roughly in the target band already (most faithful to the
  // actual cover), falling back to whatever has the most pixel population.
  const candidates = ["Vibrant", "Muted", "DarkVibrant", "LightVibrant", "DarkMuted", "LightMuted"]
    .map(name => palette[name])
    .filter(Boolean);
  if (!candidates.length) return null;

  const inBand = candidates.find(sw => {
    const [, s, l] = rgbToHsl(...sw.getRgb());
    return l >= LIGHTNESS_MIN && l <= LIGHTNESS_MAX && s >= SATURATION_MIN && s <= SATURATION_MAX;
  });
  if (inBand) return inBand.getRgb();

  candidates.sort((a, b) => b.getPopulation() - a.getPopulation());
  return candidates[0].getRgb();
}

async function extractColor(url) {
  const fetchUrl = preferNonWebp(url);
  const buffer = await fetchBuffer(fetchUrl);
  const palette = await Vibrant.from(buffer).getPalette();
  const rgb = pickBestSwatch(palette);
  if (!rgb) throw new Error("no usable swatch in palette");
  return clampSwatch(rgb);
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
  console.log(`\n${succeeded}/${results.length} rows produced a color.`);
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
