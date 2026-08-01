#!/usr/bin/env node
/**
 * scripts/smoke-test.js
 *
 * Content-agnostic structural health check. Verifies the site loads and
 * renders without leaking missing/renamed CSV columns into the UI — not
 * that it contains any particular copy, layout, or track data. Should
 * survive a full visual redesign and a CMS schema rewrite unedited.
 *
 *   npm run smoke
 *
 * Auto-starts a local static server (matches scripts/screenshot-check.js).
 * Prints one PASS/FAIL line per check, exits non-zero on any failure.
 */

const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const http = require('http');
const https = require('https');
const { chromium } = require('playwright');

const DEFAULT_PORT = 8000;
const REPO_ROOT = path.join(__dirname, '..');
const BAD_TOKENS = ['undefined', 'null', 'NaN', '[object Object]'];

const results = [];
function record(name, pass, expected, found) {
  results.push(pass);
  console.log(`${pass ? 'PASS' : 'FAIL'} — ${name}${!pass ? `\n  expected: ${expected}\n  found: ${found}` : ''}`);
}

function waitForServer(port, timeoutMs = 5000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tryOnce = () => {
      const req = http.get(`http://localhost:${port}/`, (res) => { res.resume(); resolve(); });
      req.on('error', () => {
        if (Date.now() - start > timeoutMs) reject(new Error('server did not start in time'));
        else setTimeout(tryOnce, 150);
      });
    };
    tryOnce();
  });
}

function fetchText(url, redirectsLeft = 5) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https://') ? https : http;
    lib.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirectsLeft > 0) {
        res.resume();
        resolve(fetchText(new URL(res.headers.location, url).toString(), redirectsLeft - 1));
        return;
      }
      let body = '';
      res.on('data', (c) => { body += c; });
      res.on('end', () => resolve({ status: res.statusCode, body }));
    }).on('error', reject);
  });
}

function csvRowCount(text) {
  return Math.max(0, text.split(/\r\n|\n/).filter((l) => l.trim() !== '').length - 1);
}

function badTokensIn(text) {
  return BAD_TOKENS.filter((tok) => text.includes(tok));
}

// Loads a URL in a fresh page, capturing console/uncaught-JS errors, and
// returns { page, errors } so callers can run their own assertions on top.
async function loadPage(browser, url) {
  const page = await browser.newPage();
  const errors = [];
  // Image loads (book covers, host photos from Amazon/gstatic/etc.) are expected
  // to fail sometimes and the site already has an onerror fallback for them —
  // track their URLs so the matching console error can be excluded, without
  // masking any other network or console failure (e.g. a broken CSV endpoint).
  const failedImageUrls = new Set();
  page.on('requestfailed', (req) => { if (req.resourceType() === 'image') failedImageUrls.add(req.url()); });
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    if (failedImageUrls.has(msg.location().url)) return;
    errors.push(msg.text());
  });
  page.on('pageerror', (err) => { errors.push(err.message); });
  await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(500);
  return { page, errors };
}

async function checkPage(browser, label, url) {
  const { page, errors } = await loadPage(browser, url);
  record(`${label}: loads with no console/JS errors`, errors.length === 0,
    'no console errors, no uncaught JS errors', errors.join(' | ') || 'n/a');

  const bodyText = await page.locator('body').innerText();
  const bad = badTokensIn(bodyText);
  record(`${label}: no undefined/null/NaN/[object Object] in text`, bad.length === 0,
    'none of undefined/null/NaN/[object Object] present', bad.join(', ') || 'n/a');

  const staleLinks = await page.locator('a[href*="bookgrok.mandava.in"]').count();
  record(`${label}: no link to bookgrok.mandava.in`, staleLinks === 0,
    '0 links to bookgrok.mandava.in', `${staleLinks} found`);

  return page;
}

