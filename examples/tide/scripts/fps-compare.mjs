// Frames per second of the liquid, before and after a change. Usage: CHROME_PATH=... BEFORE=<folder of the old build> AFTER=<folder of the new build> node scripts/fps-compare.mjs
// Make the old build with: git worktree add /tmp/old <commit>, then BEFORE=/tmp/old/examples/tide. Prints three runs of each, alternating, in the same browser.
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
import { chromium } from "playwright-core";
const T = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml" };
const serve = (root) => new Promise((res) => { const s = http.createServer((q, r) => { let u = q.url.split("?")[0]; if (u === "/") u = "/index.html"; const f = path.join(root, u);
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); } r.writeHead(200, { "content-type": T[path.extname(f)] || "text/plain" }); r.end(fs.readFileSync(f)); }).listen(0, "127.0.0.1", () => res(s)); });
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH, args: ["--no-sandbox", "--disable-gpu"] });
async function fps(root) {
  const s = await serve(root); const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } }); const p = await ctx.newPage();
  await p.goto(`http://127.0.0.1:${s.address().port}/`); await p.waitForFunction(() => window.__tide); await p.keyboard.press("Space"); await p.waitForTimeout(1500);
  const f0 = await p.evaluate(() => window.__tide.liquid.stats().frames); await p.waitForTimeout(5000); const f1 = await p.evaluate(() => window.__tide.liquid.stats().frames);
  await ctx.close(); s.close(); return (f1 - f0) / 5;
}
const before = process.env.BEFORE, after = process.env.AFTER; const out = { before: [], after: [] };
for (let i = 0; i < 3; i++) { out.before.push(await fps(before)); out.after.push(await fps(after)); }
await b.close(); console.log(JSON.stringify(out));
