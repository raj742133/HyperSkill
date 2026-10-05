---
name: hs-ship
description: HyperSkill phase 4 - version control hygiene, CI/CD pipelines, test strategy and hosting/environment setup so code can be shipped and rolled back safely. Use for GitHub Actions, preview/staging/production deploys, migrations in deploy, writing or auditing tests, hosting choices, env-var validation, or production readiness.
---

# Phase 4 - Ship (CI/CD, testing, hosting)

Goal: any change reaches production only after automated proof, can be rolled back, and runs in environments that are properly separated. Detail: `references/ship-playbook.md`.

## Owner decisions

- Branching (default: default branch is always deployable; feature branches + PRs). Environments: local, staging/preview, production. Auto-deploy to production or manual approval.
- What must never break (signup, login, billing, core workflow, data isolation) - these get end-to-end tests.
- Coverage target (70-80% on business logic is sensible; 100% rarely is).
- Hosting platform, region (users and data-residency), monthly budget ceiling. Managed platforms are the right early choice.

## Steps

1. **Git hygiene.** `.gitignore` (env files, build output, OS/editor files); pre-commit hook running lint/format on staged files; secret scanner in pre-commit (e.g. gitleaks); Conventional Commits documented in `CLAUDE.md`. Scan the **full git history** for committed secrets and report.
2. **Test strategy** in `docs/testing.md`: unit (services), integration (API + real database), end-to-end (Playwright) for critical flows. State what is mocked (external APIs only) and what never is (own DB, own auth checks). Set up tooling for all three.
3. **Tests for existing code** by module: happy path, invalid input, boundaries, permission denied, cross-tenant. **Do not modify code under test**; if a test reveals a bug, stop and report. Bug fixes are test-first: failing test shown, fix, passing test, full suite green.
4. **CI.** GitHub Actions on PRs and pushes to the default branch: cached install -> lint -> typecheck -> unit -> integration (real Postgres service container) -> build. Fail fast, < 10 minutes, badge in README.
5. **CD.** PR preview deploys; default branch -> staging automatically; production behind manual approval; migrations run in the deploy *before* new code serves traffic and a failed migration fails the deploy; rollback documented in `docs/runbooks/rollback.md` and **practised once**.
6. **Hosting.** `docs/hosting.md`: per component the provider, plan, monthly cost at launch and at 10x, what changes at 10x.
7. **Environment config.** Everything via env vars; `.env.example` complete; startup validation that fails loudly on missing/malformed values; separate values for local/staging/production; no hard-coded URLs, keys or IDs.
8. **Production readiness.** Custom domain + HTTPS, security headers, separate production DB with automated backups, health check wired to the platform, graceful shutdown, `docs/runbooks/deploy.md` for first deploy. Billing alerts on every provider.
9. **Test quality review** via `hs-reviewer`: tests that would still pass if the feature broke, assertions only on mocks, skipped/flaky tests, uncovered critical paths. Deliberately break a line of business logic and confirm a test fails.

## Pitfalls

- Tests that test the mocks. The agent "fixing" a failing test instead of the code. Quiet skips and deletions. Only happy paths.
- Huge commits mixing unrelated changes; `.env` committed; no CI so broken code ships; manual, inconsistent migrations.
- Staging and production sharing a database or keys; hard-coded environment differences; kubernetes/terraform for a 3-person team.
- After every agent session, diff for changes to test files you didn't ask for.

## Gate

`hyperskill.py gate ship`. Evidence: CI run URL/log for the deliberately failing PR, the rollback transcript, the mutation check output, `grep` for skips.
