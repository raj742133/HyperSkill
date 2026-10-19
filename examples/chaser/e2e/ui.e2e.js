// Browser tests against the real server. Needs a Chromium: CHROME_PATH=/path/to/chrome npm run test:e2e
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright-core";
import { loadConfig } from "../src/config.js";
import { createServer } from "../src/server.js";

const TOKEN = "e".repeat(32);
const UA = "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36";
const today = () => { const d = new Date(), p = (n) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };
const shift = (days) => { const d = new Date(); d.setDate(d.getDate() + days); const p = (n) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };

let browser, open, closed, dirOpen;
async function serve(env) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "chaser-e2e-"));
  const server = createServer(loadConfig({ OPERATOR_TOKEN: TOKEN, NODE_ENV: "test", DATA_DIR: dir, ...env }));
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  return { base: `http://127.0.0.1:${server.address().port}`, dir, close: () => new Promise((r) => server.close(r)) };
}
before(async () => {
  browser = await chromium.launch({ executablePath: process.env.CHROME_PATH, args: ["--no-sandbox", "--disable-gpu"] });
  open = await serve({ OPERATOR_NAME: "Test Operator", OPERATOR_CONTACT: "ops@example.org", TEST_END_DATE: "2026-12-31", ALLOWED_SRC: "me,post" });
  closed = await serve({ ALLOWED_SRC: "me,post" });
  dirOpen = open.dir;
});
after(async () => { await browser?.close(); await open?.close(); await closed?.close(); });

async function newPage(server = open, opts = {}) {
  const context = await browser.newContext({ userAgent: UA, viewport: { width: 1000, height: 900 }, ...opts });
  const page = await context.newPage();
  const problems = [];
  page.on("console", (m) => { if (["error", "warning"].includes(m.type())) problems.push(m.text()); });
  page.on("pageerror", (e) => problems.push("pageerror: " + e.message));
  await page.goto(server.base + "/?src=post");
  await page.waitForFunction(() => document.getElementById("form"));
  return { context, page, problems };
}
async function fill(page, over = {}) {
  const v = { me: "Asha Rao", client: "Ravi Traders", amount: "1,25,000.50", invoice: "INV-12", due: shift(-18), deadline: shift(7), pay: "asha@okaxis", ...over };
  for (const [k, val] of Object.entries(v)) await page.locator("#" + k).fill(val);
  return v;
}
const generate = async (page, over) => { const v = await fill(page, over); await page.getByRole("button", { name: "Write my messages" }).click(); return v; };
const stats = async (server) => (await fetch(server.base + "/api/stats", { headers: { authorization: `Bearer ${TOKEN}` } })).json();

test("happy path: three messages with the right amount, dates and working send links", async () => {
  const { context, page, problems } = await newPage();
  await generate(page);
  await page.locator("#results").waitFor();
  assert.match(await page.locator("#summary").innerText(), /18 days overdue/);
  const check = await page.locator("#check").innerText();
  for (const s of ["Rs 1,25,000.50", "asha@okaxis"]) assert.ok(check.includes(s), s);
  assert.equal(await page.locator("article.msg").count(), 3);
  const polite = await page.locator("#wa-polite").inputValue();
  assert.match(polite, /^Hi Ravi Traders,/);
  assert.match(polite, /Rs 1,25,000\.50/);
  const href = await page.locator("article.msg").first().getByRole("link", { name: "Open in WhatsApp" }).getAttribute("href");
  assert.ok(href.startsWith("https://wa.me/?text="));
  assert.equal(decodeURIComponent(href.slice(20)), polite);
  const link = page.locator("article.msg").first().getByRole("link", { name: "Open in WhatsApp" });
  assert.equal(await link.getAttribute("rel"), "noopener noreferrer");
  assert.equal(await link.getAttribute("target"), "_blank");
  assert.match(await page.locator("#wa-final").inputValue(), /pay further work|pause further work/);
  assert.deepEqual(problems, []);
  await context.close();
});