async function main() {
  // Check 1: both CSV URLs return 200 and parse to >0 rows
  const configSrc = fs.readFileSync(path.join(REPO_ROOT, 'src', 'config.js'), 'utf8');
  const tracksCsvUrl = (configSrc.match(/tracksCsvUrl:\s*["']([^"']+)["']/) || [])[1];
  const sessionsCsvUrl = (configSrc.match(/sessionsCsvUrl:\s*["']([^"']+)["']/) || [])[1];

  let tracksCsvText = '';
  try {
    const res = await fetchText(tracksCsvUrl);
    tracksCsvText = res.body;
    const rows = csvRowCount(res.body);
    record('1a. tracksCsvUrl returns 200 with >0 rows', res.status === 200 && rows > 0,
      'HTTP 200 and >0 data rows', `HTTP ${res.status}, ${rows} row(s)`);
  } catch (err) {
    record('1a. tracksCsvUrl returns 200 with >0 rows', false, 'HTTP 200 and >0 data rows', `request failed: ${err.message}`);
  }
  try {
    const res = await fetchText(sessionsCsvUrl);
    const rows = csvRowCount(res.body);
    record('1b. sessionsCsvUrl returns 200 with >0 rows', res.status === 200 && rows > 0,
      'HTTP 200 and >0 data rows', `HTTP ${res.status}, ${rows} row(s)`);
  } catch (err) {
    record('1b. sessionsCsvUrl returns 200 with >0 rows', false, 'HTTP 200 and >0 data rows', `request failed: ${err.message}`);
  }

  console.log(`\nStarting local server on port ${DEFAULT_PORT} (${REPO_ROOT})...`);
  const server = spawn('python', ['-m', 'http.server', String(DEFAULT_PORT)], { cwd: REPO_ROOT, stdio: 'ignore' });
  try {
    await waitForServer(DEFAULT_PORT);
  } catch (err) {
    console.error('Could not start local server automatically. Is "python" on PATH?');
    server.kill();
    process.exit(1);
  }

  const browser = await chromium.launch();
  try {
    // Checks 2, 4, 7a: homepage loads clean, no bad tokens, no stale links
    const homePage = await checkPage(browser, 'Homepage', `http://localhost:${DEFAULT_PORT}/`);

    // Check 3: at least one track card
    const cardCount = await homePage.locator('.card').count();
    record('3. Homepage renders at least one track card', cardCount > 0, '>0 elements matching .card', `${cardCount} found`);
    await homePage.close();

    // Find the first published track id from the live CSV — never hardcoded.
    let trackId = null;
    const lines = tracksCsvText.split(/\r\n|\n/).filter((l) => l.trim() !== '');
    if (lines.length > 1) {
      const headers = lines[0].split(',').map((h) => h.trim());
      const idIdx = headers.indexOf('id');
      const statusIdx = headers.indexOf('status');
      if (idIdx !== -1 && statusIdx !== -1) {
        for (let i = 1; i < lines.length && !trackId; i++) {
          const cols = lines[i].split(','); // id/status assumed comma-simple; full parsing is validate-tracks.js's job
          if ((cols[statusIdx] || '').trim().toLowerCase() === 'published' && cols[idIdx]) trackId = cols[idIdx].trim();
        }
      }
    }

    if (!trackId) {
      record('5/6. Access page checks', false, 'a published track id in tracksCsvUrl', 'none found');
    } else {
      // Checks 5, 5c, 7b: access page loads clean, renders sessions, no bad tokens/links
      const accessPage = await checkPage(browser, `Access page (${trackId})`, `http://localhost:${DEFAULT_PORT}/access/?track=${encodeURIComponent(trackId)}`);
      const rowCount = await accessPage.locator('.session-table tbody tr').count();
      const emptyState = await accessPage.locator('.empty-state').count();
      record('5b. Access page renders session rows (or a valid empty state)', rowCount > 0 || emptyState > 0,
        '>0 session rows, or an .empty-state element', `${rowCount} row(s), ${emptyState} empty-state element(s)`);
      await accessPage.close();

      // Check 6: preview mode loads clean
      const previewPage = await checkPage(browser, `Access page preview (${trackId})`, `http://localhost:${DEFAULT_PORT}/access/?track=${encodeURIComponent(trackId)}&preview=1`);
      await previewPage.close();
    }
  } finally {
    await browser.close();
    server.kill();
  }

  const passCount = results.filter(Boolean).length;
  console.log(`\n${passCount}/${results.length} checks passed.`);
  process.exit(passCount === results.length ? 0 : 1);
}

main().catch((err) => {
  console.error('smoke-test failed to run:', err);
  process.exit(1);
});
