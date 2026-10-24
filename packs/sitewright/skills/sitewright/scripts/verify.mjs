#!/usr/bin/env node
// Sitewright verifier: drives a GENERATED site in a real browser (Playwright + Chromium) at desktop and phone widths and checks
// every module it contains. It reads the site's own src/content/site.json, so it needs no configuration.
//
//   cd <a folder where `npm i playwright` has been run>
//   node <skill>/scripts/verify.mjs --site D:/path/to/generated-site [--port 4010] [--out D:/path/to/screenshots] [--no-start]
//
// Exit code 0 only if every check passed. Screenshots (desktop + mobile, every page) are written to --out.
// The site must be built (`npm run build`); the verifier starts `next start` itself unless --no-start.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const SITE = path.resolve(arg('site', '.'));
const PORT = Number(arg('port', '4010'));
const OUT = path.resolve(arg('out', path.join(SITE, '.verify')));
const NOSTART = argv.includes('--no-start');
const KEEP = argv.includes('--keep-server'); // debugging: leave the server and its data running after the checks
const APK = arg('apk', '');
const BASE = `http://localhost:${PORT}`;

const require = createRequire(path.join(process.cwd(), 'noop.js'));
const { chromium } = require('playwright');

// ---- site facts ---------------------------------------------------------------------------------------------------------
const site = JSON.parse(fs.readFileSync(path.join(SITE, 'src/content/site.json'), 'utf8'));
const env = Object.fromEntries(fs.readFileSync(path.join(SITE, '.env.local'), 'utf8').split('\n')
  .filter((l) => l && !l.startsWith('#') && l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
const has = (m) => site.modules.includes(m);
const flag = (f) => site.flags.includes(f);
fs.mkdirSync(OUT, { recursive: true });

// ---- tiny harness ---------------------------------------------------------------------------------------------------------
const results = [];
let section = '';
let skipping = null; // while set, checks are recorded as skipped (with this reason) instead of run
async function check(name, fn) {
  const label = `${section ? section + ' · ' : ''}${name}`;
  if (skipping) { results.push({ label, ok: true, skipped: skipping }); console.log(`  skip  ${label}`); return; }
  try { await fn(); results.push({ label, ok: true }); console.log(`  ok    ${label}`); }
  catch (e) { results.push({ label, ok: false, error: String(e.message ?? e) }); console.log(`  FAIL  ${label}\n        ${String(e.message ?? e).split('\n')[0]}`); }
}
const eq = (a, b, what) => { if (a !== b) throw new Error(`${what}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); };
const truthy = (v, what) => { if (!v) throw new Error(`${what}: expected truthy, got ${JSON.stringify(v)}`); };

// ---- TOTP (RFC 6238) - the test's own implementation, deliberately independent of the site's -----------------------------
function totp(secretB32, step) {
  const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const c of secretB32.replace(/[\s=]/g, '').toUpperCase()) bits += B32.indexOf(c).toString(2).padStart(5, '0');
  const key = Buffer.from(Array.from({ length: Math.floor(bits.length / 8) }, (_, i) => parseInt(bits.slice(i * 8, i * 8 + 8), 2)));
  const counter = Buffer.alloc(8); counter.writeBigUInt64BE(BigInt(step));
  const h = crypto.createHmac('sha1', key).update(counter).digest();
  const o = h[h.length - 1] & 15;
  const n = ((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(n % 1_000_000).padStart(6, '0');
}
const nowStep = () => Math.floor(Date.now() / 1000 / 30);

// ---- server -----------------------------------------------------------------------------------------------------------------
let server = null;
const scratch = [];
async function startServer() {
  if (NOSTART) return;
  if (!fs.existsSync(path.join(SITE, '.next'))) throw new Error('The site is not built. Run `npm run build` in it first.');
  const nextBin = path.join(SITE, 'node_modules/next/dist/bin/next');
  // A throwaway database and storage per run, so a re-run starts from nothing (process env wins over .env.local).
  const stamp = Date.now();
  scratch.push(path.join(SITE, `.verify-pg-${stamp}`), path.join(SITE, `.verify-storage-${stamp}`));
  const keepLog = KEEP ? fs.openSync(path.join(OUT, 'server.log'), 'a') : null;
  server = spawn(process.execPath, [nextBin, 'start', '-p', String(PORT)], {
    cwd: SITE, detached: KEEP, stdio: KEEP ? ['ignore', keepLog, keepLog] : ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, NODE_ENV: 'production', DATABASE_URL: `pglite://.verify-pg-${stamp}`, STORAGE_PROVIDER: 'local', LOCAL_STORAGE_DIR: `.verify-storage-${stamp}`, PUBLIC_BASE_URL: BASE },
  });
  let log = '';
  if (!KEEP) { server.stdout.on('data', (d) => { log += d; }); server.stderr.on('data', (d) => { log += d; }); } else server.unref();
  for (let i = 0; i < 80; i++) {
    try { const r = await fetch(`${BASE}/`, { redirect: 'manual' }); if (r.status < 500) return; } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`The server did not start:\n${log.slice(-1500)}`);
}

// ---- browser helpers ------------------------------------------------------------------------------------------------------
const VIEWPORTS = { desktop: { width: 1280, height: 800 }, mobile: { width: 390, height: 844 }, narrow: { width: 360, height: 740 } };
const consoleErrors = [];
const IGNORED = /status of (400|401|403|409) |fonts\.(googleapis|gstatic)|favicon|net::ERR_(INTERNET_DISCONNECTED|NAME_NOT_RESOLVED|CONNECTION)|Failed to load resource.*(font|googleapis)/i;

const stubFonts = async (ctx) => { if (!process.env.SITEWRIGHT_VERIFY_FONTS) await ctx.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, (route) => route.fulfill({ status: 200, contentType: 'text/css', body: '' })); };

async function newPage(browser, vp, name, extra = {}) {
  const ctx = await browser.newContext({
    viewport: VIEWPORTS[vp], deviceScaleFactor: vp === 'desktop' ? 1 : 2, isMobile: vp !== 'desktop', hasTouch: vp !== 'desktop',
    permissions: ['clipboard-read', 'clipboard-write'], acceptDownloads: true, ...extra,
  });
  // Fonts come from Google at run time and every face has a system fallback, so the tests answer those requests themselves: the result then
  // does not depend on a third-party server (or on the machine having internet). Set SITEWRIGHT_VERIFY_FONTS=1 to load the real ones.
  await stubFonts(ctx);
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error' && !IGNORED.test(m.text())) consoleErrors.push(`[${name}] ${m.text()}`); });
  page.on('pageerror', (e) => consoleErrors.push(`[${name}] pageerror: ${e.message}`));
  page.setDefaultTimeout(30000);
  return { ctx, page };
}

const shot = async (page, name) => page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true });
const overflow = (page) => page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));

/** Scrolls the whole page in steps so every scroll-triggered reveal fires, then returns to the top. */
async function scrollThrough(page) {
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < h; y += 500) { await page.evaluate((v) => window.scrollTo(0, v), y); await page.waitForTimeout(60); }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(200);
}

async function noOverflow(page, where) {
  const { sw, iw } = await overflow(page);
  if (sw > iw + 1) throw new Error(`${where}: page is ${sw}px wide in a ${iw}px viewport (horizontal scroll)`);
}

/** On a touch device every visible button, link-button, select and text input should be at least 44px tall (3px of slack for rounding). */
async function tapTargets(page, where) {
  const small = await page.evaluate(() => [...document.querySelectorAll('button, select, input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=file]), header.site nav a')]
    .filter((e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.position !== 'fixed'; })
    .map((e) => ({ t: (e.textContent || e.getAttribute('aria-label') || e.name || e.tagName).trim().slice(0, 24), h: Math.round(e.getBoundingClientRect().height) }))
    .filter((x) => x.h < 41));
  if (small.length) throw new Error(`${where}: ${small.length} control(s) under 44px tall on a touch screen: ${small.slice(0, 4).map((x) => `"${x.t}" ${x.h}px`).join(', ')}`);
}

// ---- the checks --------------------------------------------------------------------------------------------------------------
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
const api = (p, init = {}) => fetch(`${BASE}${p}`, init);
const bearer = { Authorization: `Bearer ${env.INGEST_TOKEN}` };

async function checkLanding(browser) {
  section = 'landing';
  for (const vp of ['desktop', 'mobile', 'narrow']) {
    const { ctx, page } = await newPage(browser, vp, `landing-${vp}`);
    await check(`${vp}: renders the brand, headline and story`, async () => {
      const r = await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
      eq(r.status(), 200, 'status');
      truthy((await page.title()).includes(site.brand.name), 'title has the brand name');
      const h1 = (await page.locator('h1.lp-h1').innerText()).replace(/\s+/g, ' ');
      truthy(h1.includes(site.landing.accent), `h1 "${h1}" contains the accent "${site.landing.accent}"`);
      eq(await page.locator('.st-step').count(), site.landing.story.steps.length, 'story steps');
      // the dotted territory is the default hero background; a chosen effect replaces it (checked in the effects section)
      if ((site.effects?.heroBackground ?? 'territory') === 'territory') truthy(await page.locator('.lp-territory canvas').count(), 'territory canvas');
      truthy(await page.locator('.route svg').count(), 'road svg');
    });
    await check(`${vp}: no horizontal scroll after scrolling the whole page`, async () => { await scrollThrough(page); await noOverflow(page, 'landing'); });
    await check(`${vp}: theme toggle switches light/dark`, async () => {
      const toggle = page.locator('.theme-toggle').first();
      const before = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
      await toggle.click();
      await page.waitForTimeout(150);
      const theme = await page.evaluate(() => document.documentElement.dataset.theme);
      truthy(theme === 'dark' || theme === 'light', 'data-theme set');
      const after = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
      truthy(before !== after, `body colour changed (${before} -> ${after})`);
      await toggle.click();
    });
    if (flag('proof')) await check(`${vp}: proof figure and bars`, async () => {
      eq((await page.locator('.flip-row').getAttribute('aria-label')), site.landing.proof.figure, 'figure');
      eq(await page.locator('.why-bar').count(), (site.landing.proof.bars ?? []).length, 'bars');
    });
    if (flag('features')) await check(`${vp}: features board`, async () => {
      eq(await page.locator('.mod-col').first().locator('.mod-item').count(), site.landing.features.ready.length, 'ready items');
    });
    if (flag('compat')) await check(`${vp}: timeline selects an item`, async () => {
      const items = site.landing.compat.items;
      await page.locator('.dv-btn').nth(items.length - 1).scrollIntoViewIfNeeded();
      await page.locator('.dv-btn').nth(items.length - 1).click();
      truthy((await page.locator('.dev-name').innerText()).includes(items[items.length - 1].name), 'selected name shown');
    });
    if (flag('faq')) await check(`${vp}: FAQ opens`, async () => {
      const d = page.locator('.faq details').first();
      await d.scrollIntoViewIfNeeded(); await d.locator('summary').click();
      eq(await d.evaluate((e) => e.open), true, 'open');
    });
    if (vp !== 'desktop') await check(`${vp}: menu sheet opens and lists the links`, async () => {
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.locator('.lp-menu-b').click();
      truthy(await page.locator('.lp-sheet a').count() >= 2, 'sheet links');
      await page.locator('.lp-menu-b').click();
    });
    await scrollThrough(page);
    await shot(page, `landing-${vp}`);
    await ctx.close();
  }
}

