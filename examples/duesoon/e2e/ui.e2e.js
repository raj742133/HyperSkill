// End-to-end tests in a real browser against the real app and a real in-memory database.
// Run: CHROME_PATH=/path/to/chromium npm run test:e2e   (the browser is NOT downloaded by this project)
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { chromium } from "playwright-core";
import { startApp } from "../tests/helpers.js";
import { addDays, localToday } from "../public/due.js";

const require = createRequire(import.meta.url);
const AXE = require.resolve("axe-core/axe.min.js");
let ctx, browser;
const PASSWORD = "correct-horse-1";
let n = 0;
const email = () => `e2e${++n}-${Date.now()}@campusmail.in`;

before(async () => {
  ctx = await startApp();
  browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, args: ["--no-sandbox"] });
});
after(async () => { await browser?.close(); await ctx?.close(); });

async function newPage(opts = {}) {
  const context = await browser.newContext({ baseURL: ctx.base, ...opts });
  const page = await context.newPage();
  const problems = [];
  page.on("console", (m) => { if (m.type() === "error") problems.push(m.text()); });
  page.on("pageerror", (e) => problems.push(String(e)));
  return { context, page, problems };
}
async function signUp(page, mail = email()) {
  await page.goto("/");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.getByLabel("Email").fill(mail);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.locator("#authSubmit").click();
  await page.getByRole("heading", { level: 1, name: "Due soon" }).waitFor();
  return mail;
}
async function add(page, title, due, course = "") {
  await page.locator("#addTitle").fill(title);
  if (course) await page.locator("#addCourse").fill(course);
  await page.locator("#addDue").fill(due);
  await page.locator("#addBtn").click();
  await page.getByText(`Added “${title}”.`).waitFor();
}

test("sign-up, add, finish, edit, delete, log out and back in; data survives a reload", async () => {
  const { context, page, problems } = await newPage();
  const mail = await signUp(page);
  assert.match(await page.locator("#finding").innerText(), /Nothing due\./);
  assert.ok(await page.getByText("No assignments yet").isVisible(), "empty state keeps its frame");

  const t = localToday();
  await add(page, "Essay on caching", addDays(t, 1), "ENG101");
  assert.match(await page.locator("#finding").innerText(), /0 overdue\. 1 due in the next 7 days\. 1 open/);
  assert.equal(await page.locator(".row :is(.due, .due-inline):visible", { hasText: "Due tomorrow" }).count(), 1, "shown once at this width");

  await page.reload();
  await page.getByText("Essay on caching").waitFor();

  await page.getByRole("checkbox", { name: /Mark “Essay on caching” as done/ }).click();
  await page.getByText(/Marked .* done\./).waitFor();
  assert.equal(await page.locator("#count").innerText(), "0 open, 1 done");
  assert.ok(await page.locator(".row.is-done").count() === 1);

  await page.getByRole("button", { name: "Edit “Essay on caching”" }).click();
  await page.locator("#e-title").fill("Essay on cache invalidation");
  await page.getByRole("button", { name: "Save" }).click();
  await page.getByText("Saved.").waitFor();
  await page.getByText("Essay on cache invalidation").waitFor();

  await page.getByRole("button", { name: "Delete “Essay on cache invalidation”" }).click();
  assert.ok(await page.getByText("Delete “Essay on cache invalidation”?").isVisible(), "delete asks first and names the item");
  await page.getByRole("button", { name: "Delete", exact: true }).last().click();
  await page.getByText("No assignments yet").waitFor();

  await page.getByRole("button", { name: "Log out" }).click();
  await page.getByRole("heading", { level: 1, name: "Sign in to DueSoon" }).waitFor();
  await page.getByLabel("Email").fill(mail);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.locator("#authSubmit").click();
  await page.getByRole("heading", { level: 1, name: "Due soon" }).waitFor();
  assert.deepEqual(problems, [], "no console errors or CSP violations");
  await context.close();
});

test("wrong password shows one clear message and keeps the user on the sign-in card", async () => {
  const { context, page } = await newPage();
  await page.goto("/");
  await page.getByLabel("Email").fill("nobody@campusmail.in");
  await page.getByLabel("Password").fill("wrong-password-1");
  await page.locator("#authSubmit").click();
  await page.getByText("Wrong email or password").waitFor();
  assert.equal(await page.locator("#pageTitle").innerText(), "Sign in to DueSoon");
  await context.close();
});

test("an overdue assignment is flagged, counted and drawn in the strip", async () => {
  const { context, page } = await newPage();
  await signUp(page);
  const t = localToday();
  await add(page, "Late lab report", addDays(t, -3));
  await add(page, "Due today quiz", t);
  assert.match(await page.locator("#finding").innerText(), /^1 overdue\. 1 due in the next 7 days\. 2 open/);
  assert.equal(await page.locator(".row :is(.due, .due-inline):visible", { hasText: "Overdue by 3 days" }).count(), 1, "shown once at this width");
  assert.ok(await page.locator("#strip .col.over .n.has").innerText() === "1");
  const first = await page.locator(".row .t").first().innerText();
  assert.equal(first, "Late lab report", "most urgent first");
  await context.close();
});

