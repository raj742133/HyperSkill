# Dogfood report: HyperSkill run on DueSoon

A real run of all nine phases on a small idea (student deadline tracker), driven by `scripts/hyperskill.py` with the gates in `skills/hyperskill/gates.json`. Final tracker: `docs/dogfood/state.json`.

## Outcome
- Pipeline reached `complete`: **72 gate items, 49 passed with evidence, 23 waived with a written reason.**
- The result is a working app: 66 unit/integration tests, 17 browser tests (Chromium, keyboard, phone width, offline, axe), 12 of 13 mutation checks killed (the 13th is expected, see below), `npm audit` 0 vulnerabilities.
- It is **not launch-ready** (`docs/prelaunch.md`): no deployment, CI never run, no rollback rehearsal, no staging, no error tracker, no wired alerts, no billing alerts, no legal pages, home-made password handling.

## What worked
- **Gates forced evidence.** Several gates failed the first time for real reasons: a negated `grep` that passed on a path that did not exist, a `gate --run` command that `cd`-ed into a directory the runner was already in, a discarded load test that was measuring 429s. Each would have been "done" in a normal chat.
- **Independent reviewers found what the author could not.** A fresh read-only reviewer for the design stress test, one for the design critique and one for security. The security review found a real bypass (login limit keyed on the un-trimmed email: padding with spaces gave a fresh budget), an unbounded rate-limiter map reachable before auth, a hard-coded `trust proxy`, and a fail-open `NODE_ENV` default. All were fixed with regression tests. One review claim did not reproduce on this version (invalid percent-encoding in a static path already returned a clean 404); the related body-parser case (unknown `Content-Encoding` returned 500 plus a logged stack) did, and is now a 415.
- **The mutation check caught a weak test of my own.** After the fixes, the "list ignores due-date order" mutant survived once because the test relied on random UUID ordering (1 in 24 chance of passing by luck). It is now a deterministic 12-row test.
- **Recording waivers instead of hiding gaps** produced a usable list of what a launch still needs.

## Where HyperSkill was too heavy or too loose
1. **Tenancy assumption.** Gates say `organization_id`, cache two-org tests, webhooks. A per-user app needed waivers or re-reading. Add a `tenancy: user | organization | none` setting at `init` and select gate wording from it.
2. **Sandbox-unrealistic gates.** CI blocking, rehearsed rollback, staging, real-device test, error-tracker latency and alert firing cannot be done without an account or hardware. They became 23 waivers, of which about 10 are structural. Mark such items `needs: [deploy-target|device|account]` so a dry run can skip them as a category and say so in one line.
3. **`gate --run` output is noisy.** It prints the whole phase gate list after every call. It should print only the item it touched.
4. **Command checks can pass vacuously.** `! grep ...` succeeds when the file is missing. The runner should reject a check whose referenced paths do not exist, or the docs should require a positive guard (`test -d src &&`). I added the guards by hand and tested one against a seeded empty `catch`.
5. **Working directory.** Commands run in the project root; the playbook text suggested otherwise. State it once in `hs-ship`.
6. **Passing is too easy to over-claim.** I passed `cost-model` with a capacity-only model and then caught myself and changed it to a waiver. A `--pass` should require the evidence to name a file or command output; a waiver is better than a soft pass.
7. **The phases are sound but sequential.** In practice review, hardening and docs interleave. It worked, but a dry run on a one-person app spent a lot of effort on ceremony (nine decision records, threat model, five runbooks) relative to a codebase of about 1,150 lines (474 of them server code).

## Where the external skills were too heavy or did not fit
- **design-taste-frontend (app screens):** the app-screens reference alone is 83 KB. The draw/inspect scripts were useful, but the inspector cannot log in, refuses to run as root without a wrapper, reads only the first `h1`, and flags `example.com` as placeholder data. All worked around, none fixed upstream.
- **impeccable:** its launcher downloads a prebuilt binary on first run. I did not run it (nothing unvetted gets executed without your say-so) and used an isolated subagent critique instead. `docs/design-audit.md` carries a **DEGRADED** banner: the detector never ran, and findings are from code and screenshots.
- **security-audit:** its sandboxed multi-phase workflow was not run; the review used its checklist only, read-only, with no code executed (stated at the top of `docs/security/audit.md`).

## Honest limits of this run
- Critique and review were done by model subagents, not humans; no real student used the app, so `user-evidence` and `go-no-go` are waived.
- The load test ran client and server on one machine; numbers are indicative only.
- Nothing was deployed; hosting, monitoring and CI are plans or files that never ran.
- `can()` is, by mutation check, redundant with the `user_id`-scoped queries (the surviving mutant is expected). It was kept as defense in depth; a reviewer advised dropping it, and I declined.
- Detector tools, a real-device test, and a human pen-test were not run.