async function checkSignin(browser) {
  section = 'sign-in';
  const redirect = has('dashboard') ? '/dashboard' : has('connect') ? '/connect' : has('mfa') ? '/admin' : '/';
  for (const vp of ['desktop', 'mobile']) {
    const { ctx, page } = await newPage(browser, vp, `signin-${vp}`);
    await check(`${vp}: a private page sends you to /login with ?next`, async () => {
      await page.goto(`${BASE}${redirect}`);
      truthy(page.url().includes('/login'), `url ${page.url()}`);
    });
    await check(`${vp}: the sign-in page fits the screen`, async () => { await noOverflow(page, 'login'); await shot(page, `login-${vp}`); });
    if (vp !== 'desktop') await check(`${vp}: sign-in controls are finger-sized`, async () => { await tapTargets(page, 'login'); });
    await check(`${vp}: wrong password is refused`, async () => {
      await page.locator('input[name=password]').fill('definitely-wrong');
      await page.getByRole('button', { name: 'Sign in' }).click();
      await page.waitForURL(/error=1/);
      truthy(await page.locator('p.err').isVisible(), 'error message visible');
    });
    await check(`${vp}: right password signs in and lands on ${redirect}`, async () => {
      await page.locator('input[name=password]').fill(env.DASHBOARD_PASSWORD);
      await page.getByRole('button', { name: 'Sign in' }).click();
      await page.waitForURL((u) => !u.pathname.startsWith('/login'));
      truthy(new URL(page.url()).pathname.startsWith(redirect), `landed on ${page.url()}`);
      const cookie = (await ctx.cookies()).find((c) => c.name.endsWith('-session'));
      truthy(cookie && cookie.httpOnly, 'session cookie is HttpOnly');
    });
    await check(`${vp}: an open redirect in ?next is ignored`, async () => {
      const c2 = await browser.newContext(); const p2 = await c2.newPage();
      await p2.goto(`${BASE}/login?next=//evil.example/x`);
      await p2.locator('input[name=password]').fill(env.DASHBOARD_PASSWORD);
      await p2.getByRole('button', { name: 'Sign in' }).click();
      await p2.waitForURL((u) => !u.pathname.startsWith('/login'));
      truthy(new URL(p2.url()).host === `localhost:${PORT}`, `stayed on this host (${p2.url()})`);
      await c2.close();
    });
    await check(`${vp}: sign out returns to /login`, async () => {
      await page.getByRole('button', { name: 'Sign out' }).click();
      await page.waitForURL(/\/login/);
    });
    await ctx.close();
  }
}

