# Ship playbook (layers 7-9)

## Layer 7 - CI/CD and version control

Agent mistakes: huge mixed commits; committed `.env`; no CI; manual and inconsistent migrations.

Hygiene prompt:
> Set up version-control hygiene: a `.gitignore` covering env files, build output, OS and editor files; a pre-commit hook that lints and formats staged files; a secret scanner in pre-commit; Conventional Commits documented in `CLAUDE.md`. Then scan the full git history for committed secrets and report.

CI prompt:
> Create a GitHub Actions workflow for PRs and pushes to the default branch: install with caching -> lint -> typecheck -> unit tests -> integration tests against a real Postgres service container -> build. Fail fast; keep it under 10 minutes; add a status badge to the README.

CD prompt:
> Set up deployments: every PR gets a preview; merging to the default branch deploys staging automatically; production requires a manual approval step; DB migrations run automatically as part of deploy before the new code goes live and the deploy fails if a migration fails; document rollback in `docs/runbooks/rollback.md`.

Agent-in-git prompt:
> From now on: new branch per task, small commits with clear messages, and a PR description covering what changed, why, how to test, and risks. Never push directly to the default branch.

Verify: a PR with a deliberately failing test is blocked; you've rolled back once on purpose; `git log` reads like a story.

## Layer 8 - Testing

Types: unit (one function), integration (API + DB), end-to-end (real browser).
Agent mistakes: tests of mocks; changing the test to make it pass; quietly skipping or deleting failing tests; happy path only.

Strategy prompt:
> Write `docs/testing.md`: unit tests for service logic; integration tests for every API endpoint using a real test database; Playwright e2e for signup, login, <core workflow>, upgrade plan, invite teammate; what is mocked (external APIs only) and what is never mocked (our DB, our auth checks). Set up tooling for all three levels.

Existing-code prompt:
> Write tests for <module>. For each function cover happy path, invalid input, boundaries, permission denied, cross-tenant access. Do not modify the code under test. If a test exposes a bug, stop and report it rather than changing the test.

Bug-fix prompt:
> Bug: <description + repro>. 1) Write a failing test that reproduces it and show it failing. 2) Fix the code. 3) Show the test passing and the full suite green.

Review prompt (use `hs-reviewer`):
> Critically review the suite. Find tests that would still pass if the feature were broken, tests that only assert on mocks, skipped tests, flaky tests, important paths with no coverage. Prioritised list.

Verify: break a line of logic -> a test fails; `grep` for `.skip`, `xit`, `mark.skip`, each has a reason; diff test files after each agent session.

## Layer 9 - Hosting and cloud

Agent mistakes: Kubernetes/Terraform way too early; sharing one DB between staging and prod; hard-coded per-environment config; ignoring cost.

Hosting prompt:
> Recommend hosting for the architecture in `docs/architecture.md`. Constraints: small team, minimal ops, users mostly in <region>, budget ~<amount>/month at launch. For each component (frontend, backend, database, storage, background jobs, email): provider, plan, estimated monthly cost at launch and at 10x users, and what changes at 10x. Write `docs/hosting.md`.

Env prompt:
> Make the app fully configurable by environment variables: `.env.example` listing and explaining every variable; startup validation that fails loudly if a required variable is missing or malformed; separate values for local/staging/production; nothing hard-coded. List every place you changed.

Readiness prompt:
> Prepare production on <platform>: custom domain + HTTPS, security headers, separate production DB with automated backups, a health-check endpoint wired to the platform, graceful shutdown so in-flight requests finish during deploys. Write `docs/runbooks/deploy.md` with first-deploy steps.

Verify: staging and production use different databases and keys; billing alerts exist on every provider; removing a required env var makes the app refuse to start with a clear message.