test("results: the suggested message is marked, every message is fully visible, only the suggested one has the green button", async () => {
  const { context, page } = await newPage();
  await generate(page, { due: shift(-18) }); // 18 days late
  await page.locator("#results").waitFor();
  assert.match(await page.locator("#summary").innerText(), /Suggested: start with Firm/);
  const cards = page.locator("article.msg");
  assert.equal(await cards.nth(1).getAttribute("class"), "card msg suggested");
  assert.equal(await cards.nth(1).locator(".tag").innerText(), "Suggested");
  assert.equal(await page.locator(".tag").count(), 1);
  assert.equal(await page.locator("article.msg a.btn:not(.quiet)").count() >= 1, true);
  assert.equal(await cards.nth(0).getByRole("link", { name: "Open in WhatsApp" }).getAttribute("class"), "btn quiet");
  for (const id of ["wa-polite", "wa-firm", "wa-final"]) {
    const clipped = await page.locator("#" + id).evaluate((t) => t.scrollHeight > t.clientHeight + 2);
    assert.equal(clipped, false, `${id} is cut off`);
  }
  assert.match(await page.locator("#check").innerText(), /Client\s*Ravi Traders/);
  for (const [days, want] of [[2, "Polite"], [10, "Firm"], [30, "Final"]]) {
    await page.locator("#due").fill(shift(-days)); await page.getByRole("button", { name: "Write my messages" }).click();
    assert.match(await page.locator("#summary").innerText(), new RegExp(`start with ${want}`), `${days} days`);
  }
  await context.close();
});

test("the pay-by date starts a week from today", async () => {
  const { context, page } = await newPage();
  assert.equal(await page.locator("#deadline").inputValue(), shift(7));
  await context.close();
});

test("editing a message updates its WhatsApp link", async () => {
  const { context, page } = await newPage();
  await generate(page);
  await page.locator("#wa-firm").fill("My own words, Rs 5 only");
  const href = await page.locator("article.msg").nth(1).getByRole("link", { name: "Open in WhatsApp" }).getAttribute("href");
  assert.equal(decodeURIComponent(href.slice(20)), "My own words, Rs 5 only");
  await context.close();
});

test("validation: an error summary takes focus, fields are marked invalid, links jump to the field, errors clear when fixed", async () => {
  const { context, page } = await newPage();
  await page.getByRole("button", { name: "Write my messages" }).click();
  const summary = page.locator("#errors");
  await summary.waitFor();
  assert.equal(await summary.evaluate((n) => n === document.activeElement), true, "focus moves to the error summary");
  assert.match(await summary.innerText(), /4 things need fixing/); // the pay-by date starts filled in
  for (const f of ["me", "client", "amount", "due"]) assert.equal(await page.locator("#" + f).getAttribute("aria-invalid"), "true", f);
  await summary.getByRole("link", { name: /name/i }).first().click();
  assert.equal(await page.locator("#me").evaluate((n) => n === document.activeElement), true);
  assert.equal(await page.locator("#results").isHidden(), true);
  await generate(page);
  await page.locator("#results").waitFor();
  assert.equal(await summary.isHidden(), true);
  assert.equal(await page.locator("#amount").getAttribute("aria-invalid"), null);
  await context.close();
});

test("validation: bad amount, bad UPI, past pay-by date, line break in a name", async () => {
  const { context, page } = await newPage();
  await generate(page, { amount: "0", pay: "call me", deadline: shift(-1), client: "A" });
  const t = await page.locator("#errors").innerText();
  assert.match(t, /amount as a number/);
  assert.match(t, /UPI ID/);
  assert.match(t, /has passed/);
  await context.close();
});

test("an invoice that is not due yet gets the friendly summary and no 'overdue' wording", async () => {
  const { context, page } = await newPage();
  await generate(page, { due: shift(5) });
  assert.match(await page.locator("#summary").innerText(), /not overdue yet/);
  assert.ok(!/overdue|haven't received/i.test(await page.locator("#messages").innerText() + (await page.locator("#wa-firm").inputValue())));
  await context.close();
});

test("hostile text is shown as text and never runs", async () => {
  const { context, page, problems } = await newPage();
  await generate(page, { client: '<img src=x onerror="window.__xss=1">', me: "<script>window.__xss=1</script>" });
  await page.locator("#results").waitFor();
  assert.equal(await page.evaluate(() => window.__xss), undefined);
  assert.ok((await page.locator("#wa-polite").inputValue()).includes('<img src=x onerror="window.__xss=1">'));
  assert.equal(await page.locator("#messages img").count(), 0);
  await page.locator("article.msg").first().locator("summary").click();
  assert.equal(await page.locator("#messages script").count(), 0);
  assert.deepEqual(problems, []);
  await context.close();
});

test("privacy: generating messages sends no form data anywhere and contacts no other site", async () => {
  const { context, page } = await newPage();
  const requests = [];
  page.on("request", (r) => requests.push({ url: r.url(), body: r.postData() ?? "" }));
  const v = await generate(page, { client: "UNIQUE-CLIENT-NAME", amount: "98765.43", invoice: "UNIQUE-INV-77", pay: "unique.upi@okaxis" });
  await page.locator("#results").waitFor();
  await page.locator("article.msg").first().locator("summary").click();
  await page.getByRole("button", { name: "Copy text" }).first().click();
  await page.waitForTimeout(400);
  const origin = new URL(open.base).origin;
  for (const r of requests) {
    assert.ok(r.url.startsWith(origin), "only our own origin: " + r.url);
    for (const secret of [v.client, "98765", v.invoice, v.pay, v.me]) assert.ok(!r.url.includes(secret) && !r.body.includes(secret), `${secret} leaked to ${r.url}`);
  }
  const api = requests.filter((r) => r.url.includes("/api/")).map((r) => `${new URL(r.url).pathname} ${JSON.parse(r.body || "{}").event ?? ""}`);
  assert.deepEqual(api.filter((a) => a !== "/api/config "), ["/api/event page_ready", "/api/event generate", "/api/event copy"].filter((e) => api.includes(e)), "only counters, no form data");
  assert.ok(api.every((a) => a === "/api/config " || a.startsWith("/api/event ")), "no other API call: " + api);
  const stored = fs.readdirSync(dirOpen).map((f) => fs.readFileSync(path.join(dirOpen, f), "utf8")).join("\n");
  for (const secret of ["UNIQUE-CLIENT-NAME", "98765", "UNIQUE-INV-77", "unique.upi"]) assert.ok(!stored.includes(secret), secret + " reached the disk");
  assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length + document.cookie.length), 0, "nothing stored in the browser");
  await context.close();
});

