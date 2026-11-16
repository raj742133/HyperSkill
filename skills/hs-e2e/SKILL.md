---
name: hs-e2e
description: End-to-end tests with Playwright for the ship phase - a starter config and spec for the flows that must never break (signup, login, core workflow, billing, invites), a command that runs the suite and records the result as evidence, and a dashboard button. Use when a project needs browser tests, before the e2e-critical check is passed, or when "it works on my machine" needs proof.
---

# hs-e2e

The ship phase asks for end-to-end tests of signup, login, the core workflow, billing and invites (`e2e-critical`), with no unjustified skips (`skips-justified`). This skill gets the suite started and keeps an honest record of each run. HyperSkill installs nothing: you run the install commands, and every run uses only the Playwright already in the project's `node_modules` (never `npx`, which would download code on the fly).

```
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/hyperskill.py e2e init     # copies playwright.config.js and e2e/critical-flows.spec.js; never overwrites
npm install -D @playwright/test && npx playwright install chromium     # you run these
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/hyperskill.py e2e run      # runs the suite, writes docs/e2e-last.json
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/hyperskill.py e2e status
```

Point the tests at your app with `E2E_BASE_URL` (default `http://127.0.0.1:3000`), or let Playwright start it with `E2E_SERVER_CMD="npm run dev"`.

## How a run is judged

| Verdict | Meaning |
|---|---|
| **green** | tests ran, none failed, none needed a retry, and no placeholders are left |
| **incomplete** | it passes, but `test.fixme` placeholders remain: those flows are not covered, so the run cannot be cited as evidence |
| **failing** | a test failed, or passed only on retry (**flaky**: fix the cause; do not raise retries) |
| **could not run** | no config, Playwright not installed, or no report (the message says what to run) |

## What to do

1. `e2e init`, then have the owner run the two install commands.
2. Replace every `test.fixme` in `e2e/critical-flows.spec.js` with a real test of that flow. Use the payment provider's **test mode**, a seeded or throwaway account, and never real credentials. A flow with no UI (a webhook) gets an API test through Playwright's `request` fixture.
3. For tenant products, include the cross-tenant case in the invites test: a person from one organization cannot read another's data.
4. Run `e2e run` until it is green. Then pass the check with the evidence line it prints (a file that exists and the counts), or from the dashboard's **Record this run as evidence** button, which does the same.
5. Any `skip` you keep needs a written reason in the test; the tracker's `skips-justified` check reads them.

## Rules

- Never edit a test to make it pass, loosen an assertion, add `retries` or `.skip` to get green: a failing test is a bug report.
- Do not commit traces, screenshots or `test-results/`; add them to `.gitignore`.
- The dashboard button runs the project's own test code on your computer: only use it on a project you trust.
