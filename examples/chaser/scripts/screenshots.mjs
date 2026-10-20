// Regenerates docs/screenshots/*.png from the running app. Usage: CHROME_PATH=... node scripts/screenshots.mjs
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright-core";
import { loadConfig } from "../src/config.js";
import { createServer } from "../src/server.js";

const out = new URL("../docs/screenshots/", import.meta.url).pathname;
const shift = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const server = createServer(loadConfig({ OPERATOR_TOKEN: "s".repeat(32), NODE_ENV: "test", DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), "chaser-shot-")), OPERATOR_NAME: "Demo Operator", OPERATOR_CONTACT: "demo@example.org", TEST_END_DATE: "2026-12-31" }));
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}/?src=me`;
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH, args: ["--no-sandbox", "--disable-gpu"] });
const fields = { me: "Asha Rao", client: "Ravi Traders", amount: "1,25,000.50", invoice: "INV-12", due: shift(-18), deadline: shift(7), pay: "asha@okaxis" };
for (const [name, viewport, colorScheme] of [["desktop-light", { width: 1100, height: 900 }, "light"], ["phone-light", { width: 390, height: 844 }, "light"], ["phone-dark", { width: 390, height: 844 }, "dark"]]) {
  const ctx = await browser.newContext({ viewport, colorScheme, deviceScaleFactor: 2, userAgent: "Mozilla/5.0 Chrome/120 Mobile Safari/537.36", locale: "en-US" });
  const page = await ctx.newPage();
  await page.goto(base);
  await page.screenshot({ path: out + `${name}-1-form.png` });
  for (const [k, v] of Object.entries(fields)) await page.locator("#" + k).fill(v);
  await page.getByRole("button", { name: "Write my messages" }).click();
  await page.locator("#results").waitFor();
  await page.waitForTimeout(500);
  await page.locator("#results").screenshot({ path: out + `${name}-2-results.png` });
  await page.getByRole("button", { name: "I would pay for this" }).click();
  await page.locator("#door").screenshot({ path: out + `${name}-3-door.png` });
  await ctx.close();
}
await browser.close(); server.close();
