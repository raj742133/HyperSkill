# Working loop for every task (all build phases)

Condensed from a beginner "vibe coding" guide the owner supplied, in our own words.

## Project files the agent reads first
`CLAUDE.md` (rules, stack, commands) - `docs/system-design.md` (what and why, incl. **out of scope**) - `docs/architecture.md` (how) - `docs/design.md` (look and feel) - `docs/decisions/` (permanent choices) - `TASKS.md` (what next) - `MEMORY.md` (current state: done, in progress, known issues, next step) - `docs/test-plan.md` and `docs/security.md` once those phases start.
Rule: **decisions are permanent and logged once; memory is the current state and is rewritten every session.** Update both when reality changes, or the next session works from fiction.

## Start of a session
Read the files above. Do not change anything. State: what the product is, the architecture, the rules, the current task, what information is missing, and the plan for the task. Wait for a yes before coding anything large.

## One task, one loop
read -> understand -> plan -> implement -> test -> review -> fix -> commit -> update `TASKS.md` and `MEMORY.md`.
- Tasks are small (one screen, one rule, one endpoint). "Build authentication" is too big; "create the signup form UI, no logic yet" is right.
- Prefer **vertical slices**: one complete user flow (create -> save -> display, then edit, then delete) over layer by layer. Failures are easier to locate.

## Structured task prompt
CONTEXT (which docs apply) - TASK (one thing) - FILES (where to look) - CONSTRAINTS (follow architecture, reuse components, no unrelated edits, validate input) - ACCEPTANCE CRITERIA (observable, testable) - TESTING (what to run). Finish with the closing report in `hyperskill/SKILL.md` section 3.

## Debugging prompt
Give: the error text, expected behaviour, actual behaviour, reproduction steps, constraints (e.g. no schema change). Then **diagnose before editing**: what fails, why, which file, the smallest fix, how it will be tested. Implement only that fix, add a test that failed before it, run the relevant tests.

## Review pass
Check the change against the PRD/design, architecture, design system, rules, test plan and security docs: correctness, architecture, security, error handling, accessibility, responsiveness, performance, duplication. Report first, fix one at a time. Use `hs-reviewer` so the reviewer is not the author.

## Beginner / lite profile
For a small learning project, start with only: requirements doc (with out-of-scope), rules (`CLAUDE.md`), `TASKS.md`, README, `.env.example`. Add architecture, design, test plan, security, decisions and memory files as the project grows. The gates still apply to anything real users will touch; lite means fewer documents, not weaker checks.

## Environments
Local -> preview -> QA -> production, with separate env values per environment. Production is never the first place a change is tested; after deploy, test the live URL (refresh, direct URLs, logged-out access, invalid input, slow network, empty data, wrong credentials).
