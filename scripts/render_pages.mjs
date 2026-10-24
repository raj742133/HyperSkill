// Renders the picture previews that need a browser: font-pairing cards (fonts fetched from Google Fonts at build time, only the
// resulting image is kept) and screenshots of the Hyperfigure example pages.
//   python3 scripts/fetch_font_css.py FONTCSS_DIR      (once; fonts are inlined there, not kept in the repository)
//   PW=path/to/playwright-core/index.mjs CHROME_PATH=... FONTCSS=FONTCSS_DIR OUT=site/live/previews node scripts/render_pages.mjs [fonts|figures]
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const { chromium } = await import(process.env.PW || "playwright-core");
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const OUT = path.resolve(process.env.OUT || path.join(ROOT, "site/live/previews"));
const what = process.argv[2] || "all";
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "hs-pages-"));
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH, args: ["--no-sandbox", "--disable-gpu"] });

function csv(text) {  // small RFC-4180 reader: quoted fields, doubled quotes, newlines inside quotes
  const rows = []; let row = [], f = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true; else if (c === ",") { row.push(f); f = ""; }
    else if (c === "\n") { row.push(f); rows.push(row); row = []; f = ""; } else if (c !== "\r") f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  const [h, ...r] = rows;
  return r.filter((x) => x.length === h.length).map((x) => Object.fromEntries(h.map((k, i) => [k, x[i]])));
}
const toWebp = (png, out, width) => execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", png, "-vf", `scale=${width}:-2`, "-c:v", "libwebp", "-quality", "78", out]);

if (what === "all" || what === "fonts") {
  const rows = csv(fs.readFileSync(path.join(ROOT, "packs/ui-ux-pro-max/skills/ui-ux-pro-max/data/typography.csv"), "utf8"));
  fs.mkdirSync(path.join(OUT, "uu-fonts"), { recursive: true });
  const page = await (await browser.newContext({ viewport: { width: 480, height: 200 } })).newPage();
  let ok = 0;
  for (const r of rows) {
    const cssFile = process.env.FONTCSS ? path.join(process.env.FONTCSS, slug(r["Font Pairing Name"]) + ".css") : "";
    const face = cssFile && fs.existsSync(cssFile) ? fs.readFileSync(cssFile, "utf8") : "";
    const html = `<style>${face}body{margin:0;background:#fffdf8;color:#1b1713;width:480px;height:200px;box-sizing:border-box;padding:22px 26px;overflow:hidden}
      .a{font:700 40px/1.1 '${r["Heading Font"]}',serif;margin:0 0 6px}.b{font:400 15px/1.45 '${r["Body Font"]}',sans-serif;margin:0 0 12px;color:#4a443d}
      .m{font:600 11px ui-monospace,monospace;color:#8b8176;letter-spacing:.04em}</style>
      <p class="a">Aa Quick fox</p><p class="b">The quick brown fox jumps over the lazy dog, 0123456789.</p>
      <p class="m">${r["Heading Font"]} + ${r["Body Font"]}</p>`;
    try {
      await page.setContent(html, { waitUntil: "load", timeout: 20000 });
      await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(250);
      const png = path.join(TMP, "f.png"); await page.screenshot({ path: png });
      toWebp(png, path.join(OUT, "uu-fonts", slug(r["Font Pairing Name"]) + ".webp"), 480); ok++;
    } catch (e) { console.log("FONT FAILED", r["Font Pairing Name"], String(e).slice(0, 80)); }
  }
  console.log("fonts", ok, "of", rows.length);
}

if (what === "all" || what === "figures") {
  const base = path.join(ROOT, "skills/hyperfigure/examples");
  fs.mkdirSync(path.join(OUT, "figures"), { recursive: true });
  const page = await (await browser.newContext({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: 1 })).newPage();
  for (const d of fs.readdirSync(base)) {
    const html = path.join(base, d, d + "-light.html");
    const file = fs.existsSync(html) ? html : path.join(base, d, d + ".html");
    if (!fs.existsSync(file)) { console.log("no page for", d); continue; }
    try {
      await page.goto("file://" + file, { waitUntil: "load", timeout: 30000 }); await page.waitForTimeout(2200);
      const png = path.join(TMP, "g.png"); const plate = page.locator(".iso-plate").first();
      if (await plate.count()) await plate.screenshot({ path: png }); else await page.screenshot({ path: png, clip: { x: 150, y: 60, width: 900, height: 700 } });
      toWebp(png, path.join(OUT, "figures", d + ".webp"), 640); console.log("ok figures/" + d);
    } catch (e) { console.log("FIG FAILED", d, String(e).slice(0, 80)); }
  }
}
await browser.close();
