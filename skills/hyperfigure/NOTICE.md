# Notice

Hyperfigure is derived from **Anatomy** (https://github.com/wheresryan22/anatomy), a skill by Ryan, released under the MIT licence.

- Original work: copyright (c) 2026 Ryan, copied from commit `1482e8469b0a9e0d8cc18ea2740a01423d29ae80` ("Printable sheets: A4 and Letter PDFs from any figure (#126)", 2026-10-18).
- This version: copyright (c) 2026 raj742133, for the changes below.
- The MIT licence requires the original copyright notice and permission notice to stay with every copy and substantial portion of the work. They are in [`LICENSE`](LICENSE) and apply to everything derived from the original, which is nearly all of this folder.

## What was changed

- Renamed the skill, the command and the code identifiers from `anatomy` to `hyperfigure` (the skill name, the slash command, the `--anatomy-*` CSS variables in the kit and in every built example page, comments and documentation).
- Rewrote `README.md` (header, quick start, install, licence) and `SECURITY.md` (reporting contact) for this project.
- Removed what belonged to the original author's own project: the community-gallery publishing flow (`scripts/publish.mjs`, `scripts/session.mjs`, `scripts/fingerprint.mjs`, their tests, `references/publish.md`), `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, the issue and pull-request templates and the CI workflow. Moved the README images from `.github/assets` to `assets`.
- Added this notice and a new `CHANGELOG.md`; the original changelog is kept as `CHANGELOG-anatomy-upstream.md`.
- Everything else (the kit, the scripts, the references, the examples' source, the checks) is unchanged apart from the rename.
