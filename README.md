# HyperSkill

A Claude Code plugin that orchestrates a product from **idea to shipped, monitored and promoted**. One conductor skill (`/hyperskill`) routes work through nine phases, asks you the decisions that are yours, and refuses to advance a phase until its verification gate has real evidence.

```
research -> plan -> foundation -> product -> ship -> harden -> operate -> launch -> scale
```

| Phase | Skill | Covers |
|---|---|---|
| 0 Research | `hs-research` | Problem, alternatives, demand evidence, risks, go/pivot/stop |
| 1 Plan | `hs-plan` | Requirements, architecture, decision records, project memory, scaffold |
| 2 Foundation | `hs-foundation` | Schema + migrations, files, auth, authorisation, API, jobs, payments |
| 3 Product | `hs-product` | Design system, screens with all states, accessibility, secrets check |
| 4 Ship | `hs-ship` | Git hygiene, CI/CD, testing, hosting, env config, rollback |
| 5 Harden | `hs-harden` | Threat model, independent security review, rate limits, cost caps, caching |
| 6 Operate | `hs-operate` | Structured logs, error tracking, health checks, alerts, runbooks |
| 7 Launch | `hs-launch` | Pre-launch audit, legal pages, promo/product videos via HyperFrames |
| 8 Scale | `hs-scale` | Load tests, readiness review, measured optimisation, cost model |

## How it works

- **State in files.** `.hyperskill/state.json` plus `CLAUDE.md` and `docs/` let any new session resume.
- **Gates with evidence.** `scripts/hyperskill.py gate <phase> --pass id --evidence "..."`; `advance` refuses while any item is open. Evidence must be checkable (a path, a command, a count); items can be waived only with a written reason. `init --tenancy user|organization|none --unavailable host,provider,device,human` adapts the gates to the project and records environment-limited waivers in one step.
- **Decisions are yours.** Stack, tenancy, providers and limits are asked, then recorded as `docs/decisions/NNNN-*.md`.
- **Fresh-eyes reviews.** Security and test-quality reviews run in the read-only `hs-reviewer` agent.
- **Skill slots and a vetted registry.** Phases ask for capabilities (design direction, animation, design critique, security audit, browser verification, video, ...). `skills/hyperskill/integrations.json` maps each slot to vetted third-party skills with licence, risks and policy; `scripts/hyperskill.py integrations` resolves what to use given what's installed. Recommended providers are used when present, opt-in ones only after `integrations enable <id>`, noncommercial-licence tools are blocked on commercial projects, and everything has a built-in fallback. Nothing is installed without asking. See `skills/hyperskill/references/integrations.md` and `docs/integrations-review.md`.

## External skills it can orchestrate

HyperFrames (video) - taste-skill or UI UX Pro Max, impeccable, emilkowalski/skills (design chain; one direction voice per project) - `npx skills` installer - Chrome DevTools for agents (browser, a11y, performance) - Cloudflare security-audit (sandboxed) - karpathy guidelines - and, opt-in: /watch, herdr, open-code-review, gstack, Superpowers, better-icons, Uizze, Vercel Web Interface Guidelines, Symphony, Qwen3-TTS. Ponytail and Hypit are opt-in; SlopMonster's local checker reviews copy. MiroFish, OpenUI, REA, API Anything and the rest of the LOOT guide are reference-only. `onetake` is blocked for commercial use (PolyForm Noncommercial). Phase-by-slot map: `skills/hyperskill/references/integrations.md`.

## Install

```
/plugin marketplace add raj742133/HyperSkill
/plugin install hyperskill@hyperskill
```
Then in a project: `/hyperskill "a short description of your idea"`. Other commands: `/hyperskill-status`, `/hyperskill-gate [phase]`.

Requires Python 3 (standard library only) for the state tracker. The launch phase additionally needs Node 22+, FFmpeg and (for speech-timed work) whisper-cpp.

## Installing the tools it orchestrates

HyperSkill never installs anything itself. `bash scripts/install-skills.sh --dry-run` prints the exact commands to install the recommended and opt-in skills (design chain, security audit, discipline, video) on your machine; remove `--dry-run` to run them, then restart your agent and run `python3 scripts/hyperskill.py integrations`. Blocked, reference-only and heavyweight tools are deliberately left out (the script says which and why). Installed skills run with your agent's permissions: read them first.

## Launch site

`site/` is a static page (no build step, no tracking) that shows the pipeline, the vetted tool registry and a real run of the tracker. Its data comes from the repository files: `python3 scripts/build_site.py` regenerates `site/data.js`, and a test fails if it is stale.

Deploy on Vercel by importing this repository: `vercel.json` already sets `outputDirectory` to `site`, no build or install command, and a strict Content-Security-Policy. The default and production branch is `main`. Or from a terminal with your own account: `npx vercel --prod`. Preview locally with `python3 -m http.server -d site 8000`.

## Develop

```
python3 -m unittest discover -s tests -v
```

## Sources and licensing

See [`docs/sources.md`](docs/sources.md). HyperSkill is MIT-licensed (`LICENSE`). Its reference guidance was rewritten in original wording from supplied guides that state no licence; that is not a legal clearance, so read the licensing status before publishing.
