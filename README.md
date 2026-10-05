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
- **Gates with evidence.** `scripts/hyperskill.py gate <phase> --pass id --evidence "..."`; `advance` refuses while any item is open. Items can be waived only with a written reason.
- **Decisions are yours.** Stack, tenancy, providers and limits are asked, then recorded as `docs/decisions/NNNN-*.md`.
- **Fresh-eyes reviews.** Security and test-quality reviews run in the read-only `hs-reviewer` agent.
- **Skill slots and a vetted registry.** Phases ask for capabilities (design direction, animation, design critique, security audit, browser verification, video, ...). `skills/hyperskill/integrations.json` maps each slot to vetted third-party skills with licence, risks and policy; `scripts/hyperskill.py integrations` resolves what to use given what's installed. Recommended providers are used when present, opt-in ones only after `integrations enable <id>`, noncommercial-licence tools are blocked on commercial projects, and everything has a built-in fallback. Nothing is installed without asking. See `skills/hyperskill/references/integrations.md` and `docs/integrations-review.md`.

## External skills it can orchestrate

HyperFrames (video) - taste-skill, impeccable, emilkowalski/skills (design chain) - Chrome DevTools for agents (browser, a11y, performance) - Cloudflare security-audit (sandboxed) - karpathy guidelines - and, opt-in: /watch, herdr, open-code-review, gstack. `onetake` is blocked for commercial use (PolyForm Noncommercial). Phase-by-slot map: `skills/hyperskill/references/integrations.md`.

## Install

```
/plugin marketplace add raj742133/HyperSkill
/plugin install hyperskill@hyperskill
```
Then in a project: `/hyperskill "a short description of your idea"`. Other commands: `/hyperskill-status`, `/hyperskill-gate [phase]`.

Requires Python 3 (standard library only) for the state tracker. The launch phase additionally needs Node 22+, FFmpeg and (for speech-timed work) whisper-cpp.

## Develop

```
python3 -m unittest discover -s tests -v
```

## Sources and licensing

See [`docs/sources.md`](docs/sources.md). The guidance here is condensed and rewritten from two supplied guides; review the licensing note before publishing this repository publicly.
