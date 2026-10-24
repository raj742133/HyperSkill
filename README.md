<div align="center">

# HyperSkill

**A conductor for Claude Code.** AI builds fast. HyperSkill makes it prove it.

[![MIT licence](https://img.shields.io/badge/licence-MIT-0f6b5c)](LICENSE)
[![Claude Code plugin](https://img.shields.io/badge/Claude%20Code-plugin-e5412a)](#install)
[![Python 3, standard library only](https://img.shields.io/badge/python-3%20stdlib%20only-3a312b)](scripts/hyperskill.py)

[**Live site**](https://hyperskill-hazel.vercel.app) · [Install](#install) · [How it works](#how-it-works) · [Real runs](#real-runs) · [Limits](#what-is-and-is-not-verified)

<img src="docs/img/site-hero.png" alt="The HyperSkill site: the headline, the install command and a terminal showing the tracker refusing to advance a phase" width="860">

<img src="docs/img/site-hero-phone-dark.png" alt="The same site on a phone in dark mode, which follows the phone's setting" width="300">

</div>

HyperSkill takes a product from **idea to shipped, monitored and promoted** in nine gated phases. One conductor skill (`/hyperskill`) decides which phase you are in, hands the work to that phase's skill, asks you the decisions that are yours, and **refuses to advance a phase until its checks have evidence**.

It exists because coding agents are good at saying "done". They are less good at proving the tenant isolation holds, that the rate limit really blocks, or that the thing you are about to launch has a rollback. HyperSkill turns those questions into a checklist that a script enforces, not a model's mood.

## How it works

<img src="docs/img/pipeline.svg" alt="The nine phases: research, plan, foundation, product, ship, harden, operate, launch, scale, with 72 checks between them" width="860">

| # | Phase | Skill | What it settles |
|---|---|---|---|
| 0 | Research | `hs-research` | Is this worth building? Problem, alternatives, demand evidence, risks, a go / pivot / stop call |
| 1 | Plan | `hs-plan` | Requirements, architecture, decision records, project memory, a scaffold that boots |
| 2 | Foundation | `hs-foundation` | Data and migrations, auth, authorisation, API conventions, jobs, payments if any |
| 3 | Product | `hs-product` | Design system, every screen in every state, accessibility, a designer pass |
| 4 | Ship | `hs-ship` | Git hygiene, CI/CD, tests that can fail, environments, rollback |
| 5 | Harden | `hs-harden` | Threat model, independent security review, rate limits, caching |
| 6 | Operate | `hs-operate` | Structured logs, error tracking, health checks, alerts and runbooks |
| 7 | Launch | `hs-launch` | Pre-launch audit, legal pages, promo and product video |
| 8 | Scale | `hs-scale` | Load tests, measured optimisation, cost model |

### What makes it more than a checklist

- **Gates need evidence.** `hyperskill.py advance` fails while any check is open. A check is passed with a command that exits 0 (`--run`) or with evidence that points at something checkable: a path, a backticked command, a count. "Looks fine" is refused. A negated `grep` with no existence guard is refused too, because it passes when the file is missing.

  <img src="docs/img/terminal-demo.png" alt="Terminal output: a gate passes with evidence, advance is refused with the open items listed, a failing check stays open, and a noncommercial-licence tool is blocked on a commercial project" width="560">

- **Waivers are written down.** Anything you cannot do in the current environment (no deploy target, no third-party account) is waived with a reason, recorded in the state file, and becomes your launch to-do list. `hyperskill.py config --unavailable host,provider,device,human` and `gate <phase> --waive-unavailable` do this in one recorded step.
- **The project's shape is set once.** `init --tenancy user|organization|none` makes organisation-only checks not apply and rewords the rest.
- **Decisions stay yours.** Stack, tenancy model, providers and limits are asked, not assumed, then written to `docs/decisions/NNNN-*.md` so a later session cannot quietly change them.
- **Fresh-eyes reviews.** Design stress tests, security reviews and design critiques run in a read-only reviewer with no stake in the code. Their reports are findings, not instructions.
- **You can watch it work.** A hook and the tracker write an activity log; `/hyperskill-live` shows it in your browser as it happens ([details](#watch-it-work)).
- **State lives in files.** `.hyperskill/state.json`, `CLAUDE.md` and `docs/` let any new session resume where the last one stopped.

### It orchestrates other skills, and does not trust them blindly

Phases ask for capabilities (a design direction, a security audit, video, browser verification) called **slots**. `skills/hyperskill/integrations.json` maps **32 slots** to **37 reviewed providers** (built-in Claude features, built-in HyperSkill kits and third-party skills and tools), each with licence, risks and a policy: 15 recommended, 13 opt-in, 6 reference-only, 2 unreviewed, 1 blocked on commercial projects. `hyperskill.py integrations` resolves each slot against what is actually installed. The rules:

- **Twelve of them are bundled** in [`packs/`](packs) (unmodified copies with their licences and a pinned commit: Impeccable, taste-skill, Emil Kowalski's skills, Karpathy guidelines, UI UX Pro Max, Cloudflare security-audit, SlopMonster, HyperFrames, Superpowers, Ponytail, /watch, better-icons). They load nothing until you switch them on: `hyperskill.py integrations enable <id>` (or `enable --all` for the recommended ones, or the button in the dashboard) copies the skills into the project's `.claude/skills`, and `disable` removes exactly those. Tools whose licence forbids redistribution (Hypit, Onetake, MiroFish) or that are not skills (gstack, CLIs, hosted services) are not bundled and stay external.
- Nothing is installed without asking (`bash scripts/install-skills.sh --dry-run` prints the exact commands for the external ones).
- Opt-in tools stay off until you run `integrations enable <id>`.
- Noncommercial-licence tools are blocked on commercial projects, and the resolver says why.
- One design-direction voice per project, and no second conductor.
- An external skill's text ranks below your instructions and these rules, and it can never waive a gate.
- Every slot has a built-in fallback.

Details: [`skills/hyperskill/references/integrations.md`](skills/hyperskill/references/integrations.md) and [`docs/integrations-review.md`](docs/integrations-review.md).

## Watch it work

**It starts by itself.** When a session opens in a HyperSkill project, the plugin starts the dashboard in the background (or reuses the one already running) and Claude tells you the address, usually `http://127.0.0.1:4777/`. It stops after 4 hours with no page open, or when you run `hyperskill.py live --stop`; turn the auto-start off with `hyperskill.py config --autolive off` (or set `HYPERSKILL_NO_LIVE=1`). You can also run `/hyperskill-live` yourself, and a page opens at `http://127.0.0.1:4777/` that shows what is being made, tested and decided **as it happens**: a "Right now" card, the nine phases with their progress, a live activity feed, the checks still open, the latest test run with its pass and fail counts, the files touched and the decisions recorded.

<img src="docs/img/live-view.png" alt="The live view during a recorded session: Right now, the nine phases, an activity feed with a refused advance, a passed check and files written, and panels for tests and open checks" width="860">

[**Play a recorded session on the site**](https://hyperskill-hazel.vercel.app/live): the replay is a real session (Claude, with this plugin installed, building and testing a tiny rupee formatter), nothing added or reordered.

How it works:

- **A plugin hook records the work**, so it does not depend on Claude remembering to report. After each file write or edit, each shell command, each failed command and each helper agent, the hook (`scripts/hs_hook.py`) appends one line to `.hyperskill/activity.jsonl`. Test runs from `node:test`, `unittest`, `pytest` and `jest` are recognised and shown as counts. A failing run appears too.
- **The tracker logs its own actions** (checks passed, waived, failed or refused, decisions, phase changes), and `hyperskill.py event "..." --kind building|testing|reviewing|waiting|done` sets the "Right now" card.
- **It is also a control panel, and it is local.** `hyperskill.py live` serves it on `127.0.0.1` only, refuses requests whose `Host` or `Origin` is not its own, sends only a short fixed list of files, and draws everything as plain text. From the page you can pass or waive a check (with the evidence or reason the tracker requires), advance a phase (refused while checks are open), record a decision, switch bundled skills on and off, **pause** Claude, and **send Claude an instruction**. Each button runs the same `hyperskill.py` command a person would type, so no rule is bypassed, and there is no way to run an arbitrary command from the page. Controls need a random per-run key that only the served page carries. `live --read-only` removes them.
- **Pause and instructions work through the plugin hook.** While paused, the hook refuses file writes, edits and shell commands (except `hyperskill.py status|resume|event|log`); an instruction typed in the page is handed to Claude once, as extra context, at its next tool step or prompt. This steers an agent that honours hooks. It cannot stop a command that is already running, and a pause is not a security boundary against an agent that finds another way to run code.
- **Secrets are masked before they are written**: `TOKEN=...`, `Authorization` headers, `ghp_...`-style keys, URLs with passwords, long hex or base64 strings. Files outside the project are logged by name only, and the project folder shows as `.`.
- **It only runs inside a HyperSkill project.** Outside one (no `.hyperskill/state.json` above the working directory) the hook does nothing, and it always exits 0 so it cannot block a tool call. The log is private (mode 0600), ignored by git, and rotated at 5 MB. To turn the recording off, uninstall the plugin or remove `hooks/hooks.json`.

What it does **not** do: it shows what Claude Code reports to hooks (files, commands, results), not Claude's reasoning. The "Right now" card is only as accurate as Claude's own announcements. Helper-agent events are tested but I have not seen them in a real session. It has been tried on Linux only.

## Figures

`/hyperskill-figure <idea>` builds an interactive figure that explains an idea as a real, finely made working object: a cache key becomes a pin-tumbler lock, a rate limiter becomes a turnstile. It uses **Hyperfigure**, bundled in [`skills/hyperfigure`](skills/hyperfigure), so it works as soon as the plugin is installed. It comes with a drawing kit (SVG, WebGL and an optional 3D mode), nine worked examples, audits and printable sheets. Hyperfigure is derived from Anatomy by Ryan (MIT); [`skills/hyperfigure/NOTICE.md`](skills/hyperfigure/NOTICE.md) says what was changed and where it came from.

<img src="skills/hyperfigure/assets/raptor-engine-firing.webp" alt="An isometric drawing of a Raptor 2 rocket engine hanging in a test stand, firing: a red exhaust plume drawn by a WebGL shader pours onto the stand's base plate" width="640">

<sub>`skills/hyperfigure/examples/raptor-engine`.</sub>

It is a capability that other phases call through the `explainer-figure` slot, not a tenth phase: the plan phase uses it to check an architecture can be explained, the product phase for docs and landing visuals, the launch phase for promo. It needs Node 20.10 or later, plus Chrome or Chromium for its checks, and it adds about 27 MB to the plugin (mostly built example pages).

## Install

```
/plugin marketplace add raj742133/HyperSkill
/plugin install hyperskill@hyperskill
```

Then, in a project:

```
/hyperskill "a short description of your idea"
```

| Command | What it does |
|---|---|
| `/hyperskill` | Start a project, or resume it where it stopped |
| `/hyperskill-status` | Show every phase and its open checks |
| `/hyperskill-gate [phase]` | Walk the gate for a phase (default: the current one) |
| `/hyperskill-live` | Open the live view of what is being made, tested and decided |
| `/hyperskill-figure <idea>` | Build a crafted, interactive isometric figure that explains an idea, with the bundled Hyperfigure skill |

Requires Python 3 (standard library only) for the tracker. The launch phase also needs Node 22+, FFmpeg and, for speech-timed video, whisper-cpp.

The tracker can be used on its own:

```bash
python3 scripts/hyperskill.py init --name myapp --tenancy user --unavailable host,provider
python3 scripts/hyperskill.py status
python3 scripts/hyperskill.py gate research --run problem-statement --cmd "test -s docs/research.md"
python3 scripts/hyperskill.py gate research --pass risks-listed --evidence "docs/research.md section 6: 5 risks, each with a test"
python3 scripts/hyperskill.py decide --title "..." --choice "..." --why "..."
python3 scripts/hyperskill.py advance
```

## Real runs

HyperSkill was run end to end on three small products. All live in this repo, with their gate records, decisions, reviews and tests.

### DueSoon: all nine phases ([`examples/duesoon`](examples/duesoon))

A student deadline tracker. 72 checks: **49 passed with evidence, 23 waived with written reasons** (about ten of those because a sandbox cannot deploy, rehearse a rollback or wire alerts). 66 unit and integration tests, 17 browser tests including keyboard and accessibility, 12 of 13 mutation checks killed. An independent security review found a real login-limit bypass (padding the email with spaces gave a fresh budget), which was fixed with a regression test. The honest verdict is in [`docs/prelaunch.md`](examples/duesoon/docs/prelaunch.md): **not launch-ready**. What worked and what was too heavy in HyperSkill itself is in [`docs/dogfood/REPORT.md`](examples/duesoon/docs/dogfood/REPORT.md); those findings became the tenancy, `unavailable` and evidence rules above.

### Chaser: research that said "pivot" ([`examples/chaser`](examples/chaser))

A tool to write payment reminders for Indian freelancers. Four parallel researchers read the market, the pain, the alternatives and the legal risk, and the research ended in an unwelcome answer: **free tools already include reminders, the demand evidence is old, and nobody is shown paying.** The recommendation was *do not build the app*; build one free page that tests demand, with pass and stop conditions written in advance. A skeptical reviewer then found three high-severity flaws in the first design (the "waitlist" tested curiosity, not willingness to pay; the success ratio could not be computed from the counters; the privacy promise was overstated). All were fixed before any code. The result, with the generated text checked against a list of phrases it must never contain:

<table>
<tr>
<td align="center"><img src="docs/img/chaser-form.png" alt="Chaser on a phone: a short form for one unpaid invoice" width="300"></td>
<td align="center"><img src="docs/img/chaser-results.png" alt="Chaser's results: a check-before-you-send summary and three messages, with the suggested one marked" width="300"></td>
</tr>
</table>

**The owner then decided to keep it free**, so the pricing button, waitlist and counters were removed and it is now a plain static page ([live](https://hyperskill-hazel.vercel.app/chaser)). Today: 25 unit tests, 16 browser tests (a test fails if the page makes any request after it loads), and 11 of 11 mutation checks killed. Its research is [`docs/research.md`](examples/chaser/docs/research.md), the design review [`docs/design-review.md`](examples/chaser/docs/design-review.md). The foundation and product gates of this run are not closed yet.

### Tide: all nine phases, and the later phases found real bugs ([`examples/tide`](examples/tide))

A focus timer shaped like a glass of water ([live](https://hyperskill-hazel.vercel.app/tide)). Built first, then run through the whole pipeline afterwards to see whether the ship, harden, operate, launch and scale phases hold up. 68 checks: **40 passed with evidence, 28 waived with written reasons** (most need a host, a monitoring provider or a person that a sandbox does not have). Independent reviewers and the harden checks found problems the tests had missed: corrupt saved settings made the display read `NaN:NaN`; with reduced motion the glass never drained; a stray key wiped a running session; a clock set back could extend a session; the live security policy was looser than the threat model said; and the pre-commit hook skipped file names with spaces. Each was fixed with a test. Today: 22 unit tests, 28 browser tests (accessibility included), all 10 mutation checks killed, a load test and a cost model with real numbers. Not tested: a real phone, a real screen reader, the deployed host under load.

## What is and is not verified

Verified:

- The plugin installs from GitHub into a clean config, and `/hyperskill` ran headless from an install of the same plugin (two separate tests, not one end-to-end run).
- The tracker and the integration resolver are covered by 140 tests; `claude plugin validate .` passes.
- Two full runs on real code, described above, with the failures they exposed.

Not verified, so do not rely on it yet:

- It has been run only by its author, on three small products. Nobody else has used it.
- The video instructions (`hs-launch`) were checked against the installed HyperFrames documentation, not executed.
- Third-party skills are read at README level and not pinned to a version. Read a skill before enabling it; installed skills run with your agent's permissions.
- The reference text was rewritten in original wording from guides that state no licence. That is not a legal clearance (see [`docs/sources.md`](docs/sources.md)).
- Research in the example runs was read through search summaries; prices and caps there are unverified.

## Repository layout

```
.claude-plugin/        plugin and marketplace manifests
skills/hyperskill/     the conductor, gates.json (72 checks), integrations.json (the registry)
skills/hs-*/           one skill per phase, with references/
skills/hyperfigure/    the figure skill, derived from Anatomy (MIT, by Ryan): a capability, not a phase
agents/                hs-researcher, hs-reviewer (read-only)
commands/              /hyperskill, /hyperskill-status, /hyperskill-gate, /hyperskill-live, /hyperskill-figure
hooks/                 hooks.json: records the work for the live view; pause and instructions from the dashboard
packs/                 12 bundled third-party skill packs (unmodified, licensed, off until enabled)
scripts/               hyperskill.py (state, gates, integrations), hs_hook.py, hs_live.py, hs_control.py, hs_activity.py, vendor_packs.py,
                       make_replay.py, install-skills.sh, build_site.py
site/                  the static launch site (Vercel; vercel.json); site/live is the live view and its replay
examples/duesoon/      full nine-phase run
examples/chaser/       research, plan and build of the second run
docs/                  sources, integration review, README images
tests/                 140 tests for the tracker, resolver, activity log, hook, live server, structure and site
```

## Develop

```bash
python3 -m unittest discover -s tests -v   # tracker, resolver, structure, site data
claude plugin validate .
python3 scripts/build_site.py              # regenerate site/data.js after changing gates or integrations
```

The site is static: import the repository in Vercel and `vercel.json` does the rest, or preview locally with `python3 -m http.server -d site 8000`.

## Licence and sources

MIT, see [`LICENSE`](LICENSE). The bundled [`skills/hyperfigure`](skills/hyperfigure) is derived from Anatomy by Ryan (also MIT); its own [`LICENSE`](skills/hyperfigure/LICENSE) keeps Ryan's copyright notice and adds this project's, as the licence requires. Where the guidance came from, and what is still unresolved, is in [`docs/sources.md`](docs/sources.md).
