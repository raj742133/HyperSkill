// Browser tests for Tide. Run: CHROME_PATH=/path/to/chrome npm run test:e2e
// Most tests control time with page.clock so a 25-minute session takes milliseconds; the animation tests use real time.
import { test, before, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { chromium } from "playwright-core";
import { createServer } from "../scripts/serve.js";

const t = (name, fn) => test(name, { timeout: 60_000 }, fn); // a hang is reported against the test that hung

let browser, server, base;
const opened = []; // every context a test opens, closed after the test even when it failed, so one failure cannot starve the next tests of CPU
before(async () => {
  server = createServer();
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${server.address().port}/`;
  browser = await chromium.launch({ executablePath: process.env.CHROME_PATH, args: ["--no-sandbox", "--disable-gpu"] });
});
afterEach(async () => { for (const c of opened.splice(0)) await c.close().catch((e) => console.error("could not close a test context:", e.message)); });
after(async () => { await browser?.close(); await new Promise((r) => server.close(r)); });

async function open({ clock = true, ...ctxOpts } = {}) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, ...ctxOpts });
  opened.push(context);
  const page = await context.newPage();
  const problems = [];
  page.on("console", (m) => { if (["error", "warning"].includes(m.type())) problems.push(m.text()); });
  page.on("pageerror", (e) => problems.push("pageerror: " + e.message));
  // A fake clock that is paused moves only when a test moves it, so every number in a test is exact.
  if (clock) await page.clock.install({ time: new Date("2026-01-01T09:00:00Z") });
  await page.goto(base);
  if (clock) await page.clock.pauseAt(new Date("2026-01-01T09:01:00Z"));
  await page.waitForFunction(() => window.__tide);
  if (clock) await advance(page, 300);
  return { context, page, problems };
}
// During a roll a cell holds the old and the new digit; the newest (last) layer is the current value.
// The display refreshes a few milliseconds after each second boundary, so a test moves the clock a little past the second it wants to see.
const advance = (page, ms) => page.clock.runFor(ms >= 1000 ? ms + 60 : ms);
// Moving a long way with fastForward fires the page's timers once instead of drawing thousands of animation frames.
const jump = async (page, ms) => { await page.clock.fastForward(ms); await page.clock.runFor(300); };
const closed = (page) => page.waitForFunction(() => !document.getElementById("settings").open);
const save = async (page) => { await page.getByRole("button", { name: "Save" }).click(); await closed(page); };
const cancel = async (page) => { await page.getByRole("button", { name: "Cancel" }).click(); await closed(page); };
const digits = (page) => page.locator("#digits").evaluate((d) => [...d.children].map((c) => c.lastElementChild.textContent).join(""));
const status = (page) => page.evaluate(() => document.body.dataset.status);
const mode = (page) => page.evaluate(() => document.body.dataset.mode);
const level = (page) => page.evaluate(() => window.__tide.liquid.stats().level);
const setLengths = async (page, f, s = 5, l = 15) => {
  await page.keyboard.press("s");
  await page.locator("input[name=focus]").fill(String(f)); await page.locator("input[name=short]").fill(String(s)); await page.locator("input[name=long]").fill(String(l));
  await save(page);
};
const canvasStats = (page) => page.locator("#liquid").evaluate((c) => {
  const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
  let sum = 0, nonEmpty = 0; const seen = new Set();
  for (let i = 0; i < d.length; i += 4 * 37) { sum = (sum + d[i] * 3 + d[i + 1] * 5 + d[i + 2] * 7 + d[i + 3]) % 1000003; if (d[i + 3] > 0) nonEmpty++; seen.add(d[i] >> 4 << 8 | d[i + 1] >> 4 << 4 | d[i + 2] >> 4); }
  return { sum, nonEmpty, colours: seen.size };
});

t("loads cleanly: 25:00, focus selected, the glass is drawn, no console errors", async () => {
  const { context, page, problems } = await open();
  assert.equal(await digits(page), "25:00");
  assert.equal(await mode(page), "focus");
  assert.equal(await page.locator("#go").innerText(), "Start");
  assert.equal(await page.title(), "Tide: a focus timer");
  const s = await canvasStats(page);
  assert.ok(s.nonEmpty > 200 && s.colours > 8, `the canvas is drawn: ${JSON.stringify(s)}`);
  await advance(page, 2500); // the glass fills up as an intro
  assert.ok(await level(page) > 0.9, "the glass ends the intro full");
  assert.deepEqual(problems, []);
  await context.close();
});

t("start, run, pause and resume follow the clock exactly, and the tab title shows the time", async () => {
  const { context, page } = await open();
  await page.keyboard.press("Space");
  assert.equal(await status(page), "running");
  await advance(page, 10_000);
  assert.equal(await digits(page), "24:50");
  assert.match(await page.title(), /^24:50 · Focus · Tide$/);
  await page.keyboard.press("Space");
  assert.equal(await status(page), "paused");
  assert.equal(await page.locator("#go").innerText(), "Resume");
  await advance(page, 60_000);
  assert.equal(await digits(page), "24:50", "paused time does not move");
  await page.getByRole("button", { name: "Resume" }).click();
  await advance(page, 20_000);
  assert.equal(await digits(page), "24:30");
  await context.close();
});

t("a tab that sleeps does not lose time: jumping the clock five minutes shows the right remainder", async () => {
  const { context, page } = await open();
  await page.keyboard.press("Space");
  await page.clock.fastForward(5 * 60 * 1000); // timers do not fire; the deadline still decides
  await advance(page, 250);
  assert.equal(await digits(page), "20:00");
  await context.close();
});

t("a finished session: zero, a splash of droplets, a dot, an announcement, and the next break offered", async () => {
  const { context, page } = await open();
  await setLengths(page, 1);
  assert.equal(await digits(page), "01:00");
  await page.keyboard.press("Space");
  await jump(page, 59_000);
  assert.equal(await status(page), "running");
  await jump(page, 1_500);
  assert.equal(await status(page), "done");
  assert.equal(await digits(page), "00:00");
  assert.equal(await page.locator("#caption").innerText(), "Done. Take a break?");
  assert.equal(await page.locator("#go").innerText(), "Start short break");
  assert.equal(await page.locator("#dots li").count(), 1);
  assert.match(await page.locator("#live").innerText(), /Focus session finished/);
  assert.ok((await page.evaluate(() => window.__tide.liquid.stats().drops)) > 0, "droplets were thrown");
  await page.keyboard.press("Space");
  assert.equal(await mode(page), "short", "starting from done moves to the suggested break");
  assert.equal(await status(page), "running");
  await context.close();
});

t("after four focus sessions a long break is suggested", async () => {
  const { context, page } = await open();
  await setLengths(page, 1);
  const seen = [];
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press("1"); await page.keyboard.press("Space"); await jump(page, 61_000);
    seen.push(await page.locator("#go").innerText());
  }
  assert.deepEqual(seen, ["Start short break", "Start short break", "Start short break", "Start long break"]);
  assert.equal(await page.locator("#dots li").count(), 4);
  await context.close();
});

t("the glass drains in step with the clock: full, about half, empty", async () => {
  const { context, page } = await open();
  await setLengths(page, 2);
  await page.keyboard.press("Space");
  await advance(page, 1000); await advance(page, 1000);
  const early = await level(page);
  await advance(page, 58_000);
  for (let i = 0; i < 20; i++) await advance(page, 100); // let the surface settle
  const half = await level(page);
  await advance(page, 61_000);
  for (let i = 0; i < 30; i++) await advance(page, 100);
  const end = await level(page);
  assert.ok(early > 0.9, `early ${early}`);
  assert.ok(half > 0.4 && half < 0.6, `half ${half}`);
  assert.ok(end < 0.1, `end ${end}`);
  await context.close();
});

t("keyboard: 1 2 3 switch worlds, R resets, S opens lengths, M toggles sound; shortcuts stay quiet while typing", async () => {
  const { context, page } = await open();
  await page.keyboard.press("2"); assert.equal(await mode(page), "short"); assert.equal(await digits(page), "05:00");
  await page.keyboard.press("3"); assert.equal(await mode(page), "long"); assert.equal(await digits(page), "15:00");
  await page.keyboard.press("1"); await page.keyboard.press("Space"); await advance(page, 5000);
  await page.keyboard.press("r");
  assert.deepEqual([await status(page), await digits(page)], ["idle", "25:00"]);
  assert.equal(await page.locator("#sound").getAttribute("aria-pressed"), "false");
  await page.keyboard.press("m");
  assert.equal(await page.locator("#sound").getAttribute("aria-pressed"), "true");
  await page.keyboard.press("m");
  await page.keyboard.press("s");
  assert.equal(await page.locator("#settings").evaluate((d) => d.open), true);
  await page.keyboard.type("r2 m"); // typing into the field must not trigger shortcuts
  assert.equal(await mode(page), "focus");
  assert.equal(await page.locator("#sound").getAttribute("aria-pressed"), "false");
  await context.close();
});

t("Space on a focused button presses that button only (no double toggle)", async () => {
  const { context, page } = await open();
  await page.locator("#reset").focus();
  await page.keyboard.press("Space");
  assert.equal(await status(page), "idle", "Space on Reset did not start the timer");
  await page.locator("#go").focus(); await page.keyboard.press("Space");
  assert.equal(await status(page), "running", "Space on Start started it once");
  await context.close();
});

t("the mode switch is a proper radio group: arrow keys move and select, one tab stop", async () => {
  const { context, page } = await open();
  await page.locator('#modes button[aria-checked="true"]').focus();
  await page.keyboard.press("ArrowRight");
  assert.equal(await mode(page), "short");
  assert.equal(await page.evaluate(() => document.activeElement.dataset.mode), "short");
  await page.keyboard.press("ArrowLeft"); await page.keyboard.press("ArrowLeft");
  assert.equal(await mode(page), "long", "wraps around");
  const stops = await page.locator("#modes button").evaluateAll((bs) => bs.filter((b) => b.tabIndex === 0).length);
  assert.equal(stops, 1);
  await context.close();
});

t("each mode is its own world: the liquid colours really change", async () => {
  const { context, page } = await open({ clock: false });
  const colour = () => page.evaluate(() => getComputedStyle(document.body).getPropertyValue("--liq-b").trim());
  const focus = await colour();
  await page.keyboard.press("2"); await page.waitForTimeout(1300);
  const short = await colour();
  await page.keyboard.press("3"); await page.waitForTimeout(1300);
  const long = await colour();
  assert.equal(new Set([focus, short, long]).size, 3, JSON.stringify({ focus, short, long }));
  await context.close();
});

t("lengths: saved, clamped, applied at once, kept after reload; Cancel and Escape change nothing", async () => {
  const { context, page } = await open();
  await setLengths(page, 50, 10, 20);
  assert.equal(await digits(page), "50:00");
  await page.reload(); await page.waitForFunction(() => window.__tide); await advance(page, 300);
  assert.equal(await digits(page), "50:00", "survives a reload");
  await page.keyboard.press("2"); assert.equal(await digits(page), "10:00");
  await page.keyboard.press("s");
  await page.locator("input[name=focus]").fill("999"); await page.locator("input[name=short]").fill("0");
  await save(page);
  await page.keyboard.press("1"); assert.equal(await digits(page), "120:00", "999 is clamped to 120");
  await page.keyboard.press("2"); assert.equal(await digits(page), "01:00", "0 is clamped to 1");
  await page.keyboard.press("s"); await page.locator("input[name=focus]").fill("7");
  await cancel(page);
  await page.keyboard.press("1"); assert.equal(await digits(page), "120:00", "Cancel kept the old value");
  await page.keyboard.press("s"); await page.locator("input[name=focus]").fill("7"); await page.keyboard.press("Escape"); await closed(page);
  assert.equal(await page.locator("#settings").evaluate((d) => d.open), false);
  assert.equal(await digits(page), "120:00", "Escape kept the old value");
  await context.close();
});

t("a running session is not cut short by changing its length", async () => {
  const { context, page } = await open();
  await page.keyboard.press("Space"); await advance(page, 30_000);
  await page.keyboard.press("s"); await page.locator("input[name=focus]").fill("5"); await save(page);
  assert.equal(await digits(page), "24:30");
  await context.close();
});

t("it still works when the browser refuses to store anything", async () => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  opened.push(context);
  await context.addInitScript(() => { Object.defineProperty(window, "localStorage", { get() { throw new Error("blocked"); } }); });
  const page = await context.newPage();
  const problems = []; page.on("pageerror", (e) => problems.push(e.message));
  await page.goto(base); await page.waitForFunction(() => window.__tide);
  await setLengths(page, 30);
  assert.equal(await digits(page), "30:00");
  await page.keyboard.press("Space"); await page.waitForTimeout(1200);
  assert.equal(await status(page), "running");
  assert.deepEqual(problems, []);
  await context.close();
});

t("the digits roll: a change shows two layers briefly, then exactly one; many quick changes never pile up", async () => {
  const { context, page } = await open({ clock: false });
  await page.keyboard.press("Space");
  await page.waitForFunction(() => [...document.querySelectorAll("#digits .d")].some((c) => c.children.length === 2), null, { timeout: 4000 });
  await page.waitForTimeout(700);
  assert.deepEqual(await page.locator("#digits .d").evaluateAll((cs) => cs.map((c) => c.children.length)), [1, 1, 1, 1]);
  for (const k of ["2", "3", "1", "2", "3", "1"]) await page.keyboard.press(k); // six quick changes
  const max = await page.locator("#digits .d").evaluateAll((cs) => Math.max(...cs.map((c) => c.children.length)));
  assert.ok(max <= 2, `at most two layers at once, saw ${max}`);
  await context.close();
});

t("the liquid is alive: frames keep coming, the picture changes between frames, and the speed is reported", async () => {
  const { context, page } = await open({ clock: false });
  await page.keyboard.press("Space");
  const f0 = await page.evaluate(() => window.__tide.liquid.stats().frames);
  const a = await canvasStats(page);
  await page.waitForTimeout(1000);
  const f1 = await page.evaluate(() => window.__tide.liquid.stats().frames);
  const b = await canvasStats(page);
  const fps = f1 - f0;
  console.log(`      measured about ${fps} frames per second in this (software-rendered) browser`);
  assert.ok(fps >= 5, `animation loop is running: ${fps} frames in 1 s`); // software rendering is slow; a real GPU is far faster
  assert.notEqual(a.sum, b.sum, "the canvas picture changed between two moments");
  await context.close();
});

t("touching the glass makes ripples and stirs the water", async () => {
  const { context, page } = await open({ clock: false });
  const box = await page.locator("#liquid").boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down(); await page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2 + 10, { steps: 4 }); await page.mouse.up();
  assert.ok((await page.evaluate(() => window.__tide.liquid.stats().ripples)) > 0);
  await page.waitForFunction(() => window.__tide.liquid.stats().ripples === 0, null, { timeout: 8000 }); // they fade away
  await context.close();
});

t("buttons lean toward the pointer, settle when it leaves, and leave a ripple on click that cleans up after itself", async () => {
  const { context, page } = await open({ clock: false });
  const b = await page.locator("#go").boundingBox();
  await page.mouse.move(b.x + b.width + 30, b.y + b.height / 2, { steps: 5 });
  await page.waitForTimeout(400);
  const near = await page.locator("#go").evaluate((e) => getComputedStyle(e).transform);
  assert.notEqual(near, "none", "pulled toward the pointer");
  await page.mouse.move(20, 20, { steps: 5 }); await page.waitForTimeout(500);
  const far = await page.locator("#go").evaluate((e) => new DOMMatrix(getComputedStyle(e).transform).e);
  assert.ok(Math.abs(far) < 0.5, `back in place: ${far}`);
  await page.locator("#reset").click();
  assert.equal(await page.locator("#reset .ripple").count() <= 1, true);
  await page.waitForFunction(() => document.querySelectorAll(".ripple").length === 0, null, { timeout: 5000 }); // removed after it plays
  await context.close();
});

t("reduced motion: no animation loop, no drifting sky, no rolling digits, but the glass is still drawn and the timer works", async () => {
  const { context, page, problems } = await open({ clock: false, reducedMotion: "reduce" });
  await page.keyboard.press("Space"); await page.waitForTimeout(2300);
  const st = await page.evaluate(() => window.__tide.liquid.stats());
  assert.deepEqual([st.frames, st.running], [0, false]);
  const s = await canvasStats(page);
  assert.ok(s.nonEmpty > 200 && s.colours > 5, "still drawn");
  assert.equal(await page.locator(".o1").evaluate((e) => getComputedStyle(e).animationName), "none");
  assert.equal(await page.locator(".vessel").evaluate((e) => getComputedStyle(e).animationName), "none");
  assert.match(await digits(page), /^24:5\d|24:4\d$/);
  assert.deepEqual(await page.locator("#digits .d").evaluateAll((cs) => cs.map((c) => c.children.length)), [1, 1, 1, 1], "digits change without a roll");
  assert.deepEqual(problems, []);
  await context.close();
});

t("accessibility: nothing serious in any world, with the dialog open, or on a finished session", async () => {
  const axeSource = fs.readFileSync(new URL("../node_modules/axe-core/axe.min.js", import.meta.url), "utf8");
  const { context, page } = await open({ bypassCSP: true });
  const run = async (label) => {
    await page.evaluate(axeSource);
    const res = await page.evaluate(() => axe.run(document, { runOnly: ["wcag2a", "wcag2aa", "wcag21aa", "best-practice"] }));
    assert.deepEqual(res.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`), [], label);
  };
  for (const k of ["1", "2", "3"]) { await page.keyboard.press(k); await advance(page, 1200); await run(`mode ${k}`); }
  await page.keyboard.press("1"); await page.keyboard.press("s"); await run("settings dialog");
  await page.keyboard.press("Escape"); await closed(page);
  await setLengths(page, 1); await page.keyboard.press("Space"); await jump(page, 62_000); await run("finished session");
  const roles = await page.evaluate(() => ({ timer: !!document.querySelector('[role="timer"][aria-label]'), group: !!document.querySelector('[role="radiogroup"][aria-label]'), live: !!document.querySelector('[role="status"][aria-live="polite"]'), h1: document.querySelectorAll("h1").length }));
  assert.deepEqual(roles, { timer: true, group: true, live: true, h1: 1 });
  await context.close();
});

