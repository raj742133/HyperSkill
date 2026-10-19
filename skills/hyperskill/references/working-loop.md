# Working loop for build tasks

This is how a single piece of work proceeds in any build phase. The orchestrator's rules in `hyperskill/SKILL.md` still apply.

## Two kinds of project memory

| Kind | Files | Changes |
|---|---|---|
| Durable choices | `docs/decisions/` (written by `hyperskill.py decide`) | Added once, superseded rather than edited |
| Current state | `MEMORY.md` (done, in progress, known problems, next step) and `TASKS.md` (queue) | Rewritten at the end of every session |

Alongside them: `CLAUDE.md` (rules, stack, commands), `docs/system-design.md` (including out of scope), `docs/architecture.md`, `docs/design.md` once a UI exists, and the test and security docs once those phases begin. A stale memory file is worse than none, because the next session will believe it.

## Opening a session

Read before touching anything. Then tell the owner, in a few lines: what the product is, the architecture in brief, the rules that apply, the task at hand, what you still do not know, and your plan. For anything large, wait for a go-ahead.

## Sizing the task

A good task fits in one sitting and has an observable result: "the signup form renders and shows validation messages" rather than "build accounts". Prefer a **vertical slice**, meaning one thin path through every layer (create, store, show; then edit; then delete) over finishing a whole layer first. When something breaks you will know which slice caused it.

## The cycle

understand -> plan -> implement -> test -> review -> fix -> commit -> update `TASKS.md` and `MEMORY.md`

Commit once per concern, on a branch. If the task grows while you work, stop, commit what is coherent, and split the rest into new entries in `TASKS.md`.

## Briefing yourself or a subagent

Write the task down in these parts: which docs apply; the single thing to do; where in the code to look; limits (follow the architecture, reuse existing components, no unrelated edits, validate input); how the owner will recognise success; which commands to run. End with the closing report from `hyperskill/SKILL.md` section 3.

## Debugging

Collect the exact error text, what should happen, what does happen, the steps to reproduce, and any limits on the fix. Explain the cause before editing: which file, why it fails, the smallest change, how you will test it. Then make only that change, with a test that fails without it, and run the nearby tests.

## Review

Compare the change with the design, architecture, rules and any test or security notes. Look at correctness, structure, security, error handling, accessibility, responsive behaviour, performance and copy-pasted logic. List findings first and fix them one at a time. Use `hs-reviewer` so that the author is not the judge.

## Lite profile

For a small learning project keep only: a requirements note with out-of-scope, `CLAUDE.md`, `TASKS.md`, a README and `.env.example`. Add the other documents when the project needs them. Lite means fewer files; the gates stay as strict for anything real users will touch.

## Environments

Changes move from local to preview to production (add a QA step if the team has one), each with its own configuration. Production is never the first place something runs. After a release, open the live URL and try a hard refresh, a deep link, a logged-out visit, invalid input, an empty account, wrong credentials and a throttled connection.