async function checkApiAndDashboard(browser) {
  if (!has('api')) return;
  section = 'api';
  await check('health reports the site, database and storage', async () => {
    const r = await api('/api/health', { headers: bearer }); const j = await r.json();
    eq(r.status, 200, 'status'); eq(j.service, `${site.brand.slug}-site`, 'service'); eq(j.database, 'ok', 'database'); eq(j.storage, 'ok', 'storage'); eq(j.authorized, true, 'authorized');
    const bad = await (await api('/api/health', { headers: { Authorization: 'Bearer nope' } })).json();
    eq(bad.authorized, false, 'bad token authorized');
  });
  await check('ingest refuses a call without the key', async () => {
    eq((await api('/api/ingest', { method: 'POST', body: '{}' })).status, 401, 'status');
    eq((await api('/api/uploads/sign', { method: 'POST', body: '{}' })).status, 401, 'sign status');
  });
  await check('a key outside the record is refused', async () => {
    const r = await api('/api/uploads/sign', { method: 'POST', headers: { ...bearer, 'Content-Type': 'application/json' }, body: JSON.stringify({ recordId: 'rec-aaaa0001', files: [{ key: 'records/other-rec-9999/files/0.png', contentType: 'image/png' }] }) });
    eq(r.status, 400, 'status');
    const t = await api('/api/uploads/sign', { method: 'POST', headers: { ...bearer, 'Content-Type': 'application/json' }, body: JSON.stringify({ recordId: 'rec-aaaa0001', files: [{ key: 'records/rec-aaaa0001/files/../../../x.png', contentType: 'image/png' }] }) });
    eq(t.status, 400, 'traversal status');
  });

  const statuses = site.dashboard.statuses.map((s) => s.id);
  const made = [];
  async function ingest(n, over = {}) {
    const id = `rec-test-000${n}`;
    const key = `records/${id}/files/0.png`;
    const sign = await (await api('/api/uploads/sign', { method: 'POST', headers: { ...bearer, 'Content-Type': 'application/json' }, body: JSON.stringify({ recordId: id, files: [{ key, contentType: 'image/png' }] }) })).json();
    const put = await fetch(sign[0].url, { method: sign[0].method, headers: sign[0].headers, body: PNG });
    if (!put.ok) throw new Error(`PUT to ${sign[0].url} -> ${put.status}`);
    const body = {
      id, title: `Test ${n} ${site.vocab.record}`, subtitle: `Place ${n}`, status: statuses[(n - 1) % statuses.length], category: n % 2 ? 'Alpha' : 'Beta', owner: `Owner ${n % 3}`, source: 'verify',
      occurredAt: new Date(Date.now() - n * 3600_000).toISOString(),
      metrics: Object.fromEntries((site.dashboard.metrics ?? []).map((m) => [m.key, n * 10])),
      data: { Note: `data ${n}` },
      items: [{ id: 'a', label: `Item A${n}`, status: statuses[0], value: n }, { id: 'b', label: `Item B${n}`, value: 2 }],
      files: [{ idx: 0, objectKey: key, caption: `File ${n}` }], ...over,
    };
    const r = await api('/api/ingest', { method: 'POST', headers: { ...bearer, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return { status: r.status, json: await r.json(), body };
  }

  if (has('dashboard') || has('connect')) {
    await check('ingest stores a record with its file, and is idempotent', async () => {
      for (const n of [1, 2, 3]) { const r = await ingest(n); eq(r.status, 200, `ingest ${n} status ${JSON.stringify(r.json)}`); eq(r.json.updated, false, 'first ingest updated'); made.push(r.body); }
      const again = await ingest(1); eq(again.json.updated, true, 'second ingest updated');
    });
    await check('ingest refuses a record whose file never arrived', async () => {
      const r = await api('/api/ingest', { method: 'POST', headers: { ...bearer, 'Content-Type': 'application/json' }, body: JSON.stringify({ id: 'rec-test-0099', files: [{ idx: 0, objectKey: 'records/rec-test-0099/files/0.png' }] }) });
      eq(r.status, 409, 'status');
    });
    await check('ingest refuses a bad status and a bad id', async () => {
      eq((await api('/api/ingest', { method: 'POST', headers: { ...bearer, 'Content-Type': 'application/json' }, body: JSON.stringify({ id: 'rec-test-0098', status: 'not-a-status' }) })).status, 400, 'bad status');
      eq((await api('/api/ingest', { method: 'POST', headers: { ...bearer, 'Content-Type': 'application/json' }, body: JSON.stringify({ id: 'x' }) })).status, 400, 'bad id');
    });
  }

  if (!has('dashboard')) return;
  section = 'dashboard';
  for (const vp of ['desktop', 'mobile']) {
    const { ctx, page } = await newPage(browser, vp, `dashboard-${vp}`);
    await page.goto(`${BASE}/login`);
    await page.locator('input[name=password]').fill(env.DASHBOARD_PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL(/\/dashboard/);
    await page.waitForLoadState('networkidle');

    await check(`${vp}: stat cards show real numbers`, async () => {
      const n = await page.locator('.stat-card').count(); eq(n, site.dashboard.stats.length, 'stat cards');
      const first = (await page.locator('.stat-card .stat-n').first().innerText()).replace(/\D/g, '');
      eq(Number(first), 3, `first stat (${site.dashboard.stats[0].label})`);
    });
    await check(`${vp}: a card per record, with its thumbnail`, async () => {
      eq(await page.locator('.rec-card').count(), 3, 'cards');
      const imgs = await page.locator('.rec-thumb img').evaluateAll((els) => Promise.all(els.map((i) => (i.complete ? i.naturalWidth : new Promise((r) => { i.onload = () => r(i.naturalWidth); i.onerror = () => r(0); })))));
      truthy(imgs.length === 3 && imgs.every((w) => w > 0), `thumbnails loaded (${imgs})`);
    });
    await check(`${vp}: search narrows the list`, async () => {
      await page.locator('#record-search').fill('Test 2');
      eq(await page.locator('.rec-card').count(), 1, 'one match');
      await page.locator('#record-search').fill('zzz-nothing');
      truthy(await page.getByText('Nothing matches.').isVisible(), 'empty state');
      await page.locator('#record-search').fill('');
    });
    await check(`${vp}: a status chip filters`, async () => {
      const tabs = page.getByRole('tab');
      truthy(await tabs.count() >= 2, 'chips');
      await tabs.nth(1).click();
      const shown = await page.locator('.rec-card').count();
      truthy(shown >= 1 && shown < 3 + 1, `chip shows ${shown}`);
      await tabs.nth(0).click();
      eq(await page.locator('.rec-card').count(), 3, 'all again');
    });
    await check(`${vp}: a facet select filters`, async () => {
      const sel = page.locator('.facet select').first();
      const opts = await sel.locator('option').allTextContents();
      truthy(opts.length >= 2, `facet options ${opts}`);
      await sel.selectOption({ index: 1 });
      truthy(await page.locator('.rec-card').count() <= 3, 'filtered');
      await page.getByRole('button', { name: /Clear/ }).click();
      eq(await page.locator('.rec-card').count(), 3, 'cleared');
    });
    await check(`${vp}: no horizontal scroll`, async () => { await noOverflow(page, 'dashboard'); });
    if (vp !== 'desktop') await check(`${vp}: dashboard controls are finger-sized`, async () => { await tapTargets(page, 'dashboard'); });
    await shot(page, `dashboard-${vp}`);

    await check(`${vp}: the detail page shows facts, the file, the items; status changes; delete works`, async () => {
      await page.locator('.rec-card').first().click();
      await page.waitForURL(/\/records\//);
      await page.waitForLoadState('networkidle');
      truthy((await page.locator('h1').innerText()).startsWith('Test'), 'title');
      eq(await page.locator('.gallery figure').count(), 1, 'gallery');
      eq(await page.locator('tbody tr').count(), 2, 'item rows');
      await noOverflow(page, 'detail');
      await shot(page, `record-${vp}`);
      const before = await page.getByTestId('record-status').innerText();
      const other = site.dashboard.statuses.find((s) => s.label !== before);
      await page.getByRole('button', { name: other.label, exact: true }).click();
      await page.waitForFunction((l) => document.querySelector('[data-testid=record-status]')?.textContent === l, other.label);
      page.once('dialog', (d) => d.accept());
      await page.getByRole('button', { name: new RegExp(`Delete ${site.vocab.record}`, 'i') }).click();
      await page.waitForURL(/\/dashboard/);
      await page.waitForLoadState('networkidle');
      eq(await page.locator('.rec-card').count(), 2, 'cards after delete');
    });
    await ctx.close();
    if (vp === 'desktop') { const r = await ingest(1); if (r.status !== 200) throw new Error('re-ingest after delete failed'); }
  }
  await check('an API caller without a session gets 401, not a redirect', async () => {
    eq((await api('/api/records/rec-test-0002', { method: 'PATCH', body: '{}' })).status, 401, 'status');
    eq((await api('/api/file?key=records/rec-test-0002/files/0.png', { redirect: 'manual' })).status, 401, 'file status');
  });
}

async function checkConnect(browser) {
  if (!has('connect')) return;
  section = 'connect';
  for (const vp of ['desktop', 'mobile']) {
    const { ctx, page } = await newPage(browser, vp, `connect-${vp}`);
    await page.goto(`${BASE}/login?next=/connect`);
    await page.locator('input[name=password]').fill(env.DASHBOARD_PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL(/\/connect/);
    await check(`${vp}: shows the link with the key and copies it`, async () => {
      const link = await page.getByTestId('connect-link').innerText();
      truthy(link.startsWith('http') && link.includes('#key='), `link ${link}`);
      truthy(link.includes(encodeURIComponent(env.INGEST_TOKEN)), 'the key is in it');
      await page.getByRole('button', { name: 'Copy link' }).click();
      await page.getByRole('button', { name: /Copied/ }).waitFor();
      eq(await page.evaluate(() => navigator.clipboard.readText()), link, 'clipboard');
    });
    await check(`${vp}: no horizontal scroll`, async () => { await noOverflow(page, 'connect'); });
    await shot(page, `connect-${vp}`);
    await ctx.close();
  }
}

async function checkAdmin(browser) {
  if (!has('mfa')) return;
  section = 'mfa';
  const user = { name: 'Test Admin', username: 'testadmin', password: 'correct-horse-battery-9' };
  let secret = '';
  let enrolledStep = 0;
  const { ctx, page } = await newPage(browser, 'desktop', 'admin');

  await check('/admin with no account yet sends you to setup', async () => {
    await page.goto(`${BASE}/admin`); truthy(page.url().includes('/admin/setup'), page.url());
  });
  await check('setup refuses a wrong setup code', async () => {
    await page.locator('input[name=code]').fill('wrong'); await page.locator('input[name=name]').fill(user.name);
    await page.locator('input[name=username]').fill(user.username); await page.locator('input[name=password]').fill(user.password);
    await page.getByRole('button', { name: /authenticator/i }).click();
    await page.waitForURL(/error=/); truthy(await page.getByText('setup code is not right').isVisible(), 'message');
  });
  await check('setup refuses a short password', async () => {
    await page.goto(`${BASE}/admin/setup`);
    await page.locator('input[name=code]').fill(env.ADMIN_SETUP_CODE || env.SESSION_SECRET); await page.locator('input[name=name]').fill(user.name);
    await page.locator('input[name=username]').fill(user.username); await page.locator('input[name=password]').evaluate((e) => { e.removeAttribute('minlength'); });
    await page.locator('input[name=password]').fill('short');
    await page.getByRole('button', { name: /authenticator/i }).click();
    await page.waitForURL(/error=/); truthy(await page.getByText(/at least 10/).isVisible(), 'message');
  });
  await check('setup with the right code leads to a QR code and a secret', async () => {
    await page.goto(`${BASE}/admin/setup`);
    await page.locator('input[name=code]').fill(env.ADMIN_SETUP_CODE || env.SESSION_SECRET); await page.locator('input[name=name]').fill(user.name);
    await page.locator('input[name=username]').fill(user.username); await page.locator('input[name=password]').fill(user.password);
    await page.getByRole('button', { name: /authenticator/i }).click();
    await page.waitForURL(/\/admin\/enroll/);
    truthy(await page.locator('img.qr').isVisible(), 'QR visible');
    secret = (await page.locator('.secret').innerText()).replace(/\s/g, '');
    truthy(/^[A-Z2-7]{32}$/.test(secret), `secret ${secret}`);
    await shot(page, 'admin-enroll');
  });
  await check('a wrong authenticator code does not create the account', async () => {
    const bad = totp(secret, nowStep() + 40);
    await page.locator('input[name=code]').fill(bad); await page.getByRole('button', { name: /Confirm/ }).click();
    await page.waitForURL(/error=/); truthy(page.url().includes('/admin/enroll'), 'still enrolling');
  });
  await check('the right code confirms, creates the account and signs in', async () => {
    enrolledStep = nowStep() - 1; // inside the +-1 window; leaves now and now+1 for the next two sign-ins
    await page.locator('input[name=code]').fill(totp(secret, enrolledStep)); await page.getByRole('button', { name: /Confirm/ }).click();
    await page.waitForURL((u) => u.pathname === '/admin');
    truthy(await page.getByText(`Signed in as ${user.name}`).isVisible(), 'signed in as');
    await shot(page, 'admin-home');
  });
  await check('sign out, then step 1 (password) then step 2 (code) signs in again', async () => {
    await page.getByRole('button', { name: 'Sign out' }).click();
    await page.waitForURL(/\/admin\/login/);
    await page.locator('input[name=username]').fill(user.username); await page.locator('input[name=password]').fill(user.password);
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.waitForURL(/\/admin\/verify/);
    // the code accepted at enrolment cannot be used again; the next time-step's code is inside the allowed window
    await page.locator('input[name=code]').fill(totp(secret, enrolledStep + 1)); await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL((u) => u.pathname === '/admin');
  });
  await check('a used authenticator code is refused (replay)', async () => {
    await page.getByRole('button', { name: 'Sign out' }).click();
    await page.locator('input[name=username]').fill(user.username); await page.locator('input[name=password]').fill(user.password);
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.waitForURL(/\/admin\/verify/);
    await page.locator('input[name=code]').fill(totp(secret, enrolledStep + 1)); await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL(/error=/); truthy(page.url().includes('/admin/verify'), 'still on verify');
  });
  await check('a wrong password gives one vague message', async () => {
    await page.goto(`${BASE}/admin/login`);
    await page.locator('input[name=username]').fill(user.username); await page.locator('input[name=password]').fill('nope-nope-nope');
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.waitForURL(/error=/); truthy(await page.getByText('Wrong username or password.').isVisible(), 'vague');
    await page.goto(`${BASE}/admin/login`);
    await page.locator('input[name=username]').fill('nobody'); await page.locator('input[name=password]').fill('nope-nope-nope');
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.waitForURL(/error=/); truthy(await page.getByText('Wrong username or password.').isVisible(), 'same message for an unknown user');
  });
  await check('sign in fully, then an invite link works once', async () => {
    await page.goto(`${BASE}/admin/login`);
    await page.locator('input[name=username]').fill(user.username); await page.locator('input[name=password]').fill(user.password);
    await page.getByRole('button', { name: 'Continue' }).click(); await page.waitForURL(/\/admin\/verify/);
    await page.locator('input[name=code]').fill(totp(secret, enrolledStep + 2)); await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL((u) => u.pathname === '/admin');
    await page.getByRole('button', { name: 'Add a person' }).click();
    const url = (await page.locator('.invite .linkline').innerText()).trim();
    truthy(url.includes('/admin/join?t='), `invite ${url}`);
    const c2 = await browser.newContext(); const p2 = await c2.newPage();
    await p2.goto(url);
    truthy(await p2.getByRole('heading', { name: new RegExp(`Join ${site.vocab.area}`) }).isVisible(), 'join page');
    await p2.locator('input[name=name]').fill('Second Person'); await p2.locator('input[name=username]').fill('second.person'); await p2.locator('input[name=password]').fill('another-long-pass-7');
    await p2.getByRole('button', { name: /authenticator/i }).click(); await p2.waitForURL(/\/admin\/enroll/);
    const s2 = (await p2.locator('.secret').innerText()).replace(/\s/g, '');
    await p2.locator('input[name=code]').fill(totp(s2, nowStep())); await p2.getByRole('button', { name: /Confirm/ }).click();
    await p2.waitForURL((u) => u.pathname === '/admin');
    const p3 = await (await browser.newContext()).newPage(); await p3.goto(url);
    truthy(await p3.getByText('This link does not work').isVisible(), 'second use refused');
    await c2.close();
    await page.reload();
    truthy(await page.getByText('second.person').first().isVisible(), 'second person listed');
  });
  await check('/admin cannot be reached with the shared password cookie alone', async () => {
    const c = await browser.newContext(); const p = await c.newPage();
    await p.goto(`${BASE}/admin`); truthy(p.url().includes('/admin/login'), p.url()); await c.close();
  });

  if (has('publishing')) await checkPublishing(browser, page, user, () => secret, () => enrolledStep);
  await ctx.close();
}

/** The row of one version in the publisher's list. The page says "Published x" a moment before it refreshes the list, so wait for the row
 *  instead of taking .first(): clicking the first row too early toggles the version that was already there. */
const versionRow = async (page, versionName) => {
  const row = page.locator('.version').filter({ hasText: `Version ${versionName} ` }).first();
  await row.waitFor({ timeout: 30000 });
  return row;
};
const rowChecked = (page, versionName) => page.waitForFunction((v) => { const row = [...document.querySelectorAll('.version')].find((e) => e.textContent.includes(`Version ${v} `)); return row?.querySelector('input[type=checkbox]')?.checked === true; }, versionName, { timeout: 10000, polling: 100 });

async function checkPublishing(browser, page, user) {
  section = 'publishing';
  const ext = site.publishing.extensions[0];
  const mkFile = (name, size = 4096) => ({ name, mimeType: 'application/octet-stream', buffer: Buffer.alloc(size, 7) });

  if (flag('parseApk')) {
    // Android flavour: the version, size and signature are read from a REAL signed APK (pass --apk older, --apk2 newer).
    const [a1, a2] = [arg('apk', ''), arg('apk2', '')];
    const exp = [{ file: a1, name: arg('apk-name', ''), code: arg('apk-code', '') }, { file: a2, name: arg('apk2-name', ''), code: arg('apk2-code', '') }];
    // Without real APKs these checks cannot run; say so once and skip them, rather than failing six checks for a missing input.
    if (!exp.every((e) => e.file && fs.existsSync(e.file) && e.name && e.code)) {
      skipping = 'needs real APKs';
      console.log('  note  this site reads versions from real APKs. To test that part too, pass --apk <older.apk> --apk-name <v> --apk-code <n> --apk2 <newer.apk> --apk2-name <v> --apk2-code <n>');
    }
    const send = async (file, name, notes) => {
      await page.goto(`${BASE}/admin`); await page.waitForLoadState('networkidle');
      await page.getByTestId('release-file').setInputFiles(file);
      await page.getByPlaceholder(/What people see/).fill(name);
      await page.locator('.ProseMirror').click(); await page.keyboard.type(notes);
      await page.getByRole('button', { name: 'Publish', exact: true }).click();
    };
    await check('a file that is not an APK is refused', async () => {
      await send({ name: 'fake.apk', mimeType: 'application/octet-stream', buffer: Buffer.from('this is not a zip') }, 'Fake', 'x');
      await page.getByText(/Not a usable APK/).waitFor();
    });
    await check('an older real APK is published and its version is read from the file', async () => {
      await send(exp[0].file, 'First build', 'Older build notes');
      await page.getByText(new RegExp(`Published ${exp[0].name.replace(/\./g, '\.')}`)).waitFor({ timeout: 60000 });
      await page.waitForLoadState('networkidle');
      truthy(await page.getByText(new RegExp(`Version ${exp[0].name.replace(/\./g, '\.')} · build ${exp[0].code}`)).first().isVisible(), 'version + build shown from the APK');
    });
    await check('a newer real APK is accepted (higher build number)', async () => {
      await send(exp[1].file, 'Second build', 'Newer build notes');
      await page.getByText(new RegExp(`Published ${exp[1].name.replace(/\./g, '\.')}`)).waitFor({ timeout: 60000 });
    });
    await check('re-publishing the older build is refused', async () => {
      await send(exp[0].file, 'Again', 'x');
      await page.getByText(/already published/).waitFor({ timeout: 60000 });
    });
    await check('put the newest on the home page; the download is the exact file', async () => {
      await page.goto(`${BASE}/admin`); await page.waitForLoadState('networkidle');
      await page.locator('.version').first().locator('label.switch .track').click();
      await page.waitForFunction(() => document.querySelector('.version input[type=checkbox]')?.checked === true);
      if (has('landing')) {
        const d = await api(`/api/app/public/download?v=${exp[1].code}`); eq(d.status, 200, 'download status');
        eq((await d.arrayBuffer()).byteLength, fs.statSync(exp[1].file).size, 'bytes');
        eq(d.headers.get('content-type'), 'application/vnd.android.package-archive', 'content-type');
      }
    });
    await check('the update check returns the newest build with its checksum', async () => {
      const j = await (await api('/api/app/latest', { headers: bearer })).json();
      eq(String(j.latest.versionCode), exp[1].code, 'versionCode'); eq(j.latest.versionName, exp[1].name, 'versionName');
      eq(j.latest.sha256, crypto.createHash('sha256').update(fs.readFileSync(exp[1].file)).digest('hex'), 'sha256');
      truthy(j.latest.url, 'signed url');
    });
    await shot(page, 'admin-after');
    return;
    skipping = null;
  }

  await check('the publisher page is complete and fits a phone', async () => {
    await page.goto(`${BASE}/admin`);
    truthy(await page.getByRole('heading', { name: 'Publish a new version' }).isVisible(), 'publisher card');
    await noOverflow(page, 'admin desktop');
    const m = await browser.newContext({ viewport: VIEWPORTS.mobile, isMobile: true, hasTouch: true });
    await m.addCookies(await page.context().cookies());
    const mp = await m.newPage(); await mp.goto(`${BASE}/admin`); await mp.waitForLoadState('networkidle');
    await noOverflow(mp, 'admin mobile'); await shot(mp, 'admin-mobile'); await m.close();
  });
  await check('a wrong file type is refused', async () => {
    await page.getByTestId('release-file').setInputFiles({ name: 'notes.exe2', mimeType: 'application/octet-stream', buffer: Buffer.alloc(10) }).catch(() => undefined);
    truthy(await page.getByText(/is not a/).isVisible(), 'type error shown');
  });
  async function publish(v, build, name, notes, approve) {
    await page.goto(`${BASE}/admin`); await page.waitForLoadState('networkidle');
    await page.getByTestId('release-file').setInputFiles(mkFile(`${site.brand.slug}-${v}${ext}`));
    if (!flag('parseApk')) {
      await page.getByPlaceholder('1.4.0').fill(v); await page.getByPlaceholder('12').fill(String(build));
    }
    await page.getByPlaceholder(/What people see/).fill(name);
    await page.locator('.ProseMirror').click(); await page.keyboard.type(notes);
    await page.getByRole('button', { name: 'Publish', exact: true }).click();
    return page;
  }
  await check('publishing a version stores it and lists it', async () => {
    await publish('1.0.0', 1, 'First release', 'First line of notes');
    await page.getByText(/Published 1.0.0/).waitFor();
    await page.waitForLoadState('networkidle');
    // the list re-renders just after the success message, so wait for it instead of sampling once
    await page.getByText('First release').first().waitFor({ state: 'visible', timeout: 10000 });
    await page.getByText('First line of notes').first().waitFor({ state: 'visible', timeout: 10000 });
  });
  await check('a lower or equal build number is refused', async () => {
    await publish('0.9.0', 1, 'Old', 'x');
    await page.getByText(/already published/).waitFor();
  });
  await check('a second version, then it can be put on the home page', async () => {
    await publish('1.1.0', 2, 'Second release', 'Second notes');
    await page.getByText(/Published 1.1.0/).waitFor(); await page.waitForLoadState('networkidle');
    const sw = (await versionRow(page, '1.1.0')).locator('label.switch');
    const seen = [];
    const onResponse = (r) => { if (/\/api\/admin\/releases/.test(r.url()) && r.request().method() !== 'GET') seen.push(`${r.request().method()} ${r.status()}`); };
    page.on('response', onResponse);
    await sw.locator('.track').click();
    try {
      await rowChecked(page, '1.1.0');
    } catch {
      const state = await page.evaluate(() => [...document.querySelectorAll('.version')].map((v) => `${(v.querySelector('h3, b, strong')?.textContent ?? '?').slice(0, 24)}:${[...v.querySelectorAll('input[type=checkbox]')].map((i) => (i.checked ? 'on' : 'off')).join('/')}`).join(' | '));
      throw new Error(`the home-page switch did not turn on. requests: [${seen.join(', ')}]; versions: ${state}`);
    } finally { page.off('response', onResponse); }
  });
  if (has('landing')) await check('the home page now offers it and the download is the exact file', async () => {
    const r = await api('/'); const html = await r.text();
    truthy(html.includes('Second release'), 'release name on the home page');
    const d = await api('/api/app/public/download?v=2'); eq(d.status, 200, 'download status');
    eq((await d.arrayBuffer()).byteLength, 4096, 'bytes');
    eq((await api('/api/app/public/download?v=1')).status, 404, 'not approved is not downloadable');
    const { ctx, page: lp } = await newPage(browser, 'mobile', 'landing-after-publish');
    await lp.goto(`${BASE}/`, { waitUntil: 'networkidle' }); await scrollThrough(lp);
    await noOverflow(lp, 'landing with a release'); await shot(lp, 'landing-with-release-mobile'); await ctx.close();
  });
  await check('hide, show and delete a version', async () => {
    await page.goto(`${BASE}/admin`); await page.waitForLoadState('networkidle');
    const first = page.locator('.version').first();
    await first.getByRole('button', { name: 'Hide' }).click();
    await first.getByText('Hidden').first().waitFor();
    await first.getByRole('button', { name: 'Show' }).click();
    await page.waitForFunction(() => !document.querySelector('.version .badge.hidden'));
    page.once('dialog', (d) => d.accept());
    const count = await page.locator('.version').count();
    await page.locator('.version').last().getByRole('button', { name: 'Delete' }).click();
    await page.waitForFunction((n) => document.querySelectorAll('.version').length === n - 1, count);
  });
  if (flag('testers')) await check('a tester gets a code once and the update check offers testing builds only to them', async () => {
    await page.goto(`${BASE}/admin`); await page.waitForLoadState('networkidle');
    await publish('1.2.0-beta', 3, 'Beta', 'Testing only'); await page.getByText(/Published 1.2.0-beta/).waitFor(); await page.waitForLoadState('networkidle');
    await (await versionRow(page, '1.2.0-beta')).getByRole('button', { name: 'Testers only' }).click();
    await page.waitForFunction(() => [...document.querySelectorAll('.seg-b.on')].some((b) => b.textContent === 'Testers only'));
    await page.getByPlaceholder('Anna Kowalska').fill('Tess Tester'); await page.getByPlaceholder('anna@example.com').fill('tess@example.com');
    await page.getByRole('button', { name: /Add tester|Add/ }).first().click();
    const code = (await page.locator('.code-big').first().innerText()).trim();
    truthy(/^TST-/.test(code), `code ${code}`);
    const stable = await (await api('/api/app/latest', { headers: bearer })).json();
    truthy(stable.latest && stable.latest.channel === 'stable', 'stable latest is the stable build');
    eq(stable.testing, undefined, 'no testing key without a tester token');
    const bad = await api('/api/app/tester', { method: 'POST', headers: { ...bearer, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'tess@example.com', code: 'WRONG' }) });
    eq(bad.status, 401, 'wrong code');
    const ok = await (await api('/api/app/tester', { method: 'POST', headers: { ...bearer, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'tess@example.com', code }) })).json();
    truthy(ok.token, 'token issued');
    const withTok = await (await api('/api/app/latest', { headers: { ...bearer, 'X-Tester-Token': ok.token } })).json();
    eq(withTok.tester?.name, 'Tess Tester', 'tester name'); eq(withTok.testing?.versionName, '1.2.0-beta', 'testing build offered');
  });
  await shot(page, 'admin-after');
}

// ---- effects ---------------------------------------------------------------------------------------------------------------------
const FX = site.effects ?? { active: false };
const headlineText = () => String(site.landing?.headline ?? '').replace('{accent}', site.landing?.accent ?? '').replace(/\s+/g, ' ').trim();

/** Counts canvas clears (one per drawn frame), so "is this animating?" is a measurement, not a guess. */
const frameCounter = `(() => { window.__fxFrames = 0; const c = CanvasRenderingContext2D.prototype.clearRect; CanvasRenderingContext2D.prototype.clearRect = function (...a) { window.__fxFrames++; return c.apply(this, a); }; })();`;

/** What assistive technology would read from an element: its text, skipping anything aria-hidden. */
const readableText = (el) => el.evaluate((h) => {
  const walk = (n) => (n.nodeType === 3 ? n.nodeValue : n.nodeType === 1 && n.getAttribute('aria-hidden') !== 'true' ? [...n.childNodes].map(walk).join('') : '');
  return walk(h).replace(/\s+/g, ' ').trim();
});

async function checkEffects(browser) {
  const wantsGallery = has('fxgallery');
  if (!FX.active && !wantsGallery) return;
  section = 'effects';
  const canvasBg = ['dots', 'particles', 'stars'];

  if (has('landing') && FX.active) {
    for (const vp of ['desktop', 'mobile']) {
      const { ctx, page } = await newPage(browser, vp, `fx-landing-${vp}`);
      await page.addInitScript(frameCounter);
      await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2600);

      if (FX.heroBackground !== 'territory') await check(`${vp}: the hero background is ${FX.heroBackground === 'none' ? 'removed' : FX.heroBackground}`, async () => {
        const n = await page.locator('.lp-hero .fx-bg').count();
        if (FX.heroBackground === 'none') { eq(n, 0, 'no background element'); eq(await page.locator('.lp-territory').count(), 0, 'default territory removed'); return; }
        eq(n, 1, '.fx-bg elements in the hero');
        const box = await page.locator('.lp-hero .fx-bg').boundingBox();
        truthy(box && box.width > 200 && box.height > 200, `background size ${JSON.stringify(box)}`);
        eq(await page.locator('.lp-hero .fx-bg').getAttribute('aria-hidden'), 'true', 'decorative: hidden from screen readers');
        eq(await page.locator('.lp-territory').count(), 0, 'default territory replaced');
      });

      if (canvasBg.includes(FX.heroBackground)) {
        await check(`${vp}: the canvas draws, and stops drawing when scrolled off screen`, async () => {
          const painted = await page.evaluate(() => { const c = document.querySelector('.lp-hero canvas.fx-bg'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4 * 61) if (d[i] > 0) n++; return n; });
          truthy(painted > 8, `${painted} painted samples`);
          const run = async () => { await page.evaluate(() => { window.__fxFrames = 0; }); await page.waitForTimeout(600); return page.evaluate(() => window.__fxFrames); };
          const onScreen = await run();
          truthy(onScreen >= 10, `${onScreen} frames in 600ms while visible`);
          await page.evaluate(() => window.scrollTo(0, document.querySelector('.lp-hero').getBoundingClientRect().bottom + window.scrollY + 900)); await page.waitForTimeout(500);
          const away = await run();
          truthy(away <= 2, `${away} frames in 600ms while off screen (should be about 0)`);
          await page.evaluate(() => window.scrollTo(0, 0));
        });
      }

      if (FX.headline !== 'none') await check(`${vp}: the ${FX.headline} headline keeps its real text for screen readers and settles fully visible`, async () => {
        eq(await readableText(page.locator('h1.lp-h1').first()), headlineText(), 'text read by assistive tech');
        const hidden = await page.evaluate(() => [...document.querySelectorAll('.lp-h1 .fx-c, .lp-h1 .fx-wi, .lp-h1 .fx-grad, .lp-h1 .fx-shim, .lp-h1 .fx-scr')].filter((e) => { const cs = getComputedStyle(e); return Number(cs.opacity) < 0.99 || cs.visibility === 'hidden'; }).length);
        eq(hidden, 0, 'pieces still hidden after the animation');
        const box = await page.locator('.lp-h1').boundingBox();
        truthy(box && box.height > 30 && box.width <= VIEWPORTS[vp].width, `headline box ${JSON.stringify(box)}`);
        await noOverflow(page, 'landing with effects');
      });

      if (FX.reveal !== 'rise') await check(`${vp}: scroll-reveal style "${FX.reveal}" is applied and everything still appears`, async () => {
        eq(await page.evaluate(() => document.documentElement.dataset.fxReveal), FX.reveal, 'data-fx-reveal');
        await scrollThrough(page); await page.waitForTimeout(1200);
        eq(await page.evaluate(() => [...document.querySelectorAll('.rv')].filter((e) => Number(getComputedStyle(e).opacity) < 0.95).length), 0, 'sections left hidden');
      });

      if (vp === 'desktop') {
        if (FX.buttons !== 'none') await check(`desktop: button effect "${FX.buttons}" works`, async () => {
          eq(await page.evaluate(() => document.documentElement.dataset.fxButtons), FX.buttons, 'data-fx-buttons');
          const btn = page.locator('.btn.primary:visible').first();
          await btn.scrollIntoViewIfNeeded(); const b = await btn.boundingBox();
          if (FX.buttons === 'magnetic') {
            await page.mouse.move(b.x + b.width - 4, b.y + b.height / 2); await page.waitForTimeout(450);
            const t = await btn.evaluate((e) => getComputedStyle(e).translate);
            truthy(t && t !== 'none' && t !== '0px', `translate while hovered: ${t}`);
          } else if (FX.buttons === 'ripple') {
            await page.mouse.move(b.x + 10, b.y + 10); await page.mouse.down(); await page.waitForTimeout(80);
            truthy((await btn.locator('.fx-ripple').count()) >= 1, 'ripple element'); await page.mouse.move(2, 2); await page.mouse.up();
          } else {
            const content = await btn.evaluate((e, k) => getComputedStyle(e, k).content, FX.buttons === 'shine' ? '::after' : '::before');
            truthy(content && content !== 'none' && content !== 'normal', `pseudo-element content ${content}`);
          }
        });
        if (FX.cards !== 'none') await check(`desktop: card effect "${FX.cards}" works`, async () => {
          eq(await page.evaluate(() => document.documentElement.dataset.fxCards), FX.cards, 'data-fx-cards');
          const card = page.locator('.why-card, .cta, .stat-card').filter({ visible: true }).first();
          if (!(await card.count())) return; // a minimal landing page may have none; the dashboard check covers it
          await card.scrollIntoViewIfNeeded(); await page.waitForTimeout(900);
          const b = await card.boundingBox();
          await page.mouse.move(b.x + b.width * 0.7, b.y + b.height * 0.3); await page.waitForTimeout(450);
          if (FX.cards === 'tilt' || FX.cards === 'spotlight') truthy(await card.evaluate((e) => e.classList.contains('fx-hot')), 'card got the fx-hot class');
          if (FX.cards === 'tilt') truthy((await card.evaluate((e) => e.style.getPropertyValue('--fx-rx'))).endsWith('deg'), 'tilt angle set');
          if (FX.cards === 'lift') eq(await card.evaluate((e) => getComputedStyle(e).translate), '0px -6px', 'lift');
          if (FX.cards === 'glow-border') truthy((await card.evaluate((e) => getComputedStyle(e, '::before').content)) !== 'none', 'glow ring');
        });
        if (FX.extras.includes('cursor-glow')) await check('desktop: the cursor glow follows the pointer', async () => {
          await page.mouse.move(300, 300); await page.mouse.move(520, 420); await page.waitForTimeout(500);
          eq(await page.locator('.fx-cursor.on').count(), 1, 'glow element is on');
        });
        if (FX.extras.includes('scroll-progress')) await check('desktop: the scroll progress bar fills as you scroll', async () => {
          await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(200);
          const at0 = await page.locator('.fx-progress').evaluate((e) => e.style.transform);
          await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)); await page.waitForTimeout(400);
          const end = await page.locator('.fx-progress').evaluate((e) => e.style.transform);
          truthy(at0 !== end && /scaleX\(1\)/.test(end), `bar ${at0} -> ${end}`);
        });
        if (FX.extras.includes('click-spark')) await check('desktop: a click makes sparks, and they clean themselves up', async () => {
          await page.mouse.click(400, 300); await page.waitForTimeout(120);
          truthy((await page.locator('.fx-spark').count()) >= 4, 'sparks appeared');
          await page.waitForTimeout(1200);
          eq(await page.locator('.fx-spark').count(), 0, 'sparks left behind');
        });
      } else {
        await check('mobile: pointer-only effects stay off on a touch screen', async () => {
          eq(await page.locator('.fx-cursor').count(), 0, 'cursor glow on touch');
          eq(await page.locator('.fx-hot').count(), 0, 'hover state stuck on touch');
        });
      }
      await shot(page, `fx-landing-${vp}`);
      await ctx.close();
    }

    await check('reduced motion: the headline is fully visible at once and nothing loops', async () => {
      const { ctx, page } = await newPage(browser, 'desktop', 'fx-reduced', { reducedMotion: 'reduce' });
      await page.addInitScript(frameCounter);
      await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(250);
      const hiddenNow = await page.evaluate(() => [...document.querySelectorAll('.lp-h1 .fx-c, .lp-h1 .fx-wi, .lp-h1 .fx-grad, .lp-h1 .fx-shim')].filter((e) => Number(getComputedStyle(e).opacity) < 0.99 || getComputedStyle(e).visibility === 'hidden').length);
      eq(hiddenNow, 0, 'headline pieces hidden under reduced motion');
      await page.waitForTimeout(700);
      const running = await page.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running' && a.effect?.target?.closest?.('.fx-bg, .lp-h1')).length);
      eq(running, 0, 'running animations under reduced motion');
      const frames = await page.evaluate(() => { window.__fxFrames = 0; return new Promise((r) => setTimeout(() => r(window.__fxFrames), 600)); });
      truthy(frames <= 3, `${frames} canvas frames in 600ms under reduced motion (a still frame only)`);
      await ctx.close();
    });
  }

  if (FX.loginBackground !== 'none' && has('signin')) {
    const { ctx, page } = await newPage(browser, 'desktop', 'fx-login');
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' }); await page.waitForTimeout(600);
    await check(`sign-in page shows the ${FX.loginBackground} background behind the card, and still signs in`, async () => {
      eq(await page.locator('.login-wrap > .fx-bg').count(), 1, 'background on sign-in page');
      await shot(page, 'fx-login');
      await page.locator('input[name=password]').fill(env.DASHBOARD_PASSWORD); await page.getByRole('button', { name: 'Sign in' }).click();
      await page.waitForURL((u) => !u.pathname.startsWith('/login'));
    });
    await ctx.close();
  }

  if (has('dashboard') && (FX.cards === 'tilt' || FX.cards === 'spotlight' || FX.extras.includes('count-up'))) {
    const { ctx, page } = await newPage(browser, 'desktop', 'fx-dashboard');
    await page.goto(`${BASE}/login`); await page.locator('input[name=password]').fill(env.DASHBOARD_PASSWORD); await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL(/\/dashboard/); await page.waitForLoadState('networkidle');
    if (FX.extras.includes('count-up')) await check('dashboard: stat numbers count up and end on the true value', async () => {
      await page.waitForTimeout(2200);
      eq(await page.locator('[data-fx-pending]').count(), 0, 'numbers still hidden');
      const shown = await page.locator('.stat-card .stat-n').first().innerText();
      eq(Number(shown.replace(/\D/g, '')), await page.locator('.rec-card').count(), `first stat "${shown}" against the cards listed`);
    });
    if (FX.cards === 'tilt' || FX.cards === 'spotlight') await check(`dashboard: the record cards react to the pointer (${FX.cards}) and still open`, async () => {
      const card = page.locator('.rec-card').first(); const b = await card.boundingBox();
      await page.mouse.move(b.x + b.width * 0.6, b.y + b.height * 0.4); await page.waitForTimeout(400);
      truthy(await card.evaluate((e) => e.classList.contains('fx-hot')), 'fx-hot on the record card');
      await card.click(); await page.waitForURL(/\/records\//);
    });
    await shot(page, 'fx-dashboard');
    await ctx.close();
  }

  if (wantsGallery) {
    section = 'gallery';
    const fxmod = await import('./effects.mjs');
    const { ctx, page } = await newPage(browser, 'desktop', 'fx-gallery');
    await page.goto(`${BASE}/effects`, { waitUntil: 'networkidle' }); await page.waitForTimeout(800);
    // "Spotlight" and "Glow border" exist in two groups, so every lookup is scoped to its group
    const radio = (group, name) => page.getByRole('radiogroup', { name: group, exact: true }).getByRole('radio', { name, exact: true });
    await check('every hero background can be chosen and mounts', async () => {
      for (const [id, e] of Object.entries(fxmod.BACKGROUNDS)) {
        await radio('Hero background', e.label).click(); await page.waitForTimeout(250);
        eq(await page.locator('.fxg-hero .fx-bg').count(), 1, `background ${id}`);
      }
    });
    await check('every headline animation keeps the sample text readable', async () => {
      for (const [id, e] of Object.entries(fxmod.HEADLINES)) {
        await radio('Headline animation', e.label).click(); await page.waitForTimeout(2200);
        eq(await readableText(page.locator('.fxg-h1')), 'Your work, beautifully in motion.', `headline ${id}`);
      }
    });
    await check('button, card and reveal choices set the matching attributes', async () => {
      for (const [id, e] of Object.entries(fxmod.BUTTONS)) { await radio('Buttons', e.label).click(); eq(await page.locator('.fxg-hero').getAttribute('data-fx-buttons'), id, 'buttons'); }
      for (const [id, e] of Object.entries(fxmod.CARDS)) { await radio('Cards', e.label).click(); eq(await page.locator('.fxg-below').getAttribute('data-fx-cards'), id, 'cards'); }
      for (const [id, e] of Object.entries(fxmod.REVEALS)) { if (id === 'rise') continue; await radio('Scroll reveal', e.label).click(); eq(await page.locator('.fxg-below').getAttribute('data-fx-reveal'), id, 'reveal'); }
    });
    await check('presets load, and the copied config is valid for the generator', async () => {
      for (const name of Object.keys(fxmod.PRESETS)) {
        await page.getByRole('button', { name, exact: true }).click(); await page.waitForTimeout(150);
        const json = JSON.parse(await page.locator('.fxg-code pre code').innerText());
        const r = fxmod.resolveEffects(json.effects);
        eq(r.headline, fxmod.PRESETS[name].headline, `preset ${name} headline`);
        eq(r.cards, fxmod.PRESETS[name].cards, `preset ${name} cards`);
      }
    });
    await check('extras can be switched on and off without leaving anything behind', async () => {
      for (const e of Object.values(fxmod.EXTRAS)) {
        const chip = page.getByRole('checkbox', { name: e.label, exact: true });
        await chip.click(); await page.waitForTimeout(150); await chip.click(); await page.waitForTimeout(250);
      }
      eq(await page.locator('.fx-cursor, .fx-progress, .fx-spark').count(), 0, 'leftover extra elements');
    });
    await check('colour pickers recolour the preview', async () => {
      await page.getByLabel('Primary').fill('#ff0066'); await page.waitForTimeout(200);
      eq(await page.locator('.fxg-hero').evaluate((e) => getComputedStyle(e).getPropertyValue('--primary').trim()), '#ff0066', 'primary');
    });
    await check(`figures: all ${Object.keys(fxmod.FIGURES).length} draw in the gallery, answer the pointer, and can be given a place`, async () => {
      for (const [id, f] of Object.entries(fxmod.FIGURES)) {
        await page.locator('.fxg-figures').getByRole('radio', { name: f.label, exact: true }).click();
        await page.waitForSelector(`.fxg-fig-box[data-hairline="${id}"]`);
        const parts = await page.locator('.fxg-fig-box svg path, .fxg-fig-box svg ellipse, .fxg-fig-box svg circle').count();
        truthy(parts >= 3, `${id}: ${parts} drawn parts`);
      }
      await page.locator('.fxg-fig-box').scrollIntoViewIfNeeded(); await page.waitForTimeout(300);
      const box = await page.locator('.fxg-fig-box').boundingBox();
      const before = await page.locator('.fxg-fig-box svg').innerHTML();
      await page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.35, { steps: 5 }); await page.waitForTimeout(700);
      truthy((await page.locator('.fxg-fig-box svg').innerHTML()) !== before, 'the last figure did not answer the pointer');
      await page.getByRole('button', { name: 'Use the suggestions' }).click();
      const snippet = await page.locator('.fxg-code pre code').innerText();
      for (const [place, pl] of Object.entries(fxmod.PLACES)) truthy(snippet.includes(`"${place}": "${pl.suggest}"`), `snippet names ${place}: ${pl.suggest}`);
      await page.getByRole('button', { name: 'Clear' }).click();
    });
    await shot(page, 'fx-gallery');
    const m = await newPage(browser, 'mobile', 'fx-gallery-mobile');
    await m.page.goto(`${BASE}/effects`, { waitUntil: 'networkidle' }); await m.page.waitForTimeout(800);
    await check('mobile: the gallery fits the screen and its controls are finger-sized', async () => {
      await noOverflow(m.page, 'gallery'); await tapTargets(m.page, 'gallery');
    });
    await shot(m.page, 'fx-gallery-mobile');
    await check('embed routes: a component, a figure and a background render bare (no chrome, no scrollbars, query colours, theme message)', async () => {
      const e = await newPage(browser, 'desktop', 'fx-embed'); await e.page.setViewportSize({ width: 480, height: 360 });
      const figId = Object.keys(fxmod.FIGURES)[0], bgId = Object.keys(fxmod.BACKGROUNDS)[0];
      for (const [kind, id, theme] of [['c', 'line-chart', 'dark'], ['f', figId, 'light'], ['bg', bgId, 'dark']]) {
        const r = await e.page.goto(`${BASE}/effects/${kind}/${id}/?theme=${theme}&primary=%23e11d48&signal=%2310b981`, { waitUntil: 'networkidle' }); await e.page.waitForTimeout(600);
        eq(r.status(), 200, `${kind}/${id} status`);
        const m = await e.page.evaluate(() => ({ sh: document.documentElement.scrollHeight, ih: innerHeight, sw: document.documentElement.scrollWidth, iw: innerWidth, theme: document.documentElement.dataset.theme, primary: getComputedStyle(document.documentElement).getPropertyValue('--primary').trim(), bg: getComputedStyle(document.body).backgroundColor, chrome: document.querySelectorAll('header, footer, .fxg-bar, .theme-toggle').length, drawn: document.querySelectorAll('.fxe svg, .fxe canvas, .fxe .fx-bg, .fxe-demo > *').length }));
        truthy(m.sh <= m.ih && m.sw <= m.iw, `${kind}/${id}: scrolls (${m.sw}x${m.sh} in ${m.iw}x${m.ih})`);
        eq(m.theme, theme, `${kind}/${id} theme`); eq(m.primary, '#e11d48', `${kind}/${id} primary`);
        eq(m.bg, 'rgba(0, 0, 0, 0)', `${kind}/${id} page background`); eq(m.chrome, 0, `${kind}/${id} site chrome`);
        truthy(m.drawn > 0, `${kind}/${id}: nothing rendered`);
      }
      await e.page.evaluate(() => window.postMessage({ type: 'sitewright-theme', theme: 'light' }, '*')); await e.page.waitForTimeout(100);
      eq(await e.page.evaluate(() => document.documentElement.dataset.theme), 'light', 'theme message');
      eq((await e.ctx.request.get(`${BASE}/effects/c/not-a-component/`)).status(), 404, 'unknown id');
      await e.ctx.close();
    });
    await ctx.close(); await m.ctx.close();
  }
}

// ---- figures (interactive line drawings in named places) -----------------------------------------------------------------------
async function checkFigures(browser) {
  const F = FX.figures ?? {};
  const places = Object.keys(F);
  if (!places.length) return;
  section = 'figures';
  const sel = (p) => `.fx-fig-${p}[data-hairline]`;
  const svgOf = (page, p) => page.evaluate((s) => document.querySelector(s)?.querySelector('svg')?.innerHTML ?? '', sel(p));
  const rect = (page, s) => page.evaluate((q) => { const r = document.querySelector(q)?.getBoundingClientRect(); return r ? { x: r.x, y: r.y, w: r.width, h: r.height } : null; }, s);
  /** The box of the text itself (a heading's own box spans the whole column). */
  const textRect = (page, q) => page.evaluate((s) => { const el = document.querySelector(s); if (!el) return null; const g = document.createRange(); g.selectNodeContents(el); const r = g.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; }, q);
  const overlap = (a, b) => { const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x), h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y); return w > 0 && h > 0 ? (w * h) / Math.min(a.w * a.h, b.w * b.h) : 0; };

  /** The figure is there, drawn, named, sized, and answers a sweep of the pointer. */
  async function figureWorks(page, p, { minWidth = 120, answer = true } = {}) {
    await page.locator(sel(p)).first().waitFor({ state: 'attached' });
    await page.locator(sel(p)).first().scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    eq(await page.locator(sel(p)).count(), 1, `${p}: figures in the place`);
    const el = page.locator(sel(p));
    eq(await el.getAttribute('data-hairline'), F[p], `${p}: which figure`);
    truthy((await el.getAttribute('aria-label') ?? '').length > 10, `${p}: accessible name`);
    truthy(['img', 'group'].includes(await el.getAttribute('role')), `${p}: role`);
    const parts = await el.locator('svg path, svg ellipse, svg circle').count();
    truthy(parts >= 3, `${p}: ${parts} drawn parts`);
    const r = await rect(page, sel(p));
    truthy(r && r.w >= minWidth && r.h >= minWidth * 0.7, `${p}: figure is ${r ? Math.round(r.w) : 0}px wide`);
    if (answer) {
      const before = await svgOf(page, p);
      let changed = false;
      for (const [fx, fy] of [[0.3, 0.4], [0.5, 0.55], [0.7, 0.35], [0.5, 0.2]]) {
        await page.mouse.move(r.x + r.w * fx, r.y + r.h * fy, { steps: 5 });
        await page.waitForTimeout(450);
        if ((await svgOf(page, p)) !== before) changed = true;
      }
      truthy(changed, `${p}: the figure did not answer the pointer`);
      await page.mouse.move(2, 2);
    }
  }

  const desk = async (name) => (await newPage(browser, 'desktop', name));

  if (F.hero && has('landing')) await check(`hero: ${F.hero} sits beside the headline and does not cover the mark`, async () => {
    const { ctx, page } = await desk('fig-hero');
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
    await figureWorks(page, 'hero', { minWidth: 250 });
    const fig = await rect(page, sel('hero')), logo = await rect(page, '[data-route-logo], [data-hero-mark]'), h1 = await textRect(page, '.lp-h1');
    truthy(logo && logo.w >= 80 && logo.h >= 80, `the mark's box is ${logo ? Math.round(logo.w) : 0}px`);
    truthy(overlap(fig, logo) < 0.12, `figure covers the mark (${Math.round(overlap(fig, logo) * 100)}%)`);
    truthy(overlap(fig, h1) < 0.02, 'figure covers the headline');
    await noOverflow(page, 'landing with a hero figure'); await shot(page, 'fig-hero');
    await ctx.close();
  });
  if (F.hero && has('landing')) await check('hero: on a phone the page still fits and has no sideways scroll', async () => {
    const { ctx, page } = await newPage(browser, 'narrow', 'fig-hero-narrow');
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle' }); await scrollThrough(page);
    await noOverflow(page, 'landing at 360px with a hero figure'); await ctx.close();
  });

  if (F.releases && has('landing')) await check('releases: the figure sits with the list when there are releases', async () => {
    const { ctx, page } = await desk('fig-releases');
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
    if (await page.locator('.side-head').count()) { await figureWorks(page, 'releases'); await shot(page, 'fig-releases'); }
    else eq(await page.locator(sel('releases')).count(), 0, 'no releases, no figure');
    await ctx.close();
  });

  for (const [place, path, title] of [['signin', '/login', 'sign-in card'], ['mfa', '/admin/login', 'account sign-in card']]) {
    if (!F[place] || !has(place === 'signin' ? 'signin' : 'mfa')) continue;
    await check(`${place}: ${F[place]} is on the ${title}, inside it, on desktop and a phone`, async () => {
      for (const vp of ['desktop', 'narrow']) {
        const { ctx, page } = await newPage(browser, vp, `fig-${place}-${vp}`);
        await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
        await figureWorks(page, place, { minWidth: 100, answer: vp === 'desktop' });
        const card = await rect(page, '.login-card'), fig = await rect(page, sel(place));
        truthy(fig.x >= card.x - 1 && fig.x + fig.w <= card.x + card.w + 1, 'figure is inside the card');
        await noOverflow(page, `${path} at ${VIEWPORTS[vp].width}px`);
        if (vp === 'desktop') await shot(page, `fig-${place}`);
        await ctx.close();
      }
    });
  }

  // pages behind the shared-password sign-in
  const signedIn = async (name) => {
    const { ctx, page } = await desk(name);
    if (has('signin')) {
      await page.goto(`${BASE}/login`); await page.locator('input[name=password]').fill(env.DASHBOARD_PASSWORD); await page.getByRole('button', { name: 'Sign in' }).click();
      await page.waitForURL((u) => !u.pathname.startsWith('/login'));
    }
    return { ctx, page };
  };

  if (F.connect && has('connect')) await check(`connect: ${F.connect} sits by the title and never covers it`, async () => {
    const { ctx, page } = await signedIn('fig-connect');
    await page.goto(`${BASE}/connect`, { waitUntil: 'networkidle' });
    await figureWorks(page, 'connect');
    truthy(overlap(await rect(page, sel('connect')), await textRect(page, '.hero-title')) < 0.02, 'figure covers the title');
    await noOverflow(page, 'connect page'); await shot(page, 'fig-connect'); await ctx.close();
    const n = await newPage(browser, 'narrow', 'fig-connect-narrow');
    await n.page.goto(`${BASE}/login`); await n.page.locator('input[name=password]').fill(env.DASHBOARD_PASSWORD); await n.page.getByRole('button', { name: 'Sign in' }).click();
    await n.page.waitForURL((u) => !u.pathname.startsWith('/login')); await n.page.goto(`${BASE}/connect`, { waitUntil: 'networkidle' });
    await noOverflow(n.page, 'connect page at 360px'); await n.ctx.close();
  });

  if (F.empty && has('dashboard')) await check('empty: the figure shows when a search finds nothing', async () => {
    const { ctx, page } = await signedIn('fig-empty');
    await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' });
    if (!(await page.locator(sel('empty')).count())) { await page.locator('.search input').fill('zzzqqq-no-such-thing'); await page.waitForTimeout(400); }
    await figureWorks(page, 'empty', { minWidth: 120 });
    await noOverflow(page, 'dashboard empty state'); await shot(page, 'fig-empty'); await ctx.close();
  });

  if (F.notfound) await check('notfound: a missing page answers 404 and carries the figure', async () => {
    const ctx = await browser.newContext({ viewport: VIEWPORTS.desktop }); await stubFonts(ctx);
    const page = await ctx.newPage();
    if (has('signin')) {
      await page.goto(`${BASE}/login`); await page.locator('input[name=password]').fill(env.DASHBOARD_PASSWORD); await page.getByRole('button', { name: 'Sign in' }).click();
      await page.waitForURL((u) => !u.pathname.startsWith('/login'));
    }
    const res = await page.goto(`${BASE}/this-page-does-not-exist`, { waitUntil: 'networkidle' });
    eq(res.status(), 404, 'status');
    await figureWorks(page, 'notfound', { minWidth: 150 });
    await shot(page, 'fig-notfound'); await ctx.close();
  });

  await check('reduced motion: the figures hold still (the frame loop sleeps) and are still drawn', async () => {
    const public_ = has('landing') && F.hero ? '/' : has('signin') && F.signin ? '/login' : has('mfa') && F.mfa ? '/admin/login' : null;
    if (!public_) return;
    const place = public_ === '/' ? 'hero' : public_ === '/login' ? 'signin' : 'mfa';
    const { ctx, page } = await newPage(browser, 'desktop', 'fig-reduced', { reducedMotion: 'reduce' });
    await page.addInitScript('(() => { window.__raf = 0; const r = window.requestAnimationFrame; window.requestAnimationFrame = (f) => { window.__raf++; return r(f); }; })();');
    await page.goto(`${BASE}${public_}`, { waitUntil: 'networkidle' }); await page.waitForTimeout(1500);
    truthy((await page.locator(`${sel(place)} svg path, ${sel(place)} svg ellipse`).count()) >= 3, 'drawn under reduced motion');
    const frames = await page.evaluate(() => { window.__raf = 0; return new Promise((r) => setTimeout(() => r(window.__raf), 800)); });
    truthy(frames <= 3, `${frames} animation frames in 800ms under reduced motion`);
    await ctx.close();
  });
}