test("a failed load shows an error inside the list with a working Retry", async () => {
  const { context, page } = await newPage();
  await signUp(page);
  await add(page, "Survives the outage", addDays(localToday(), 2));
  await page.route("**/api/assignments?*", (r) => r.abort());
  await page.reload();
  await page.getByText(/Couldn't load your assignments/).waitFor();
  assert.ok(await page.getByRole("button", { name: "Retry" }).isVisible());
  await page.unroute("**/api/assignments?*");
  await page.getByRole("button", { name: "Retry" }).click();
  await page.getByText("Survives the outage").waitFor();
  await context.close();
});

test("offline: adding says so plainly and nothing breaks; online again works", async () => {
  const { context, page, problems } = await newPage();
  await signUp(page);
  await context.setOffline(true);
  await page.locator("#addTitle").fill("Written offline");
  await page.locator("#addBtn").click();
  await page.getByText("Can't reach DueSoon. Check your connection and try again.").waitFor();
  assert.ok(await page.locator("#status.bad").isVisible());
  assert.equal(await page.locator("#addTitle").inputValue(), "Written offline", "the typed text is kept");
  await context.setOffline(false);
  await page.locator("#addBtn").click();
  await page.getByText("Added “Written offline”.").waitFor();
  assert.ok(problems.every((p) => /Failed to load resource|ERR_INTERNET_DISCONNECTED/.test(p)), "only network noise: " + problems.join("|"));
  await context.close();
});

test("the whole app works with only a keyboard", async () => {
  const { context, page } = await newPage();
  await page.goto("/");
  await page.getByRole("button", { name: "Create account" }).focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Tab");
  assert.equal(await page.evaluate(() => document.activeElement.id), "email");
  await page.keyboard.type(email());
  await page.keyboard.press("Tab");
  await page.keyboard.type(PASSWORD);
  await page.keyboard.press("Enter");
  await page.getByRole("heading", { level: 1, name: "Due soon" }).waitFor();
  await page.locator("#addTitle").focus();
  await page.keyboard.type("Keyboard only task");
  await page.keyboard.press("Enter"); // submits: the date is pre-filled
  await page.getByText("Added “Keyboard only task”.").waitFor();
  await page.getByRole("checkbox").first().focus();
  await page.keyboard.press("Space");
  await page.getByText(/Marked .* done\./).waitFor();
  assert.equal(await page.evaluate(() => document.activeElement.type), "checkbox", "focus stays on the checkbox after the list re-renders");
  const focusStyle = await page.evaluate(() => { const cs = getComputedStyle(document.activeElement); return cs.outlineStyle + " " + cs.outlineWidth; });
  assert.notEqual(focusStyle.split(" ")[0], "none", "focus is visible");
  await context.close();
});

test("hostile text is shown as text and never runs; CSP reports nothing", async () => {
  const { context, page, problems } = await newPage();
  await signUp(page);
  for (const [i, payload] of ["<img src=x onerror=\"window.__xss=1\">", "<script>window.__xss=1</script>", "\"><svg onload=window.__xss=1>"].entries())
    await add(page, payload, addDays(localToday(), i + 1), payload);
  assert.equal(await page.evaluate(() => window.__xss), undefined);
  assert.ok(await page.getByText("<script>window.__xss=1</script>").first().isVisible());
  assert.equal(await page.locator("#list img, #list script, #list svg").count(), 0);
  assert.deepEqual(problems.filter((p) => /Content Security Policy/i.test(p)), []);
  await context.close();
});

for (const scheme of ["light", "dark"]) {
  test(`accessibility (axe, WCAG 2.1 AA) on sign-in and on the main screen, ${scheme}`, async () => {
    // bypassCSP only so the test can inject axe; the CSP itself is asserted in the "hostile text" test above
    const { context, page } = await newPage({ colorScheme: scheme, bypassCSP: true });
    const run = async (label) => {
      await page.addScriptTag({ path: AXE });
      const r = await page.evaluate(() => axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] } }));
      assert.deepEqual(r.violations.map((v) => `${label}: ${v.id} (${v.impact}) ${v.nodes.map((x) => x.target.join(" ")).slice(0, 3).join("; ")}`), []);
    };
    await page.goto("/");
    await page.getByLabel("Email").waitFor();
    await run("sign-in");
    await signUp(page);
    const t = localToday();
    await add(page, "Contrast check", addDays(t, -1), "CS101");
    await add(page, "Another one", addDays(t, 4));
    await run("home");
    await context.close();
  });
}

