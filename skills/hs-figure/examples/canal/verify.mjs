// Checks the built figure in a real browser. Needs Chrome or Chromium and playwright-core.
//   CHROME_PATH=/path/to/chrome node verify.mjs [--page canal.html] [--out screenshots-dir]
// If playwright-core is not installed next to this file, set PLAYWRIGHT_CORE to the folder that holds it.
// Exits 1 with a list of what failed. Takes about 20 seconds because it waits to see the idle tour start (and not start).
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { buildPage } from "./build.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const arg = (name, dflt) => (process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : dflt);
const outDir = arg("--out", null);
let chromium;
try {
  const spec = process.env.PLAYWRIGHT_CORE ? pathToFileURL(path.join(process.env.PLAYWRIGHT_CORE, "index.mjs")).href : "playwright-core";
  ({ chromium } = await import(spec));
} catch { console.error("playwright-core is not installed. Run `npm i playwright-core` in a scratch folder and set PLAYWRIGHT_CORE to its node_modules/playwright-core, or install it next to this file."); process.exit(2); }
if (!process.env.CHROME_PATH) { console.error("Set CHROME_PATH to a Chrome or Chromium binary."); process.exit(2); }

// Build into a scratch folder so the check always tests the current source.
const tmp = fs.mkdtempSync(path.join(process.env.TMPDIR || "/tmp", "figure-verify-"));
const page0 = path.join(tmp, "canal.html");
fs.writeFileSync(page0, buildPage().html);
const url = pathToFileURL(arg("--page", page0)).href;

const failures = [];
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"}  ${what}`); if (!ok) failures.push(what); };
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH, args: ["--no-sandbox"] });

async function open(opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 760 }, ...opts });
  const p = await ctx.newPage(); const problems = [], requests = [];
  p.on("console", (m) => { if (["error", "warning"].includes(m.type())) problems.push(m.text()); });
  p.on("pageerror", (e) => problems.push("pageerror: " + e.message));
  p.on("request", (r) => { if (!r.url().startsWith("file:") && !r.url().startsWith("data:")) requests.push(r.url()); });
  await p.goto(url); await p.waitForFunction(() => window.__figure);
  return { ctx, p, problems, requests };
}
const readout = (p) => p.textContent("#fig-readout");
const shot = async (p, name) => { if (outDir) { fs.mkdirSync(outDir, { recursive: true }); await p.screenshot({ path: path.join(outDir, name) }); } };

// 1. loads cleanly and asks for nothing
{
  const { ctx, p, problems, requests } = await open();
  check(problems.length === 0, `loads with no console error or warning ${problems.length ? JSON.stringify(problems) : ""}`);
  check(requests.length === 0, `makes no network request ${requests.length ? JSON.stringify(requests) : ""}`);
  check(/^Phase 1 of 9/.test(await readout(p)), "starts at phase 1");
  check((await p.locator("#fig-scene > g").count()) > 100, "draws more than a hundred parts");
  await shot(p, "start.png");

  // 2. keyboard and click
  await p.locator("#fig-stage").focus();
  await p.keyboard.press("Space");
  check(/1 of \d+ checks/.test(await readout(p)), "Space passes one check");
  await p.keyboard.press("Enter");
  check(/^Phase 2 of 9/.test(await readout(p)), "Enter passes the rest of the phase and moves on");
  check(/Phase 2 of 9: Plan/.test(await p.textContent("#fig-live")), "the live region announces the new phase");
  await p.locator("#fig-stage").click({ position: { x: 100, y: 100 } });
  check(/1 of \d+ checks/.test(await readout(p)), "a click passes a check");
  await p.keyboard.press("r");
  check(/^Phase 1 of 9: Research, 0 of/.test(await readout(p)), "R starts over");
  for (let i = 0; i < 80; i++) await p.keyboard.press("Enter");
  await p.waitForTimeout(3500);
  check(/^All 9 phases clear/.test(await readout(p)), "it can be finished");
  const lamps = await p.evaluate(() => [...document.querySelectorAll('[data-id^="lamp-"] ellipse')].map((e) => e.getAttribute("fill")));
  check(lamps.length === 9 && new Set(lamps).size === 1, "when finished every lamp shows the same colour");
  await shot(p, "done.png");
  await ctx.close();
}

// 2b. the idle tour starts by itself
{
  const { ctx, p } = await open();
  await p.waitForTimeout(7000);
  check(!/^Phase 1 of 9: Research, 0 of/.test(await readout(p)), "left alone for a few seconds, it plays itself");
  await ctx.close();
}

// 3. reduced motion: no tour, no animation, the state is reached at once
{
  const { ctx, p, problems } = await open({ reducedMotion: "reduce" });
  await p.waitForTimeout(7000);
  check(/^Phase 1 of 9: Research, 0 of/.test(await readout(p)), "reduced motion: it does not play itself");
  await p.locator("#fig-stage").focus(); await p.keyboard.press("Enter");
  // one frame is enough when nothing is animated; the normal animation would take over a second
  const instant = await p.waitForFunction(() => window.__figure.anim.open[0] === 1, null, { timeout: 400 }).then(() => true, () => false);
  check(instant, "reduced motion: the first gate is open within one frame, with nothing animated");
  check(problems.length === 0, "reduced motion: no console problems");
  await ctx.close();
}

// 4. dark mode and a phone
{
  const { ctx, p } = await open({ colorScheme: "dark", viewport: { width: 390, height: 760 } });
  const overflow = await p.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  check(!overflow, "phone width: the page itself does not scroll sideways");
  const frame = await p.evaluate(() => { const st = document.getElementById("fig-stage"), sv = st.querySelector("svg"); return { scrolls: st.scrollWidth > st.clientWidth + 1, svgWidth: sv.getBoundingClientRect().width }; });
  check(frame.scrolls && frame.svgWidth >= 700, `phone width: the drawing keeps a readable size and scrolls inside its frame (${Math.round(frame.svgWidth)}px wide)`);
  const bg = await p.evaluate(() => getComputedStyle(document.body).backgroundColor);
  check(bg === "rgb(20, 17, 15)", `dark mode follows the system setting (${bg})`);
  await shot(p, "phone-dark.png");
  await ctx.close();
}

await browser.close();
fs.rmSync(tmp, { recursive: true, force: true });
console.log(failures.length ? `\n${failures.length} check(s) failed` : "\nall checks passed");
process.exit(failures.length ? 1 : 0);