test("offline: messages still generate, sending the email list says so plainly", async () => {
  const { context, page } = await newPage();
  await generate(page);
  await page.locator("#results").waitFor();
  await context.setOffline(true);
  await page.getByRole("button", { name: "I would pay for this" }).click();
  await page.locator("#email").fill("asha@example.org");
  await page.getByRole("button", { name: "Tell me when it is ready" }).click();
  await page.getByText("Can't reach the server").waitFor();
  assert.equal(await page.locator("#email").inputValue(), "asha@example.org", "typed email kept");
  await context.setOffline(false);
  await page.getByRole("button", { name: "Tell me when it is ready" }).click();
  await page.getByText("Thanks. You are on the list.").waitFor();
  await context.close();
});

test("the paid-plan question: counts intent, shows the notice, takes an email once, and says nothing is sold", async () => {
  const { context, page } = await newPage();
  await generate(page);
  assert.match(await page.locator("#door").innerText(), /Coming soon/);
  assert.match(await page.locator("#price").innerText(), /Rs 149 a month/);
  await page.getByRole("button", { name: "I would pay for this" }).click();
  const notice = await page.locator("#wl-notice").innerText();
  for (const s of ["Test Operator", "ops@example.org", "31 Dec 2026", "IP addresses"]) assert.ok(notice.includes(s), s);
  assert.match(await page.locator("#door-thanks").innerText(), /nothing will be charged/);
  await page.locator("#email").fill("not-an-email");
  await page.getByRole("button", { name: "Tell me when it is ready" }).click();
  assert.match(await page.locator("#wl-err").innerText(), /valid email/);
  await page.locator("#email").fill("Asha@Example.org");
  await page.getByRole("button", { name: "Tell me when it is ready" }).click();
  await page.getByText("Thanks. You are on the list.").waitFor();
  await page.waitForTimeout(200);
  const st = await stats(open);
  assert.ok(st.bySource.post.pay_intent >= 1 && st.bySource.post.waitlist_submit >= 1);
  assert.equal(st.waitlistEntries >= 1, true);
  await context.close();
});

test("without operator details the email list stays closed", async () => {
  const { context, page } = await newPage(closed);
  await generate(page);
  await page.getByRole("button", { name: "I would pay for this" }).click();
  assert.match(await page.locator("#door-thanks").innerText(), /email list is not open/);
  assert.equal(await page.locator("#wl").isHidden(), true);
  await context.close();
});

test("the 'did you send it?' question counts a yes once and the traffic source is recorded", async () => {
  const { context, page } = await newPage();
  await generate(page);
  await page.route("https://wa.me/**", (r) => r.fulfill({ status: 200, body: "ok" }));
  const [popup] = await Promise.all([page.waitForEvent("popup"), page.locator("article.msg").first().getByRole("link", { name: "Open in WhatsApp" }).click()]);
  await popup.close();
  await page.locator("article.msg").first().getByRole("button", { name: "Yes" }).click();
  await page.getByText("Thanks. That helps.").waitFor();
  await page.waitForTimeout(300);
  const st = await stats(open);
  assert.ok(st.bySource.post.open_whatsapp >= 1 && st.bySource.post.sent_yes >= 1);
  await context.close();
});

