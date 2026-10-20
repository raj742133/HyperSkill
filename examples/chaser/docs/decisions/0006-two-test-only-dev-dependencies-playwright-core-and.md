# 0006. Two test-only dev dependencies: playwright-core and axe-core

- Date: 2026-10-19T20:28:25Z
- Phase: product

## Decision
Add playwright-core (drives the system Chromium, downloads no browser) and axe-core (accessibility checks) as devDependencies used only by e2e/. Runtime dependencies stay at zero.

## Why
The no-network-on-generate promise, keyboard use and accessibility can only be proven in a real browser. Both were already used and audited in examples/duesoon. The owner said to build; this is recorded so it can be vetoed.

## Alternatives considered
- Test only with unit tests: rejected, cannot prove the privacy promise, focus handling or contrast.
- Playwright test runner or a bundled browser download: rejected, heavier and downloads binaries.

## Consequences
- `npm install` brings in two packages and their dependencies for development only; they are not served or loaded by the app.
- `npm audit` must stay clean for them.
- Running the browser tests needs a Chromium on the machine (`CHROME_PATH`).
