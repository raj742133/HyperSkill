---
name: hs-plan
description: HyperSkill phase 1 - turn a validated idea into a system design, architecture, decision records and a running scaffold. Use after research, or when the user needs requirements, an architecture, a tech-stack choice, or a project scaffold before writing features.
---

# Phase 1 - Plan (system design and architecture)

Goal: agree **what** is being built and **how it is shaped** before features exist. Output: `docs/system-design.md`, `docs/architecture.md`, `docs/decisions/*.md`, an updated `CLAUDE.md`, and a scaffold that boots. No features yet.

Read `references/plan-playbook.md` for the detailed prompts and traps for each step.

## Owner decisions

- Customer type: individual / team / organisation (decides tenancy and the data model).
- Pricing model: free tier, per seat, usage-based.
- Year-one load: users, requests per day, data size.
- Non-negotiables: uptime, data privacy, compliance regime.
- Stack: language and framework **the owner can debug at 2 a.m.** Recommend; they choose. Prefer a modular monolith and managed services unless there is a strong reason not to.

## Steps

1. **Requirements interview.** Don't write code. Interview in groups, one group at a time: users and roles; the 3-5 core workflows; tenancy; data and sensitivity; scale; billing; compliance; integrations. Then write `docs/system-design.md` (problem, roles, flows, functional and non-functional requirements, out-of-scope, open questions).
2. **Stress-test.** Spawn `hs-reviewer` on the design as a skeptical staff engineer: missing requirements, ambiguous flows, scaling/privacy risk, over-engineering for this stage. Resolve or explicitly accept each finding.
3. **Capacity sketch.** Peak requests/second, DB size, file storage, background-job volume, with the maths shown and the first bottleneck named.
4. **Architecture.** Propose (don't build) in `docs/architecture.md`: Mermaid component diagram; one stack choice per layer with a rejected alternative; folder structure; where background jobs run; third-party services with cost; the 3 riskiest decisions.
5. **Decision records.** `hyperskill.py decide` for each major choice (it writes `docs/decisions/NNNN-*.md`; fill in alternatives and consequences).
6. **Project memory.** Create/update `CLAUDE.md` from `references/claude-md-template.md`: product, stack, rules, commands, pointers to docs. If the owner also uses Codex, mirror it to `AGENTS.md`.
7. **Scaffold.** Folder structure, strict typing, linter, formatter, `.env.example` (every variable commented), README with setup, `/api/health`. Prove it by starting the dev server and hitting the endpoint.

## Pitfalls

- Inventing requirements nobody agreed to. Anything not in the design goes to "open questions".
- Microservices for ten users; or a toy design with no concurrency or multi-tenancy.
- Three date libraries and two HTTP clients: justify each dependency or remove it.
- Business logic inside UI components or route handlers. Put it in a service/domain layer from day one.
- Forgetting background jobs (email, webhooks, exports) and doing them inside requests.

## Gate

`hyperskill.py gate plan`. Evidence: the file paths, the reviewer's report, and the output of the health-check request.
