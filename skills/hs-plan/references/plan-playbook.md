# Plan playbook

Use this alongside the steps in `hs-plan/SKILL.md`.

## Pin down the requirements

Produce `docs/system-design.md`. Interview the owner first, one topic at a time: users and roles, the few workflows that must work, who owns the data, what is stored and how sensitive it is, year-one load, billing, legal or regional rules, outside services.

Structure the document as: problem, roles, main flows, functional requirements, non-functional requirements (latency, availability, privacy), out of scope, open questions.

Checks:
- **Tenancy is stated in one sentence** (individual, team or organisation). It changes every table and every query later, so do not leave it implied.
- **Out of scope is a real list.** Without it, every later session adds features nobody asked for.
- Anything you guessed goes under open questions, not into the requirements.
- The owner has read the whole file and can say back what the product does and for whom.

## Attack your own design

Hand the design to `hs-reviewer` with this brief:

> Read `docs/system-design.md` cold. List what is missing, which flows are ambiguous, where load or data volume would hurt, where one customer's data could reach another, and what is heavier than this stage needs. Order findings by impact. Do not edit anything.

For each finding, either change the design or write "accepted" with a reason. Silence is not acceptance.

## Size it on paper

Estimate year-one numbers from the stated user count: peak requests per second (daily requests over 86,400 seconds, times a peak factor you state), database size, stored files, background work per day. Show the arithmetic and name the component most likely to saturate first. Tiny numbers justify a simple architecture; say so.

## Shape the architecture

Write `docs/architecture.md` before any code. Include:
- a Mermaid diagram of components and the arrows between them;
- one choice per concern (language, framework, database, auth, hosting, jobs), each beside the alternative you rejected and why;
- the repository layout;
- where slow or retryable work runs (email, exports, webhooks);
- paid third-party services, with cost flagged as an estimate;
- the three decisions that would hurt most to reverse.

Defaults: a modular monolith, managed services, and a stack the owner can maintain. Record each significant choice as a decision record (context, options, choice, consequences) via `hyperskill.py decide`.

Test: the owner can explain every box and every arrow without help. If they cannot, simplify or teach before moving on.

## Keep dependencies and layers honest

- Every entry in the package manifest gets a one-line reason in the architecture doc or a decision record. Remove duplicates that do the same job.
- Business rules live in a service or domain module. Route handlers and UI components call it; they do not contain it.

## Scaffold and prove it boots

Create the folders, strict typing, linter, formatter, a fully commented `.env.example`, a README with setup steps, and a `/api/health` route. No product features. Start the dev server, call the endpoint, and paste the response as evidence. Then write `CLAUDE.md` from the template: stack, rules, commands, links to the docs and decisions.
