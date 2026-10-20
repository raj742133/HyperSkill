# Tide

## Purpose
A free focus timer shaped like a glass of water. Static page, no server data, no tracking. Not a business. Design: `docs/system-design.md`; research: `docs/research.md`.
Tenancy: none (nothing stored on a server).

## Stack (ask before changing)
- Plain HTML, CSS and ES modules; no build step, no runtime dependencies.
- Dev-only: `playwright-core` (browser tests), `axe-core` (accessibility).
- Logic lives in `timer.js` (pure, clock injected); drawing in `liquid.js`; wiring in `app.js`.

## Working rules
- The page makes no network request after it loads, stores only timer lengths and the sound setting in local storage, and must still work when storage is blocked.
- Time comes from a deadline timestamp, never from counting ticks.
- Honour reduced motion: no animation loop, no rolling digits.
- Every colour world keeps white text at 3:1 or better (a test enforces it).
- Never weaken a test to get green; a skipped test needs a written reason.
- The deployed copy lives in `site/tide/` at the repository root: after changing a file here, run `python3 scripts/sync_tide.py` from the repository root; a site test fails when they differ.
- Run `npm run lint && npm test` before saying a task is done, and show the output.

## Commands
- Dev: `npm start` (http://127.0.0.1:4173, health at /api/health)
- Test: `npm test` (unit), `CHROME_PATH=/path/to/chrome npm run test:e2e` (browser)
- Lint: `npm run lint`

## Pipeline
Phase state: `.hyperskill/state.json` (not committed); `/hyperskill` resumes.
