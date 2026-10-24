// Records the short preview videos shown in the dashboard's picker. Not part of the plugin runtime.
//
//   1. node packs/sitewright/skills/sitewright/scripts/scaffold.mjs --config demo.json --out DEMO   (modules landing, signin, dashboard,
//      connect, fxgallery; "effects": {"components": "all", "figures": "auto"})
//   2. cd DEMO && npm install && PORT=3150 npm run dev
//   3. CHROME_PATH=... PW=path/to/playwright-core/index.mjs OUT=site/live/previews node scripts/capture_previews.mjs
//
// Every clip is a real recording of Sitewright's own bare embed pages (/effects/c|f|bg/ID) or of its /effects gallery, never a mock-up.
// Needs ffmpeg. Each item becomes OUT/<group>/<id>.mp4 plus a poster OUT/<group>/<id>.webp.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const { chromium } = await import(process.env.PW || "playwright-core");
const BASE = process.env.BASE || "http://localhost:3150";
const OUT = path.resolve(process.env.OUT || "site/live/previews");
const ONLY = process.env.ONLY ? new RegExp(process.env.ONLY) : null;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "hs-prev-"));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH, args: ["--no-sandbox", "--disable-gpu"] });

function encode(webm, group, id, { crop, width = 480, start = 0.8, dur = 4, posterAt = 2.2 }) {
  fs.mkdirSync(path.join(OUT, group), { recursive: true });
  const vf = [crop ? `crop=${crop.w}:${crop.h}:${crop.x}:${crop.y}` : null, `scale=${width}:-2`, "fps=20"].filter(Boolean).join(",");
  const mp4 = path.join(OUT, group, id + ".mp4");
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-ss", String(start), "-t", String(dur), "-i", webm, "-vf", vf, "-c:v", "libx264", "-crf", "32",
    "-preset", "slow", "-pix_fmt", "yuv420p", "-an", "-movflags", "+faststart", mp4]);
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-ss", String(posterAt), "-i", webm, "-frames:v", "1", "-vf", vf, "-c:v", "libwebp", "-quality", "72",
    path.join(OUT, group, id + ".webp")]);
}

async function record(group, id, size, run, opts = {}) {
  if (ONLY && !ONLY.test(group + "/" + id)) return;
  const dir = fs.mkdtempSync(path.join(TMP, "v-"));
  const ctx = await browser.newContext({ viewport: size, recordVideo: { dir, size } });
  const born = Date.now();
  const page = await ctx.newPage();
  page.mark = () => { page.t0 = Date.now(); };  // the moment the interesting part starts: the clip is cut from here
  let crop = null;
  try {
    crop = await run(page);
    await page.waitForTimeout(opts.tail ?? 600);
  } catch (e) {
    console.log("FAILED", group, id, String(e).slice(0, 120));
  }
  const video = page.video();
  await ctx.close();
  try {
    const start = Math.max(0, ((page.t0 || born + 1500) - born) / 1000 - 0.1);
    encode(await video.path(), group, id, Object.assign({}, opts, { crop: crop || opts.crop, start, posterAt: start + (opts.dur || 4) * 0.55 }));
    console.log("ok", group + "/" + id);
  } catch (e) {
    console.log("ENCODE FAILED", group, id, String(e).slice(0, 120));
  }
}

const hideDevBadge = (page) => page.addStyleTag({ content: "nextjs-portal,[data-nextjs-toast],[data-next-badge-root]{display:none!important}" });

async function sweep(page, cx, cy, r = 110, steps = 70, click = false) {
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2 * 1.4;
    await page.mouse.move(cx + Math.cos(a) * r * (0.5 + i / steps / 2), cy + Math.sin(a) * r * 0.7);
    if (click && i === Math.floor(steps / 2)) { await page.mouse.down(); await page.waitForTimeout(90); await page.mouse.up(); }
    await page.waitForTimeout(38);
  }
}

// ---- bare embeds: backgrounds, figures, components
const EMBED = { width: 600, height: 450 };
async function embed(kind, group, ids, opts = {}) {
  for (const id of ids) {
    await record(group, id, EMBED, async (page) => {
      await page.goto(`${BASE}/effects/${kind}/${id}/`, { waitUntil: "networkidle" });
      await hideDevBadge(page);
      await page.waitForTimeout(700);
      page.mark();
      if (id === "hold-to-confirm" || id === "tear-button" || id === "pull-cord") {
        await page.mouse.move(300, 225); await page.mouse.down(); await page.waitForTimeout(2200); await page.mouse.up();
      } else await sweep(page, 300, 225, 120, 70, kind === "c");
      return null;
    }, Object.assign({ dur: 3.8 }, opts));
  }
}

// ---- the gallery playground: headline, buttons, cards, reveal, extras, presets
const GALLERY = { width: 1280, height: 1500 };

const group = (page, label) => page.locator(`[role=radiogroup][aria-label="${label}"] .fxg-chip`);

async function heroBox(page) {
  const b = await page.locator(".fxg-hero").first().boundingBox();
  return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width) & ~1, h: Math.round(b.height) & ~1 };
}
async function gallery(groupId, id, setup, region = "hero", opts = {}) {
  await record(groupId, id, GALLERY, async (page) => {
    await page.goto(`${BASE}/effects`, { waitUntil: "networkidle" });
    await hideDevBadge(page);
    await page.waitForTimeout(900);
    page.mark();
    await setup(page);
    let box = await heroBox(page);
    if (region === "cards") {
      const c = await page.locator(".fxg-cards").first().boundingBox();
      box = { x: box.x, y: Math.round(box.y), w: box.w, h: Math.round(c.y + c.height - box.y) & ~1 };
    }
    if (region === "full") box = { x: 0, y: 0, w: 1280, h: 720 };
    if (region === "stats") box = { x: box.x, y: box.y, w: box.w, h: (box.h + 130) & ~1 };
    return box;
  }, Object.assign({ dur: 4.2, width: 560 }, opts));
}
const choose = async (page, label, index) => { await group(page, label).nth(index).click(); await page.waitForTimeout(250); };
const replay = async (page) => { await page.getByRole("button", { name: "Replay entrance" }).click(); };