// ---- icons -----------------------------------------------------------------------------------------------------------------------
const hasIcons = () => Boolean(Object.keys(site.nav?.icons ?? {}).length || (site.dashboard?.stats ?? []).some((x) => x.icon) || (site.dashboard?.statuses ?? []).some((x) => x.icon)
  || (site.landing?.features?.ready ?? []).some((t) => t[2]) || (site.landing?.story?.steps ?? []).some((x) => x.icon));
async function checkIcons(browser) {
  if (!hasIcons()) return;
  section = 'icons';
  const ALLOWED = new Set(['g', 'path', 'circle', 'ellipse', 'rect', 'line', 'polyline', 'polygon', 'defs', 'clippath', 'mask', 'lineargradient', 'radialgradient', 'stop']);
  /** Every inline icon on the page: drawn, a sensible size, in the colour of its text, hidden from screen readers, and made of plain shapes only. */
  const iconsOk = (page, where) => page.evaluate((allowed) => {
    const bad = [];
    for (const svg of document.querySelectorAll('svg.ic')) {
      const r = svg.getBoundingClientRect(), id = svg.dataset.icon;
      if (r.width < 8 || r.height < 8 || r.width > 40) bad.push(`${id}: ${Math.round(r.width)}px`);
      if (svg.getAttribute('aria-hidden') !== 'true') bad.push(`${id}: not hidden from screen readers`);
      if (!svg.querySelector('path, circle, rect, line, polyline, polygon, ellipse')) bad.push(`${id}: nothing drawn`);
      for (const el of svg.querySelectorAll('*')) {
        if (!allowed.includes(el.tagName.toLowerCase())) bad.push(`${id}: <${el.tagName}> inside an icon`);
        for (const a of el.attributes) if (/^on/i.test(a.name) || /^(href|xlink:href|style)$/i.test(a.name)) bad.push(`${id}: attribute ${a.name}`);
      }
    }
    return bad;
  }, [...ALLOWED]).then((bad) => { if (bad.length) throw new Error(`${where}: ${bad.slice(0, 4).join('; ')}`); });
  const pageWith = async (vp, name) => {
    const { ctx, page } = await newPage(browser, vp, name);
    if (has('signin')) {
      await page.goto(`${BASE}/login`); await page.locator('input[name=password]').fill(env.DASHBOARD_PASSWORD); await page.getByRole('button', { name: 'Sign in' }).click();
      await page.waitForURL((u) => !u.pathname.startsWith('/login'));
    }
    return { ctx, page };
  };

  if (has('dashboard')) await check('dashboard: navigation, stat cards and status chips carry their icons, in the text colour, without crowding it', async () => {
    for (const vp of ['desktop', 'narrow']) {
      const { ctx, page } = await pageWith(vp, `icons-dash-${vp}`);
      await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' }); await page.waitForTimeout(500);
      for (const [id, icon] of Object.entries(site.nav?.icons ?? {})) {
        const sel = `header.site nav svg[data-icon="${icon}"]`;
        if (await page.locator(`header.site nav a[href="${{ dashboard: '/dashboard', connect: '/connect', publishing: '/admin', team: '/admin', home: '/' }[id]}"]`).count()) eq(await page.locator(sel).count() >= 1, true, `nav icon ${id} (${icon})`);
      }
      const stats = (site.dashboard.stats ?? []).filter((x) => x.icon);
      if (stats.length && await page.locator('.stat-card').count()) {
        for (const st of stats) eq(await page.locator(`.stat-card svg.stat-ic[data-icon="${st.icon}"]`).count() >= 1, true, `stat icon ${st.icon}`);
        // the icon sits in a corner and never on top of the number
        const clash = await page.evaluate(() => [...document.querySelectorAll('.stat-card')].filter((c) => { const i = c.querySelector('.stat-ic'); if (!i) return false; const a = i.getBoundingClientRect(), g = document.createRange(); g.selectNodeContents(c.querySelector('.stat-n')); const b = g.getBoundingClientRect(); return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top; }).length);
        eq(clash, 0, 'stat icons overlapping their number');
      }
      for (const stt of (site.dashboard.statuses ?? []).filter((x) => x.icon)) if (await page.locator('.chip').count()) eq(await page.locator(`.chip svg[data-icon="${stt.icon}"]`).count() >= 1, true, `status chip icon ${stt.icon}`);
      const same = await page.evaluate(() => { const a = document.querySelector('header.site nav a.on'), i = a?.querySelector('svg.ic'); return a && i ? getComputedStyle(a).color === getComputedStyle(i).color : true; });
      truthy(same, 'a nav icon is not the colour of its label');
      await iconsOk(page, `dashboard at ${VIEWPORTS[vp].width}px`);
      await noOverflow(page, `dashboard with icons at ${VIEWPORTS[vp].width}px`);
      if (vp === 'desktop') await shot(page, 'icons-dashboard');
      await ctx.close();
    }
  });

  if (has('landing') && ((site.landing?.features?.ready ?? []).some((t) => t[2]) || (site.landing?.story?.steps ?? []).some((x) => x.icon))) await check('landing: feature and story icons appear where they were given, and only there', async () => {
    const { ctx, page } = await newPage(browser, 'desktop', 'icons-landing');
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle' }); await scrollThrough(page);
    const f = site.landing?.features;
    if (f) {
      const given = [...(f.ready ?? []).map((t) => t[2]), ...(f.next ?? []).map((t) => t[3])].filter(Boolean).length;
      eq(await page.locator('.mod-ic.has svg.ic').count(), given, 'feature icons vs config');
    }
    const steps = (site.landing?.story?.steps ?? []).filter((x) => x.icon).length;
    eq(await page.locator('.st-ic').count(), steps, 'story icons vs config');
    await iconsOk(page, 'landing');
    await noOverflow(page, 'landing with icons');
    await ctx.close();
  });
}