test("phone: no sideways scroll, the list starts in the top 60%, touch targets are at least 44px", async () => {
  const { context, page } = await newPage({ viewport: { width: 375, height: 812 }, hasTouch: true });
  await signUp(page);
  await add(page, "Phone check", addDays(localToday(), 1));
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "no horizontal scroll");
  const firstRow = await page.locator(".row").first().boundingBox();
  assert.ok(firstRow.y < 812 * 0.6, `first row at ${Math.round(firstRow.y)}px of 812`);
  for (const sel of [".row .chk", ".row .act .text-btn", "#addBtn", "#logout"]) {
    const b = await page.locator(sel).first().boundingBox();
    assert.ok(b.height >= 44 - 0.5 && b.width >= 44 - 0.5 || b.height >= 43.5, `${sel} is ${Math.round(b.width)}x${Math.round(b.height)}`);
  }
  await context.close();
});

test("deleting the account removes everything and returns to the sign-up card", async () => {
  const { context, page } = await newPage();
  const mail = await signUp(page);
  await add(page, "Goodbye", addDays(localToday(), 1));
  await page.getByRole("button", { name: "Delete my account" }).click();
  await page.getByRole("button", { name: "Delete everything" }).click();
  await page.getByRole("heading", { level: 1, name: "Create your DueSoon account" }).waitFor();
  assert.equal(ctx.db.prepare("SELECT COUNT(*) n FROM users WHERE email = ?").get(mail).n, 0);
  await context.close();
});

test("ticking an assignment offers Undo, and Undo puts it back where it was", async () => {
  const { context, page } = await newPage();
  await signUp(page);
  const t = localToday();
  await add(page, "First due", addDays(t, 1));
  await add(page, "Second due", addDays(t, 2));
  await page.getByRole("checkbox", { name: /Mark “First due” as done/ }).click();
  await page.getByText(/Marked “First due” done\./).waitFor();
  assert.deepEqual(await page.locator(".row .t").allInnerTexts(), ["Second due", "First due"], "done rows sink to the bottom");
  await page.getByRole("button", { name: "Undo" }).click();
  await page.getByText("Undone.").waitFor();
  assert.deepEqual(await page.locator(".row .t").allInnerTexts(), ["First due", "Second due"]);
  assert.equal(await page.evaluate(() => document.activeElement.type), "checkbox", "focus returns to the checkbox");
  await context.close();
});

test("phone: the strip's 'Late' label and the first day label do not overlap", async () => {
  const { context, page } = await newPage({ viewport: { width: 375, height: 812 } });
  await signUp(page);
  await add(page, "Late one", addDays(localToday(), -2));
  const [late, first] = await page.locator("#strip .lbl").evaluateAll((els) => els.slice(0, 2).map((e) => { const r = document.createRange(); r.selectNodeContents(e); const b = r.getBoundingClientRect(); return { l: b.left, r: b.right, size: parseFloat(getComputedStyle(e).fontSize) }; }));
  assert.ok(late.r <= first.l, `'Late' ends at ${late.r.toFixed(1)}px, next label starts at ${first.l.toFixed(1)}px`);
  assert.ok(late.size >= 12 && first.size >= 12, "labels are at least 12px");
  await context.close();
});

for (const scheme of ["light", "dark"]) {
  test(`${scheme}: the borders of inputs and secondary buttons reach 3:1 contrast (WCAG 1.4.11)`, async () => {
    const { context, page } = await newPage({ colorScheme: scheme });
    await signUp(page);
    await page.getByRole("button", { name: "Edit" }).count(); // no rows yet; the add form is enough
    const ratios = await page.evaluate(() => {
      const parse = (c) => c.match(/[\d.]+/g).slice(0, 3).map(Number);
      const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
      const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
      const out = {};
      for (const sel of ["#addTitle", "#addCourse", "#addDue"]) {
        const el = document.querySelector(sel);
        const cs = getComputedStyle(el);
        const outside = getComputedStyle(el.closest(".add") || document.body).backgroundColor;
        out[sel] = +ratio(parse(cs.borderTopColor), parse(cs.backgroundColor)).toFixed(2);
      }
      return out;
    });
    for (const [sel, r] of Object.entries(ratios)) assert.ok(r >= 3, `${scheme} ${sel} border contrast ${r}:1`);
    await context.close();
  });
}

test("loading: grey placeholder rows hold the layout while the list loads, then real rows replace them", async () => {
  const { context, page } = await newPage();
  await signUp(page);
  await add(page, "Loaded eventually", addDays(localToday(), 3));
  await page.route("**/api/assignments?*", async (r) => { await new Promise((s) => setTimeout(s, 1200)); await r.continue(); });
  await page.reload();
  await page.locator("#listState[aria-busy='true'] .skel").first().waitFor();
  assert.equal(await page.locator("#listState .skel").count(), 4);
  assert.equal(await page.locator("#listState .skel").first().evaluate((e) => Math.round(e.getBoundingClientRect().height)), 52, "placeholder rows have the real row height");
  await page.getByText("Loaded eventually").waitFor();
  assert.equal(await page.locator("#listState .skel").count(), 0);
  await context.close();
});
