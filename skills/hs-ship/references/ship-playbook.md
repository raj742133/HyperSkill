# Ship playbook

Practical checks for getting changes to production safely. `hs-ship/SKILL.md` sets the order; this file explains what "done" looks like for each part. Tool names below are examples of a category; the owner picks.

## Tests: what to write and what to trust

Write `docs/testing.md` stating the mix: many fast unit tests on service logic, a thinner layer of integration tests that call real endpoints against a real test database, and a small set of browser end-to-end tests for the journeys that must never break (signup, login, the core workflow, billing or plan change, inviting a teammate). Say what may be mocked (third-party APIs you do not control) and what may not (your own database, your own permission checks).

When adding tests to existing code, per module cover: normal use, invalid input, edge values, permission denied, and another tenant's data. Leave the code under test alone. If a test uncovers a defect, stop and report it instead of bending the test.

Fixing a bug: write a test that reproduces it and watch it fail, change the code, watch it pass, run the whole suite.

Quality checks you can run yourself:
- **Mutation sanity.** Pick a line of business logic (flip a comparison, remove a permission check), run the suite, and expect a failure. Revert and paste both outputs. If everything stays green, the tests are decoration.
- **Skips.** `grep -rnE "\.skip|xit\(|xdescribe|mark\.skip|pytest\.skip" tests/` (adjust paths); each hit needs a comment saying why and when it can return.
- **Test-file diff.** After any agent session, look at the diff of test files you did not ask to change.
- Ask `hs-reviewer` to hunt for assertions that only check a mock was called, flaky tests, and critical paths without coverage.

## Git discipline

- `.gitignore` covers env files, build output, dependency folders and editor/OS litter.
- A pre-commit hook formats and lints staged files and runs a secret scanner (gitleaks and similar tools exist for this).
- Work on a branch per task; commits are small and use Conventional Commits (`feat:`, `fix:`, `chore:`), documented in `CLAUDE.md`.
- Scan the whole history, not just the working tree, for credentials. If one is found, rotate it first; rewriting history comes second.

## Continuous integration

On every pull request and push to the default branch: restore cached dependencies, lint, typecheck, unit tests, integration tests with a disposable Postgres service, build. Order cheap checks first so failures arrive quickly; aim for ten minutes or less. Make the check required in branch protection, then open a throwaway PR with a deliberately failing test and confirm the merge button is blocked. Keep the link as evidence.

## Deployment path

Target shape: each PR gets a preview; the default branch goes to staging by itself; production waits for a human approval. Ask the owner whether production may auto-deploy.

Database migrations run as a deploy step before the new version receives traffic. The deploy stops if a migration errors. Write migrations so the previous app version still works against the new schema (add columns before using them, drop them a release later); that is what makes rollback possible.

Rollback: write `docs/runbooks/rollback.md` (redeploy the last good build, what to do about a migration, who decides). Then do it once for real on staging and record the commands and timing.

## Environments and configuration

- All configuration comes from environment variables; `.env.example` lists each with a comment and no real values.
- At startup, validate the variables with a schema and exit with a message naming the missing or malformed one. Test it by unsetting one.
- Local, staging and production each have their own database, storage and third-party keys. A staging bug must never be able to touch production data.
- No URLs, keys or IDs for a particular environment in source code.

## Hosting and production readiness

Draft `docs/hosting.md`: for each component (web, API, database, storage, jobs, email), the provider, plan, rough monthly cost now, rough cost if usage grows tenfold, and what would need to change. Label cost figures as estimates from the provider's current price page. Favour managed platforms for a small team; container orchestration and infrastructure-as-code can wait until there is a reason.

Before first launch: custom domain with HTTPS, standard security headers, a separate production database with automated backups switched on, the platform's health check pointing at `/api/health`, graceful shutdown so in-flight requests finish during a deploy, and `docs/runbooks/deploy.md` for the first release. Set a billing alert on every provider account.
