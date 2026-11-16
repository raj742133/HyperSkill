# Changelog

## 0.2.0 (2026-11-16)

**New**

- **Adopt mode** for existing repositories: `hyperskill.py init --adopt` / `adopt` reads the project, writes `docs/adopt/inventory.md`, `inventory.json` and a restructure plan, lists the risks it finds (never printing a secret), and adds four adopt-only checks (inventory read, behaviour pinned by tests, a plan of small undoable steps, a passing run per step).
- **Code view** in the dashboard: a read-only file tree, what changed against git, what Claude touched lately, file text and diff; confined to the project, secrets hidden.
- **Playwright end-to-end tests** (`hs-e2e`): `hyperskill.py e2e init|run|status`, a starter suite for the five critical flows, verdicts green / incomplete / failing, a dashboard button, and evidence for the ship phase's `e2e-critical` check. Installs nothing; uses only the project's own Playwright.
- Skills written for this project: `hs-watch`, `hs-convert`, `hs-logo`, `hs-a11y-review`, `hs-responsive`, `hs-design-review`, `hs-brand-board`, `hs-e2e`; new slots `file-convert`, `logo-design`, `responsive-check`, `brand-board`.
- **Ten visual styles** with a recipe each, a recorded example, and a live demo in the dashboard and on the public site.
- Bundled Hallmark, Humanizer and Diagram Design; last30days, Scrapling and REA registered as opt-in; self-hosted building blocks (GlitchTip, Gotify, Windmill, Vikunja, celld, RAG-Anything) with licence caveats.
- **Helper agents by difficulty**, with a model and effort you can change per tier; a locked, signed dashboard and state (tamper-evident, with `repair`), person-only checks behind a Confirm button, `scripts/check.sh` and a pattern scan of the bundled packs (`docs/pack-audit.md`).

**Changed**

- The public site is restyled in neo-brutalism, with a plainer headline; the Tide and Chaser example pages and folders are removed.
- Hyperfigure is about 20 MB smaller (generated PDFs and light builds removed; rebuilt on demand).
- Chrome-based tools (logo kit, contrast and responsive checks) work on Chrome builds where `--screenshot` and `--dump-dom` hang, and no longer leave helper processes behind.

**Known limits**

- Windows and macOS have never been run on a real machine; the repository's hosted CI has never started.
- The pandoc route of `hs-convert` is untested.
- Third-party skill text is scanned for risky patterns, not audited line by line.

## 0.1.0

First public version: nine gated phases, the tracker, the registry of providers and the live view.
