// The flows that must never break. HyperSkill's ship phase asks for end-to-end tests of: signup, login, the core workflow, billing and invites.
// A test marked test.fixme is reported as skipped, and every skip needs a written reason: replace each fixme with a real test.
const { test, expect } = require("@playwright/test");

test.describe("smoke", () => {
  test("the home page loads and has a title", async ({ page }) => {
    const res = await page.goto("/");
    expect(res && res.ok()).toBeTruthy();
    await expect(page).toHaveTitle(/.+/);
  });

  test("nothing throws in the browser console on the home page", async ({ page }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    expect(errors).toEqual([]);
  });

  test("the page works with only a keyboard: the first Tab lands on something focusable", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");
    const tag = await page.evaluate(() => document.activeElement && document.activeElement.tagName);
    expect(["A", "BUTTON", "INPUT", "SELECT", "TEXTAREA", "SUMMARY"]).toContain(tag);
  });
});

test.describe("critical flows (replace each fixme)", () => {
  test.fixme("a new person can sign up and land in the product", async ({ page }) => { /* fill the form, submit, expect the signed-in page */ });
  test.fixme("a person can log in, and a wrong password is refused with the same message as an unknown email", async ({ page }) => {});
  test.fixme("the core workflow works from start to finish", async ({ page }) => {});
  test.fixme("billing: a person can start, change and cancel a plan (use the provider's test mode)", async ({ page }) => {});
  test.fixme("an invited person can join, and cannot see another organization's data", async ({ page }) => {});
});
