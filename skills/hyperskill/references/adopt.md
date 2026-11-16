# Adopt mode: starting from an existing project

Use this when the project already exists (code, history, maybe users) and the goal is to understand it, bring it up to the gates, or restructure it. HyperSkill's normal phases assume an idea; adopt mode adds the missing first step: **read what is there, then change nothing until today's behaviour is pinned by tests.**

## Start

```
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/hyperskill.py init --adopt        # new tracker state in an existing repo
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/hyperskill.py adopt               # (re)scan; also works on a project already initialised
```

`adopt` reads the files on disk (it never follows symlinks, skips dependency and build folders, and never prints the text of anything that looks like a secret) and writes:

- `docs/adopt/inventory.md`: languages, package managers and frameworks, tests, CI, git facts, where the code lives, the largest files, **risks found** and **gate checks the files may already answer**.
- `docs/adopt/inventory.json`: the same, for tools.
- `docs/adopt/restructure-plan.md`: a skeleton to fill in (goal, behaviour that must not change, steps, order, out of scope). It is never overwritten.

It also turns on four adopt-only checks (`hyperskill.py adopt status` shows them): `inventory-read` and `behaviour-pinned` and `restructure-plan` in the plan phase, `restructure-steps-proven` in foundation. They do not exist for projects started from an idea.

## The order of work

1. **Read the inventory with the owner and correct it.** The scan is a guess about structure, not a verdict. Fix what it got wrong in the file. Pass `inventory-read` with the file as evidence; a person who knows the project must have looked at it.
2. **Deal with the high risks first**, and say so in a decision: a committed `.env` or a secret in source means rotate it before anything else; no git means `git init` and a first commit; no tests means the next step is mandatory.
3. **Pin today's behaviour.** For every area the restructure will touch, write characterisation tests: they assert what the code does *now*, even where that looks wrong. They must pass before the first change. Run them and record the result as evidence for `behaviour-pinned`. If the area cannot be tested without changing it, make the smallest change that makes it testable, as its own commit.
4. **Write the restructure plan.** Small steps; each names its files, how to prove behaviour is unchanged, and how to undo it. One step changes structure *or* behaviour, never both. Order the steps so the least-tested code moves last, and put anything touching data, auth or money behind a fresh-context review (`hs-reviewer`).
5. **Do the steps one at a time**, each its own commit, each followed by the pinning tests. Use helper agents for independent steps (`hyperskill.py work add ... --kind refactor`); steps that touch the same files never run together. Record each step's test run in the plan; pass `restructure-steps-proven` only when all are done.
6. **Then the normal gates apply**, with the inventory's "evidence candidates" as hints. A candidate is a place to look, not a pass: open the file, confirm it satisfies the check, and pass it with evidence as usual. Checks that cannot apply to this project are waived with a written reason, never silently.

## What not to do

- Do not rewrite in one go, rename and change behaviour in the same commit, or "tidy" code that has no test.
- Do not weaken or delete an existing test to make a step pass.
- Do not treat a clean scan as a clean bill of health: it does not run the tests, read the database, or see the deployed system.
