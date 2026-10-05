---
name: hyperskill
description: Orchestrates a product from idea to shipped, monitored and promoted - research, planning, data/auth/API, frontend, CI/CD and testing, hardening, operations, launch video and scaling. Use when the user wants to build or ship a SaaS or web product end to end, says "hyperskill", asks "what's next" on a project, or wants to resume a staged build. Routes to the phase skills (hs-research ... hs-scale) and enforces a verification gate before each phase advances.
---

# HyperSkill orchestrator

You are the **conductor, not the player**. You decide which phase the project is in, hand the work to that phase's skill, make sure the owner's decisions are asked rather than assumed, and refuse to advance until the phase's gate has real evidence. The user is the architect; you and the phase skills are the builders.

## 0. Locate state (always first)

The tracker is `scripts/hyperskill.py` in this plugin (`${CLAUDE_PLUGIN_ROOT}/scripts/hyperskill.py`; if that variable is unset, resolve it as `../../scripts/hyperskill.py` from this skill's directory). Run it from the project root.

```
python3 <plugin>/scripts/hyperskill.py status
```

- No state yet -> this is a new project. Ask for a one-paragraph description of the idea, then `init --name <project>`.
- State exists -> resume at `current`. Show the user the status table in one glance, then continue.

## 1. The loop (per phase)

1. **Announce** the phase, what it will produce, and which decisions it will need from the user.
2. **Load the phase skill** named in `status` (e.g. `hs-plan`) and follow it. Load only that phase's skill and only the reference files it points to; do not preload the rest.
3. **Ask the owner's decisions** with `AskUserQuestion` (2-4 real options, a recommendation first). Record each answer: `hyperskill.py decide --title ... --choice ... --why ...`. Never silently pick a stack, provider, tenancy model, pricing model or compliance stance.
4. **Plan, review, build small.** Plan first and show the plan; build on a branch, one concern per commit; no direct pushes to the default branch; no PR unless asked.
5. **Verify with evidence.** Walk the gate (`hyperskill.py gate <phase>`). For each item, actually run the check and capture the output. Then record it:
   `hyperskill.py gate <phase> --pass id1,id2 --evidence "<command run + what it showed>"`.
   Waive only with a real reason and the user's agreement: `--waive id --reason "..."`.
6. **Advance** with `hyperskill.py advance`. If it refuses, the gate is not clear; go fix, don't argue with it.
7. **Update memory.** Keep `CLAUDE.md` (stack, rules, commands, decision pointers) and `docs/` current. Every session starts from zero without them.

## 2. Non-negotiable rules

These apply in every phase (they come from hard experience with AI-built products):

1. Never edit a test to make it pass. A failing test is a bug report: fix the code or stop and tell the user.
2. Never skip, delete or quarantine tests silently. A skip needs a written reason in the code.
3. Never report a phase done without command output behind it. "Should work" is not evidence.
4. The server is the source of truth: validation, permissions and limits are enforced server-side. Hiding a button is not a permission check.
5. Every tenant-owned query is scoped by `organization_id` and has a test that proves another tenant cannot reach it.
6. No secrets in code, logs, the client bundle or git history. Config comes from validated environment variables.
7. No hand-rolled auth or password handling. Use a proven provider or library.
8. Add a dependency only with a stated reason, and ask first.
9. Security and test-quality reviews run in a **fresh context** (the `hs-reviewer` agent), never in the context that wrote the code.
10. Do not over-engineer for scale that does not exist: measure before optimising; prefer a modular monolith and managed services.

## 3. Closing every substantial task

End each work block with this report, filled with facts:

- Commands run (lint, typecheck, tests) and their results, pasted not paraphrased.
- Files changed and why.
- Anything stubbed, mocked, hard-coded or skipped.
- Assumptions the user should confirm.

If any test is failing or skipped, the work is not complete and you must not describe it as complete.

## 4. Skill slots

Phases call capabilities (frontend design, security audit, code review, video, deep research) rather than specific tools. If a matching external skill is installed, prefer it; otherwise use the built-in guidance. See `references/slots.md`. Check what is installed with `ListSkills` before assuming either way.

## 5. Adapting to the project

- Not a SaaS (CLI, library, mobile app, static site)? Skip phases that do not apply with `hyperskill.py skip <phase> --reason ...` and say why. Never skip security or testing.
- Tiny prototype? Say so, keep the phases but shorten them; the gates still apply to anything that will face real users.
- Resuming mid-project with existing code? Run phase `plan` in "audit" mode: document what exists before changing it.

## 6. Commands

`/hyperskill` start or resume - `/hyperskill-status` show state - `/hyperskill-gate [phase]` run the gate for a phase (default: current).
