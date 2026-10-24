// Records the short clip and the poster for each style demo in site/live/previews/styles-popular/. Not part of the plugin runtime.
//
//   node scripts/build_style_demos.py first, then:
//   CHROME_PATH=... PW=path/to/playwright-core/index.mjs node scripts/capture_style_demos.mjs        (ONLY=glass to do one)
//
// Every clip is a real recording of the demo page being used: hovering a card, switching a habit on, typing a new habit and adding it.
// A small dot stands in for the mouse pointer, which video capture does not draw. Needs ffmpeg.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const { chromium } = await import(process.env.PW || "playwright-core");
const HERE = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.resolve(HERE, "..", "site", "live", "previews", "styles-popular");
const ONLY = process.env.ONLY ? new RegExp(process.env.ONLY) : null;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "hs-demo-"));
const SIZE = { width: 1280, height: 960 };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH, args: ["--no-sandbox"] });

const CURSOR = `(() => { const d = document.createElement('div'); d.id = 'hs-cursor';
  d.style.cssText = 'position:fixed;left:0;top:0;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;background:rgba(255,255,255,.92);border:2.5px solid #111;box-shadow:0 2px 8px rgba(0,0,0,.4);pointer-events:none;z-index:2147483647;transition:transform .08s,width .12s,height .12s,margin .12s;';
  addEventListener('DOMContentLoaded', () => document.documentElement.appendChild(d));
  addEventListener('mousemove', e => { d.style.left = e.clientX + 'px'; d.style.top = e.clientY + 'px'; }, true);
  addEventListener('mousedown', () => { d.style.transform = 'scale(.7)'; }, true); addEventListener('mouseup', () => { d.style.transform = ''; }, true); })();`;

async function center(page, sel) {
  return page.$eval(sel, (e) => { const b = e.getBoundingClientRect(); return [b.x + b.width / 2, b.y + b.height / 2]; });
}
async function show(page, sel) {  // bring it into view smoothly, then wait for the scroll to settle
  await page.$eval(sel, (e) => { const b = e.getBoundingClientRect(); if (b.top < 80 || b.bottom > innerHeight - 80) scrollBy({ top: b.top - innerHeight / 2 + b.height / 2, behavior: "smooth" }); });
  await sleep(700);
}
async function glide(page, sel, steps = 12) {
  const [x, y] = await center(page, sel);
  await page.mouse.move(x, y, { steps });
  return [x, y];
}

for (const file of fs.readdirSync(DIR).filter((f) => f.endsWith(".html")).sort()) {
  const slug = file.slice(0, -5);
  if (ONLY && !ONLY.test(slug)) continue;
  const dir = fs.mkdtempSync(path.join(TMP, "v-"));
  const ctx = await browser.newContext({ viewport: SIZE, recordVideo: { dir, size: SIZE }, reducedMotion: "no-preference" });
  await ctx.addInitScript(CURSOR);
  const page = await ctx.newPage();
  const born = Date.now();
  let t0 = 0, tPoster = 0;
  try {
    await page.goto("file://" + path.join(DIR, file));
    await page.mouse.move(640, 80);
    await sleep(900);
    t0 = (Date.now() - born) / 1000;
    await glide(page, "[data-demo=card]"); await sleep(800);                        // hover a card
    await show(page, "[data-demo=toggle]");
    const [x, y] = await glide(page, "[data-demo=toggle]"); await sleep(250);
    await page.mouse.down(); await page.mouse.up(); await sleep(900);               // switch it on
    tPoster = (Date.now() - born) / 1000;
    await sleep(300);
    await show(page, "[data-demo=input]");
    await glide(page, "[data-demo=input]"); await page.mouse.down(); await page.mouse.up(); await sleep(300);
    await page.keyboard.type("Stretch for 5 minutes", { delay: 38 }); await sleep(250);
    await show(page, "[data-demo=add]");
    await glide(page, "[data-demo=add]"); await sleep(380);                          // hover the button
    await page.mouse.down(); await sleep(120); await page.mouse.up(); await sleep(1400);
    await page.evaluate(() => scrollTo({ top: 0, behavior: "smooth" })); await sleep(1100);
  } catch (e) {
    console.log("FAILED", slug, String(e).slice(0, 160));
  }
  const total = (Date.now() - born) / 1000;
  const video = page.video();
  await ctx.close();
  const webm = await video.path();
  const mp4 = path.join(DIR, slug + ".mp4"), poster = path.join(DIR, slug + ".webp");
  const vf = "scale=720:-2,fps=20";
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-ss", String(t0), "-t", String(Math.max(4, total - t0 - 0.2)), "-i", webm, "-vf", vf, "-c:v", "libx264", "-crf", "31", "-preset", "slow", "-pix_fmt", "yuv420p", "-an", "-movflags", "+faststart", mp4]);
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-ss", String(tPoster), "-i", webm, "-frames:v", "1", "-vf", "scale=720:-2", "-c:v", "libwebp", "-quality", "78", poster]);
  console.log(slug, (fs.statSync(mp4).size / 1024).toFixed(0) + " KB video,", (fs.statSync(poster).size / 1024).toFixed(0) + " KB poster,", (total - t0).toFixed(1) + " s");
}
await browser.close();
fs.rmSync(TMP, { recursive: true, force: true });
