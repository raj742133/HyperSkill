// Starter configuration from HyperSkill. Edit freely: it is yours.
// Run against a server you start yourself:   E2E_BASE_URL=http://127.0.0.1:3000 npx playwright test
// or let Playwright start it:                E2E_SERVER_CMD="npm run dev" E2E_BASE_URL=http://127.0.0.1:3000 npx playwright test
const { defineConfig } = require("@playwright/test");

const baseURL = process.env.E2E_BASE_URL || "http://127.0.0.1:3000";

module.exports = defineConfig({
  testDir: "./e2e",
  timeout: 30000,
  expect: { timeout: 5000 },
  fullyParallel: true,
  forbidOnly: true,                       // a stray test.only must never reach CI
  retries: 1,                             // one retry: a test that needs it is reported as "flaky", which HyperSkill treats as a failure to fix
  reporter: [["list"]],
  use: { baseURL, trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [
    { name: "desktop", use: { viewport: { width: 1280, height: 800 } } },
    { name: "phone", use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
  webServer: process.env.E2E_SERVER_CMD ? { command: process.env.E2E_SERVER_CMD, url: baseURL, reuseExistingServer: true, timeout: 120000 } : undefined,
});
