# End-to-end tests

Started by HyperSkill (`hyperskill.py e2e init`). Playwright drives a real browser against your running app.

```
npm install -D @playwright/test
npx playwright install chromium
E2E_BASE_URL=http://127.0.0.1:3000 npx playwright test        # your server already running
hyperskill.py e2e run                                         # runs the suite and records docs/e2e-last.json for the ship gate
```

Rules the ship gate holds you to: tests cover signup, login, the core workflow, billing and invites; a `fixme` or `skip` needs a written reason; a test that only passes on retry ("flaky") is a failure to fix; use the provider's test mode for payments and never real credentials.
