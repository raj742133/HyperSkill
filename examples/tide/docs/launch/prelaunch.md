# Pre-launch checklist: Tide (2026-10-20)

Each line is ticked with evidence or waived with a reason. "N/A" means the thing does not exist in Tide.

## Data and access
- [x] Another tenant's record by ID is refused: N/A, no tenants and no records (`docs/system-design.md` section 2)
- [x] Sign-in uses an established provider: N/A, no sign-in; a test greps for any password or login code
- [x] Every endpoint validates input and checks permissions: the only endpoints are two GET health checks and static files; every other method or path is a 404 (`tests/serve.test.js`)
- [x] Payment webhooks: N/A, no payments

## Delivery
- [ ] **Waived:** CI blocks merges on failing tests and a rollback was rehearsed. The CI workflow exists (`.github/workflows/tide-ci.yml`) but branch protection (required checks) is a repository setting I cannot see or change here, and no rollback was performed. Needs the repository owner
- [x] End-to-end tests for the core workflow: 28 browser tests. (Sign-up, billing and invites do not exist)
- [ ] **Waived:** Staging and production separate: there is one deployment on the host and no environments or keys
- [x] Backups and restore: N/A, no data on a server

## Protection
- [x] Security review outside the authoring session: `docs/security/review.md`. Dependencies audited (`npm audit` clean, Dependabot configured). No external penetration test: nothing sensitive is stored
- [x] Throttling: N/A, no endpoint accepts input
- [x] No tenant-specific data in a shared cache: N/A

## Operations
- [ ] **Waived:** Exceptions reach an error tracker; uptime probes and alerts with runbooks; spending alerts. None exists: no monitoring provider is available here, and the host's free plan has no spend. Logs are structured with nothing from the visitor (`docs/operations.md`)
- [x] Load test with figures recorded: `docs/scale.md` (dev server only; the deployed host was deliberately not load tested)

## Legal and trust
- [x] Terms and privacy published and linked: `privacy.html`, linked from the page footer
- [x] Cookie and consent handling: the page sets no cookies and loads nothing third-party; it keeps three settings in local storage that the visitor chose, described on the privacy page. Not legal advice; a different region's rules were not checked
- [x] Every claim matches what the product does: `docs/launch/claims.md`
- [x] Licences logged: `docs/launch/licences.md`
