# Pre-launch audit (HyperSkill `hs-launch/references/prelaunch.md`)

**Verdict: DueSoon is NOT launch-ready.** It is a dry run; nothing is deployed. The list below says what is true today, with evidence, and what is open. Nothing is ticked without something to point at.

## Data and access
- [x] Cross-tenant access tested and blocked: `tests/authz.test.js` (matrix-generated), other user's id returns 404; mutation check kills the 403/IDOR mutants.
- [ ] **Auth via proven provider: NOT MET.** DueSoon handles passwords itself (bcryptjs, cost 10, 72-byte cap) and has no password reset or email verification (ADR 0005). Acceptable for a demo; before real users either adopt a provider or accept that risk in writing.
- [x] Every endpoint validates input (zod, strict) and checks ownership server-side: `docs/permissions.md`, tests for 400/401/404.
- [x] Payments: not applicable, there are none.

## Delivery
- [ ] **CI blocks merges: UNVERIFIED.** `.github/workflows/duesoon-ci.yml` exists but has never run (no push triggered it in this environment) and branch protection was not configured.
- [x] Critical flows covered by end-to-end tests: 17 browser tests (`e2e/ui.e2e.js`).
- [ ] **Tested production rollback: NOT MET.** `docs/runbooks/rollback.md` is a written procedure that has not been rehearsed.
- [ ] **Separate staging and production: NOT MET.** No environment exists.
- [x] Backup and restore: `npm run backup` (VACUUM INTO, owner-only file mode) was run and the copy restored in this session: the copied database had the expected user and assignment and `PRAGMA integrity_check` returned `ok`. Nightly scheduling and off-machine copy are not set up.

## Protection
- [x] Fresh-context security review done (`docs/security/audit.md`); all findings fixed with tests; `npm audit` reports 0 vulnerabilities. No human penetration test.
- [x] Rate limits on login and signup, with tests. **Caveat:** in-memory, single instance, reset on restart (ADR 0004).
- [x] No tenant data cached at shared layers: no shared cache exists; authenticated responses are `no-store` (tested).

## Operations
- [ ] **Errors reach a tracker: NOT MET.** No tracker. Logs are structured and redacted (tested).
- [ ] **Uptime checks and alerts: NOT MET.** Rules and runbooks are written (`docs/monitoring.md`), nothing is wired, so no alert has ever fired.
- [x] Load tested: 50 virtual students, 25 s, file-backed SQLite, bcrypt cost 10, 9,585 requests, 0 errors; list p50 2.3 ms / p95 12.5 ms / p99 36.6 ms; sign-up p50 529 ms / p95 2.2 s (bcrypt on the event loop). Single machine, client and server on the same host, so it is an upper bound on speed. Not a measure of launch traffic, which is unknown.
- [ ] **Billing alerts: NOT MET.** No provider chosen.

## Legal and trust
- [ ] **Terms of service and privacy policy: NOT MET.** None written. The app stores email addresses and password hashes, so a privacy policy is needed before real users; the region (and so the legal duty) is undecided.
- [ ] **Cookie/consent: NOT ASSESSED.** One first-party session cookie, no analytics, no third-party requests; whether a notice is needed depends on the region.
- [x] Marketing claims match behaviour: the only public claim is the README line "Tiny deadline tracker for students." There is no promo copy.
- [x] Licences recorded: the only third-party asset is the Geist typeface (SIL Open Font License 1.1; the licence text is shipped at `public/fonts/OFL-Geist.txt`). No icons, music, footage, stock photos, AI-generated media or voices. Screenshots in `docs/screenshots/` are of this app.

## Open items before any real launch
Auth provider decision, a deployment target with staging, CI actually run and protected, a rehearsed rollback, an error tracker, wired uptime alerts, billing alerts, and terms and privacy policy for the chosen region.