test("only the keyboard: fill every field by typing, submit, reach copy and send, nothing traps focus", async () => {
  const { context, page } = await newPage(open, { locale: "en-US" }); // date fields type as month, day, year
  const mdy = (iso) => { const [y, m, d] = iso.split("-"); return m + d + y; };
  await page.locator("#me").focus();
  const order = [];
  for (const [id, text] of [["me", "Asha"], ["client", "Ravi"], ["amount", "5000"], ["invoice", ""], ["due", mdy(shift(-3))], ["deadline", mdy(shift(5))], ["pay", ""]]) {
    assert.equal(await page.evaluate(() => document.activeElement.id), id, `focus should be on ${id}`);
    order.push(id);
    if (text) await page.keyboard.type(text);
    await page.keyboard.press("Tab");
    // a date field has month, day and year parts: after typing all three, one more Tab leaves it
    if ((id === "due" || id === "deadline") && (await page.evaluate(() => document.activeElement.id)) === id) await page.keyboard.press("Tab");
  }
  assert.deepEqual(order, ["me", "client", "amount", "invoice", "due", "deadline", "pay"]);
  assert.equal(await page.evaluate(() => document.activeElement.textContent), "Write my messages");
  await page.keyboard.press("Enter");
  await page.locator("#results").waitFor();
  assert.match(await page.locator("#wa-polite").inputValue(), /Rs 5,000/);
  assert.equal(await page.evaluate(() => document.activeElement.id), "results", "focus moves to the results");
  await page.keyboard.press("Tab");
  assert.equal(await page.evaluate(() => document.activeElement.id), "wa-polite");
  await page.keyboard.press("Tab");
  assert.equal(await page.evaluate(() => document.activeElement.textContent), "Open in WhatsApp");
  await page.keyboard.press("Tab");
  assert.equal(await page.evaluate(() => document.activeElement.textContent), "Copy text");
  await context.close();
});

test("phone: no sideways scroll, targets at least 44px, nothing cut off", async () => {
  const { context, page } = await newPage(open, { viewport: { width: 375, height: 760 }, hasTouch: true, isMobile: true });
  await generate(page);
  await page.locator("#results").waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, "no horizontal scroll");
  for (const sel of ["button.primary", "article.msg a.btn", "article.msg button.secondary", "#pay-intent", "#me", "#due"]) {
    const box = await page.locator(sel).first().boundingBox();
    assert.ok(box.height >= 44, `${sel} is ${Math.round(box.height)}px high`);
    assert.ok(box.x >= 0 && box.x + box.width <= 376, `${sel} fits the screen`);
  }
  assert.ok((await page.evaluate(() => parseFloat(getComputedStyle(document.getElementById("me")).fontSize))) >= 16, "inputs are 16px or larger so iOS does not zoom");
  await context.close();
});

test("accessibility: axe finds nothing serious on the empty page, the results and the plan question, in light and dark", async () => {
  const axeSource = fs.readFileSync(new URL("../node_modules/axe-core/axe.min.js", import.meta.url), "utf8");
  for (const colorScheme of ["light", "dark"]) {
    const context = await browser.newContext({ userAgent: UA, bypassCSP: true, colorScheme }); // bypassCSP only so the test can inject axe
    const page = await context.newPage();
    await page.goto(open.base + "/?src=me");
    const run = async (label) => {
      await page.evaluate(axeSource);
      const res = await page.evaluate(() => axe.run(document, { runOnly: ["wcag2a", "wcag2aa", "wcag21aa", "best-practice"] }));
      assert.deepEqual(res.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`), [], `${colorScheme} ${label}`);
    };
    await run("empty page");
    await page.getByRole("button", { name: "Write my messages" }).click();
    await run("with errors");
    await fill(page); await page.getByRole("button", { name: "Write my messages" }).click();
    await page.locator("#results").waitFor();
    await page.locator("article.msg").first().locator("summary").click();
    await run("results");
    await page.getByRole("button", { name: "I would pay for this" }).click();
    await run("plan question");
    await context.close();
  }
});

test("the page loads its own files only, with the strict policy, and no cookie is set", async () => {
  const { context, page } = await newPage();
  const urls = [];
  page.on("request", (r) => urls.push(r.url()));
  await page.reload();
  await page.waitForTimeout(300);
  const origin = new URL(open.base).origin;
  assert.ok(urls.every((u) => u.startsWith(origin)), urls.filter((u) => !u.startsWith(origin)).join(","));
  assert.deepEqual(await context.cookies(), []);
  await context.close();
});
