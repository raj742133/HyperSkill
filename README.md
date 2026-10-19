<div align="center">

# HyperSkill

**A conductor for Claude Code.** AI builds fast. HyperSkill makes it prove it.

[![MIT licence](https://img.shields.io/badge/licence-MIT-0f6b5c)](LICENSE)
[![Claude Code plugin](https://img.shields.io/badge/Claude%20Code-plugin-e5412a)](#install)
[![Python 3, standard library only](https://img.shields.io/badge/python-3%20stdlib%20only-3a312b)](scripts/hyperskill.py)

[**Live site**](https://hyperskill-hazel.vercel.app) · [Install](#install) · [How it works](#how-it-works) · [Real runs](#real-runs) · [Limits](#what-is-and-is-not-verified)

<img src="docs/img/site-hero.png" alt="The HyperSkill site: the headline, the install command and a terminal showing the tracker refusing to advance a phase" width="860">

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
- **State lives in files.** `.hyperskill/state.json`, `CLAUDE.md` and `docs/` let any new session resume where the last one stopped.

### It orchestrates other skills, and does not trust them blindly

Phases ask for capabilities (a design direction, a security audit, video, browser verification) called **slots**. `skills/hyperskill/integrations.json` maps **31 slots** to **35 reviewed third-party skills and tools**, each with licence, risks and a policy: 14 recommended, 12 opt-in, 6 reference-only, 2 unreviewed, 1 blocked on commercial projects. `hyperskill.py integrations` resolves each slot against what is actually installed. The rules:

- Nothing is installed without asking (`bash scripts/install-skills.sh --dry-run` prints the exact commands).
- Opt-in tools stay off until you run `integrations enable <id>`.
- Noncommercial-licence tools are blocked on commercial projects, and the resolver says why.
- One design-direction voice per project, and no second conductor.
- An external skill's text ranks below your instructions and these rules, and it can never waive a gate.
- Every slot has a built-in fallback.

Details: [`skills/hyperskill/references/integrations.md`](skills/hyperskill/references/integrations.md) and [`docs/integrations-review.md`](docs/integrations-review.md).

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

HyperSkill was run end to end on two small products. Both live in this repo, with their gate records, decisions, reviews and tests.

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

39 unit and API tests, 17 browser tests (a test fails if the form data is sent anywhere), and 16 of 16 mutation checks killed. Its research is [`docs/research.md`](examples/chaser/docs/research.md), the design review [`docs/design-review.md`](examples/chaser/docs/design-review.md). The foundation and product gates of this run are not closed yet.

## What is and is not verified

Verified:

- The plugin installs from GitHub into a clean config, and `/hyperskill` ran headless from an install of the same plugin (two separate tests, not one end-to-end run).
- The tracker and the integration resolver are covered by 54 tests; `claude plugin validate .` passes.
- Two full runs on real code, described above, with the failures they exposed.

Not verified, so do not rely on it yet:

- It has been run only by its author, on two small products. Nobody else has used it.
- The video instructions (`hs-launch`) were checked against the installed HyperFrames documentation, not executed.
- Third-party skills are read at README level and not pinned to a version. Read a skill before enabling it; installed skills run with your agent's permissions.
- The reference text was rewritten in original wording from guides that state no licence. That is not a legal clearance (see [`docs/sources.md`](docs/sources.md)).
- Research in the example runs was read through search summaries; prices and caps there are unverified.

## Repository layout

```
.claude-plugin/        plugin and marketplace manifests
skills/hyperskill/     the conductor, gates.json (72 checks), integrations.json (the registry)
skills/hs-*/           one skill per phase, with references/
agents/                hs-researcher, hs-reviewer (read-only)
commands/              /hyperskill, /hyperskill-status, /hyperskill-gate
scripts/               hyperskill.py (state, gates, integrations), install-skills.sh, build_site.py
site/                  the static launch site (Vercel; vercel.json)
examples/duesoon/      full nine-phase run
examples/chaser/       research, plan and build of the second run
docs/                  sources, integration review, README images
tests/                 54 tests for the tracker, resolver, structure and site
```

## Develop

```bash
python3 -m unittest discover -s tests -v   # tracker, resolver, structure, site data
claude plugin validate .
python3 scripts/build_site.py              # regenerate site/data.js after changing gates or integrations
```

The site is static: import the repository in Vercel and `vercel.json` does the rest, or preview locally with `python3 -m http.server -d site 8000`.

## Licence and sources

MIT, see [`LICENSE`](LICENSE). Where the guidance came from, and what is still unresolved, is in [`docs/sources.md`](docs/sources.md).