const LISTS = JSON.parse(process.env.LISTS || "{}");
const L = {
  bg: LISTS.bg, figures: LISTS.figures, components: LISTS.components,
  headline: LISTS.headline, buttons: LISTS.buttons, cards: LISTS.cards, reveal: LISTS.reveal, extras: LISTS.extras, presets: LISTS.presets,
};

for (const [i, id] of (L.bg || []).entries()) {  // backgrounds are shown inside the gallery's hero, as they look on a real page
  await gallery("sw-hero", id, async (page) => {
    await choose(page, "Hero background", i + 1);
    page.mark();
    const b = await page.locator(".fxg-hero").first().boundingBox();
    await page.waitForTimeout(500);
    await sweep(page, b.x + b.width / 2, b.y + b.height / 2, 190, 80);
  }, "hero", { start: 1.2, dur: 4.2 });
}
await embed("f", "sw-figures", L.figures || []);
await embed("c", "sw-components", L.components || []);

for (const [i, id] of (L.headline || []).entries()) {
  await gallery("sw-headline", id, async (page) => { await choose(page, "Headline animation", i + 1); await page.waitForTimeout(150); page.mark(); await replay(page); await page.waitForTimeout(200); });
}
for (const [i, id] of (L.buttons || []).entries()) {
  await gallery("sw-buttons", id, async (page) => {
    await choose(page, "Buttons", i + 1);
    page.mark();
    const b = await page.locator(".fxg-hero .btn").first().boundingBox();
    await page.mouse.move(b.x - 40, b.y + b.height / 2);
    for (let k = 0; k < 28; k++) { await page.mouse.move(b.x - 40 + k * ((b.width + 80) / 28), b.y + b.height / 2 + Math.sin(k / 3) * 6); await page.waitForTimeout(45); }
    await page.mouse.down(); await page.waitForTimeout(120); await page.mouse.up();
    await page.waitForTimeout(500);
  }, "hero", { start: 1.0 });
}
for (const [i, id] of (L.cards || []).entries()) {
  await gallery("sw-cards", id, async (page) => {
    await choose(page, "Cards", i + 1);
    page.mark();
    const cs = await page.locator(".fxg-cards > *").all();
    for (const c of cs) { const b = await c.boundingBox(); for (let k = 0; k < 14; k++) { await page.mouse.move(b.x + 10 + (k / 13) * (b.width - 20), b.y + 20 + Math.sin(k / 2) * 30 + 30); await page.waitForTimeout(45); } }
  }, "cards", { start: 1.0 });
}
for (const [i, id] of (L.reveal || []).entries()) {
  await gallery("sw-reveal", id, async (page) => { await choose(page, "Scroll reveal", i); await page.waitForTimeout(200); page.mark(); await replay(page); }, "stats");
}
for (const [i, id] of (L.extras || []).entries()) {
  await gallery("sw-extras", id, async (page) => {
    await page.locator('[role=checkbox].fxg-chip').nth(i).click();
    await page.waitForTimeout(300);
    page.mark();
    if (id === "count-up") await replay(page);
    if (id === "cursor-glow" || id === "click-spark") {
      const b = await page.locator(".fxg-hero").first().boundingBox();
      for (let k = 0; k < 40; k++) { await page.mouse.move(b.x + 80 + (k / 39) * (b.width - 160), b.y + 120 + Math.sin(k / 4) * 90); if (id === "click-spark" && k % 8 === 4) { await page.mouse.down(); await page.mouse.up(); } await page.waitForTimeout(60); }
    }
    if (id === "scroll-progress") { for (let k = 0; k < 24; k++) { await page.mouse.wheel(0, 90); await page.waitForTimeout(110); } }
  }, id === "scroll-progress" ? "full" : "stats", { start: 1.0, dur: 4.4 });
}
for (const id of L.presets || []) {
  await gallery("sw-presets", id, async (page) => { await page.getByRole("button", { name: id, exact: true }).click(); await page.waitForTimeout(300); page.mark(); await replay(page); }, "stats");
}

// ---- the module pages (still images of the real generated pages)
const SHOTS = { landing: "/", signin: "/login", dashboard: "/dashboard", connect: "/connect", fxgallery: "/effects" };
fs.mkdirSync(path.join(OUT, "sw-modules"), { recursive: true });
for (const [id, url] of Object.entries(SHOTS)) {
  if (ONLY && !ONLY.test("sw-modules/" + id)) continue;
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  try {
    await page.goto(BASE + url, { waitUntil: "networkidle" }); await hideDevBadge(page); await page.waitForTimeout(1800);
    const png = path.join(TMP, id + ".png");
    await page.screenshot({ path: png });
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", png, "-vf", "scale=640:-2", "-c:v", "libwebp", "-quality", "74", path.join(OUT, "sw-modules", id + ".webp")]);
    console.log("ok sw-modules/" + id);
  } catch (e) { console.log("FAILED module", id, String(e).slice(0, 100)); }
  await ctx.close();
}
await browser.close();