t("the spoken time reads naturally for screen readers and updates each second", async () => {
  const { context, page } = await open();
  assert.equal(await page.locator("#spoken").innerText(), "25 minutes 0 seconds");
  await page.keyboard.press("Space"); await advance(page, 61_000);
  assert.equal(await page.locator("#spoken").innerText(), "23 minutes 59 seconds");
  await context.close();
});

t("phone: nothing overflows sideways, controls are at least 44px, the glass fits above the buttons", async () => {
  const { context, page } = await open({ viewport: { width: 375, height: 700 }, hasTouch: true, isMobile: true });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, "no horizontal scroll");
  for (const sel of ["#go", "#reset", "#sound", "#open-settings", '#modes button[data-mode="focus"]', '#modes button[data-mode="long"]']) {
    const box = await page.locator(sel).boundingBox();
    assert.ok(box.height >= 44 - 0.5 && box.width >= 44 - 0.5, `${sel} is ${Math.round(box.width)}x${Math.round(box.height)}`);
    assert.ok(box.x >= 0 && box.x + box.width <= 376, `${sel} fits the screen`);
  }
  const v = await page.locator("#vessel").boundingBox(), g = await page.locator("#go").boundingBox();
  assert.ok(v.y + v.height <= g.y + 1, "the glass does not run into the buttons");
  await page.getByRole("button", { name: "Start" }).tap();
  assert.equal(await status(page), "running");
  await context.close();
});

t("200% text zoom and a short window still work: controls reachable, no overlap of readout and buttons", async () => {
  const { context, page } = await open({ viewport: { width: 700, height: 420 } });
  const v = await page.locator("#vessel").boundingBox();
  assert.ok(v.width > 120, `glass not squashed away: ${v.width}`);
  await page.locator("#go").scrollIntoViewIfNeeded();
  assert.ok(await page.locator("#go").isVisible());
  await context.close();
});

t("the page serves only its own files and loads nothing from elsewhere", async () => {
  const context = await browser.newContext();
  opened.push(context);
  const page = await context.newPage();
  const urls = []; page.on("request", (r) => urls.push(r.url()));
  await page.goto(base); await page.waitForTimeout(800);
  assert.ok(urls.every((u) => u.startsWith(new URL(base).origin)), urls.join(","));
  assert.equal((await fetch(base + "scripts/serve.js")).status, 404);
  assert.equal((await fetch(base + "package.json")).status, 404);
  await context.close();
});