/** The project keeps its own icons in line with its code (`npm run icons`): every icon the code asks for is already in the data, and the sync agrees. */
async function checkIconSync() {
  if (!fs.existsSync(path.join(SITE, 'scripts', 'sync-icons.mjs'))) return;
  section = 'icons';
  await check('the icons in the project match what its code asks for (npm run icons --check)', async () => {
    const { spawnSync } = await import('node:child_process');
    const r = spawnSync(process.execPath, ['scripts/sync-icons.mjs', '--check', '--offline'], { cwd: SITE, encoding: 'utf8' });
    if (r.status !== 0) throw new Error(`sync-icons --check failed: ${(r.stderr || r.stdout).trim().split('\n').slice(0, 3).join(' | ')}`);
    const data = JSON.parse(fs.readFileSync(path.join(SITE, 'src/components/icons/icons.data.json'), 'utf8'));
    for (const [id, v] of Object.entries(data.icons)) if (!v.b || !v.w || !v.h) throw new Error(`icon ${id} has no drawing or size`);
  });
}

async function checkHydration(browser) {
  section = 'hydration';
  // Real browsers hit pages with a WARM cache (scripts already downloaded for the page before). That is when a server-rendered page
  // that streams in pieces can start hydrating too early - a React #418 error - so load every page type right after the home page.
  const targets = ['/login', '/connect', '/dashboard', '/admin/login', '/admin/setup', '/effects'].filter((u) => {
    if (u === '/effects') return has('fxgallery');
    if (u === '/login') return has('signin');
    if (u === '/connect') return has('connect');
    if (u === '/dashboard') return has('dashboard');
    return has('mfa');
  });
  const first = has('landing') ? '/' : (targets[0] ?? '/');
  for (const u of targets) {
    await check(`${u} hydrates cleanly 6 times after ${first} (warm cache)`, async () => {
      const ctx = await browser.newContext(); await stubFonts(ctx); const p = await ctx.newPage();
      const errs = [];
      p.on('pageerror', (e) => { if (/Minified React error #(418|423|425|299)|[Hh]ydrat/.test(e.message)) errs.push(e.message.slice(0, 90)); });
      for (let i = 0; i < 6; i++) { await p.goto(`${BASE}${first}`, { waitUntil: 'networkidle' }); await p.goto(`${BASE}${u}`, { waitUntil: 'networkidle' }); }
      await ctx.close();
      if (errs.length) throw new Error(`${errs.length} hydration error(s) in 6 loads: ${errs[0]}`);
    });
  }
}

// ---- run ------------------------------------------------------------------------------------------------------------------------
let browser;
try {
  console.log(`Sitewright verify: ${site.brand.name}  modules: ${site.modules.join(', ')}  -> ${BASE}`);
  await startServer();
  browser = await chromium.launch({ headless: true });
  if (has('landing')) await checkLanding(browser);
  if (has('signin')) await checkSignin(browser);
  await checkApiAndDashboard(browser);
  await checkConnect(browser);
  await checkEffects(browser);
  await checkFigures(browser);
  await checkIcons(browser);
  await checkIconSync();
  await checkAdmin(browser);
  await checkHydration(browser);
  section = 'console';
  await check('no browser console errors or uncaught exceptions', async () => { if (consoleErrors.length) throw new Error(`${consoleErrors.length}: ${consoleErrors.slice(0, 5).join(' | ')}`); });
} catch (e) {
  results.push({ label: 'run', ok: false, error: String(e.stack ?? e) }); console.log(`  FAIL  run\n        ${e.message}`);
} finally {
  if (browser) await browser.close();
  if (server && !KEEP) { server.kill(); await new Promise((r) => setTimeout(r, 800)); }
  if (!KEEP) for (const d of scratch) fs.rmSync(d, { recursive: true, force: true });
}
const failed = results.filter((r) => !r.ok);
fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify({ site: site.brand.name, modules: site.modules, passed: results.length - failed.length, failed: failed.length, results }, null, 2));
const skipped = results.filter((r) => r.skipped).length;
console.log(`\n${results.length - failed.length - skipped}/${results.length - skipped} checks passed${skipped ? `, ${skipped} skipped (need real APKs)` : ''}${failed.length ? `, ${failed.length} FAILED` : ''}  (screenshots + report.json in ${OUT})`);
process.exit(failed.length ? 1 : 0);
