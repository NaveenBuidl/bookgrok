#!/usr/bin/env node
/**
 * scripts/screenshot-check.js
 *
 * Takes screenshots of a local page at 3 viewport widths so Claude Code
 * (or anyone) can visually verify layout/CSS changes instead of just
 * reasoning through grid math and asserting it's correct.
 *
 * Zero-config usage (the common case): just run it. It starts its own
 * local server, hits the homepage, screenshots 3 widths, shuts the
 * server down, and exits.
 *
 *   npm run screenshot
 *
 * Optional flags for less common cases:
 *   --path /access/index.html   screenshot a different page (still auto-serves)
 *   --url http://localhost:3000 use an already-running server instead of auto-start
 *   --out ./somewhere           change output folder (default: ./screenshots)
 *
 * Output: PNG screenshots at 375px (mobile), 780px (breakpoint boundary),
 * and 1440px (laptop), saved to ./screenshots/ (repo-relative, gitignored —
 * do not use /tmp, it resolves inconsistently across Windows/Mac/Linux).
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const http = require('http');

const VIEWPORTS = [
  { name: 'mobile-375', width: 375, height: 812 },
  { name: 'breakpoint-780', width: 780, height: 900 },
  { name: 'laptop-1440', width: 1440, height: 900 },
];

const DEFAULT_PORT = 8000;
const REPO_ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(REPO_ROOT, 'screenshots'); // always repo-relative, no /tmp ambiguity

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    url: null,        // if not given, we auto-start a local server
    out: OUT_DIR,
    path: '/',         // page path to hit when auto-starting server, e.g. /access/index.html
  };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--url') opts.url = args[++i];
    if (args[i] === '--out') opts.out = args[++i];
    if (args[i] === '--path') opts.path = args[++i];
  }
  return opts;
}

function waitForServer(port, timeoutMs = 5000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tryOnce = () => {
      const req = http.get(`http://localhost:${port}/`, (res) => {
        res.resume();
        resolve();
      });
      req.on('error', () => {
        if (Date.now() - start > timeoutMs) reject(new Error('server did not start in time'));
        else setTimeout(tryOnce, 150);
      });
    };
    tryOnce();
  });
}

async function main() {
  const { url, out, path: pagePath } = parseArgs();

  if (!fs.existsSync(out)) {
    fs.mkdirSync(out, { recursive: true });
  }

  let serverProcess = null;
  let targetUrl = url;

  if (!targetUrl) {
    // Auto-start a static server from the repo root — no manual terminal juggling.
    console.log(`Starting local server on port ${DEFAULT_PORT} (${REPO_ROOT})...`);
    serverProcess = spawn('python', ['-m', 'http.server', String(DEFAULT_PORT)], {
      cwd: REPO_ROOT,
      stdio: 'ignore',
    });
    try {
      await waitForServer(DEFAULT_PORT);
    } catch (err) {
      serverProcess.kill();
      console.error('Could not start local server automatically. Is "python" on PATH?');
      console.error('Fallback: start your own server, then pass --url explicitly.');
      process.exit(1);
    }
    targetUrl = `http://localhost:${DEFAULT_PORT}${pagePath}`;
  }

  console.log(`Loading ${targetUrl}`);
  console.log(`Saving screenshots to ${out}\n`);

  const browser = await chromium.launch();

  try {
    for (const vp of VIEWPORTS) {
      const page = await browser.newPage({
        viewport: { width: vp.width, height: vp.height },
      });

      try {
        await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 15000 });
        // Give client-side data fetches (PapaParse/gviz CSV) a moment past
        // networkidle — they can resolve just after the network goes quiet.
        await page.waitForTimeout(500);
      } catch (err) {
        console.error(`  Failed to load ${targetUrl} at ${vp.name}: ${err.message}`);
        await page.close();
        continue;
      }

      const filePath = path.join(out, `${vp.name}.png`);
      await page.screenshot({ path: filePath, fullPage: true });
      console.log(`  ✓ ${vp.name} (${vp.width}px) -> ${filePath}`);

      await page.close();
    }
  } finally {
    await browser.close();
    if (serverProcess) serverProcess.kill();
  }

  console.log('\nDone. View the screenshots before confirming a layout change is correct.');
}

main().catch((err) => {
  console.error('screenshot-check failed:', err);
  process.exit(1);
});
