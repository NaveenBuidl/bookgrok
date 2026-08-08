#!/usr/bin/env node
// Plain Node assert tests for BookGrok's pure logic — price/seat math, date
// formatting, URL validation, Amazon cover URL rewrite. No test framework,
// no new dependency: run with `node tests/logic.test.js` or `npm run test`.
//
// src/app.js and src/data.js are plain global-scope browser scripts (no
// module.exports), so they're loaded into a vm sandbox with minimal DOM/
// CONFIG stubs — just enough that app.js's trailing self-invoking init()
// doesn't throw uncaught (it already try/catches its own body defensively).
// Real DOM rendering is NOT exercised here; that's what npm run screenshot
// and npm run smoke are for. This file only tests the pure computation
// functions extracted in the buildTrackCard refactor.

const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");

const REPO_ROOT = path.join(__dirname, "..");

function loadSandbox() {
  const sandbox = {
    console,
    document: {
      getElementById: () => null,
      querySelector: () => null,
      querySelectorAll: () => [],
    },
    window: {
      matchMedia: () => ({ matches: false }),
      location: { origin: "https://bookgrok.example", search: "" },
    },
    IntersectionObserver: undefined,
    CONFIG: { tracksCsvUrl: "", sessionsCsvUrl: "", featuredCount: 6, requestBookUrl: "" },
    Papa: { parse: () => {} },
    URLSearchParams: URLSearchParams,
    setTimeout,
    clearTimeout,
  };
  vm.createContext(sandbox);

  const dataSrc = fs.readFileSync(path.join(REPO_ROOT, "src", "data.js"), "utf8");
  vm.runInContext(dataSrc, sandbox, { filename: "src/data.js" });

  const appSrc = fs.readFileSync(path.join(REPO_ROOT, "src", "app.js"), "utf8");
  vm.runInContext(appSrc, sandbox, { filename: "src/app.js" });

  return sandbox;
}

const sandbox = loadSandbox();
const { computeSeatState, computePriceDisplay, amazonResizedUrl } = sandbox;
const { formatLocalDateShort, formatLocalTimeOnly, formatLocalTimeShort, isValidUrl } = sandbox;

let passed = 0, failed = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`PASS — ${name}`);
    passed++;
  } catch (err) {
    console.log(`FAIL — ${name}\n  ${err.message}`);
    failed++;
  }
}

// --- computeSeatState -------------------------------------------------

test("computeSeatState: normal case (ai-snake-oil: 2 left of 8)", () => {
  const s = computeSeatState({ spotsLeft: "2", spotsTotal: "8" });
  assert.equal(s.hasSpots, true);
  assert.equal(s.isSoldOut, false);
  assert.equal(s.spotsLeftNum, 2);
  assert.equal(s.spotsTotalNum, 8);
});

test("computeSeatState: sold out (0 left)", () => {
  const s = computeSeatState({ spotsLeft: "0", spotsTotal: "8" });
  assert.equal(s.hasSpots, true);
  assert.equal(s.isSoldOut, true);
});

test("computeSeatState: missing spotsLeft/spotsTotal", () => {
  const s = computeSeatState({ spotsLeft: "", spotsTotal: "" });
  assert.equal(s.hasSpots, false);
  assert.equal(s.isSoldOut, false);
});

test("computeSeatState: malformed (non-numeric) spots", () => {
  const s = computeSeatState({ spotsLeft: "abc", spotsTotal: "8" });
  assert.equal(s.hasSpots, false);
});

test("computeSeatState: spotsLeft greater than spotsTotal is rejected", () => {
  const s = computeSeatState({ spotsLeft: "9", spotsTotal: "8" });
  assert.equal(s.hasSpots, false);
});

// --- computePriceDisplay -----------------------------------------------

test("computePriceDisplay: flat $9 renders total only, no per-week breakdown", () => {
  const p = computePriceDisplay({ price: "$9", sessionCount: "6" });
  assert.equal(p.priceTotalText, "$9");
  assert.equal(p.priceUnitText, "");
});

test("computePriceDisplay: blank price renders as Free with no sub-line", () => {
  const p = computePriceDisplay({ price: "", sessionCount: "6" });
  assert.equal(p.priceTotalText, "Free");
  assert.equal(p.priceUnitText, "");
});

// --- date/time formatters (src/data.js) --------------------------------

test("formatLocalDateShort: valid ISO UTC input parses", () => {
  const out = formatLocalDateShort("2026-03-05T18:30:00Z");
  assert.ok(out.length > 0, "expected a non-empty formatted date");
});

test("formatLocalDateShort: empty string returns empty string", () => {
  assert.equal(formatLocalDateShort(""), "");
});

test("formatLocalDateShort: unparseable string returns empty string", () => {
  assert.equal(formatLocalDateShort("not-a-date"), "");
});

test("formatLocalTimeOnly: empty/unparseable input returns empty string", () => {
  assert.equal(formatLocalTimeOnly(""), "");
  assert.equal(formatLocalTimeOnly("garbage"), "");
});

test("formatLocalTimeShort: empty/unparseable input returns empty string", () => {
  assert.equal(formatLocalTimeShort(""), "");
  assert.equal(formatLocalTimeShort("garbage"), "");
});

// --- isValidUrl (src/data.js) — bar #8: security guard stays correct ---

test("isValidUrl: accepts http/https", () => {
  assert.equal(isValidUrl("https://example.com"), true);
  assert.equal(isValidUrl("http://example.com"), true);
});

test("isValidUrl: rejects javascript: URLs", () => {
  assert.equal(isValidUrl("javascript:alert(1)"), false);
});

test("isValidUrl: rejects blank/missing", () => {
  assert.equal(isValidUrl(""), false);
  assert.equal(isValidUrl(null), false);
  assert.equal(isValidUrl(undefined), false);
});

// --- amazonResizedUrl (src/app.js) --------------------------------------

test("amazonResizedUrl: rewrites a real Amazon cover URL (ai-snake-oil)", () => {
  const url = "https://m.media-amazon.com/images/I/819XVWya1TL._SL1500_.jpg";
  const out = amazonResizedUrl(url, 400);
  assert.equal(out, "https://m.media-amazon.com/images/I/819XVWya1TL._SY400_SX260_.jpg");
});

test("amazonResizedUrl: non-Amazon URL passes through unchanged", () => {
  const url = "https://example.com/cover.jpg";
  assert.equal(amazonResizedUrl(url, 400), url);
});

// --- summary -------------------------------------------------------------

console.log(`\n${passed}/${passed + failed} checks passed.`);
process.exit(failed === 0 ? 0 : 1);
