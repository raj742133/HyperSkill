---
name: hs-foundation
description: HyperSkill phase 2 - build the data layer, authentication, authorisation and API conventions with multi-tenant safety. Use for database schema and migrations, file storage, login/permissions, role-based access, REST/tRPC endpoints, background jobs, or payments/webhooks.
---

# Phase 2 - Foundation (database, auth, API)

Goal: a backend where **tenant isolation, authorisation and validation are structural**, not remembered per endpoint. Read `references/foundation-playbook.md` for the layer-by-layer detail.


**Slots:** run `hyperskill.py integrations phase foundation` and follow `hyperskill/references/integrations.md` for the providers it names.

## Owner decisions

- Database and host (default: Postgres, managed). Backup and retention policy. What is deleted when an account is deleted.
- Auth provider (Clerk, Auth0, Supabase Auth, Auth.js, WorkOS for enterprise SSO) and login methods.
- Roles (start small: Owner, Admin, Member, Viewer).
- API style (REST or tRPC), payment provider, background-job system.

## Order of work (each step: plan -> review -> small implementation -> evidence)

1. **Schema.** ERD (Mermaid) first, then schema in the project's ORM. Rules: every tenant table has `organization_id` + FK; `id` (UUID), `created_at`, `updated_at`; soft delete where users may want recovery; constraints in the database; index every FK and every filtered/sorted column; money as integer minor units.
2. **Migrations and seed.** Initial migration; seed two organisations x three users so isolation can be tested. Run both and show output.
3. **Files.** Private by default; direct-to-storage via pre-signed URLs; validate type and size before issuing; store only key + metadata; short-lived download URLs after an authorisation check; paths scoped by `organization_id`. Tests: wrong type, too large, other-org download.
4. **Auth.** Proven provider only. Signup, login, logout, email verification, password reset, session expiry. Middleware attaches current user and organisation to every request.
5. **Authorisation.** Write the role x action matrix to `docs/permissions.md`; implement a single `can(user, action, resource)`; every read/write verifies the resource's `organization_id` equals the user's. Generate the tests *from the matrix*: unauthenticated -> 401, no permission -> 403, other org's resource -> **404**, each role does exactly what the matrix says.
6. **Team features.** Invite, accept, change role, remove, transfer ownership, leave. Edge cases: last owner can't leave, invites expire (e.g. 7 days), removed members lose access immediately (revoke sessions).
7. **API conventions.** `docs/api-conventions.md` (naming, one error format with codes, validation at the boundary, cursor pagination, status codes, how auth/org context is read) then refactor to match. Business logic in services; handlers stay thin.
8. **Background jobs.** Move email, exports and third-party calls out of the request path. Jobs are idempotent, retry with backoff, have a max retry count and log failures with context; failed jobs are visible.
9. **Payments (if any).** Webhooks are the source of truth, signatures verified, handlers idempotent via stored event IDs, handle success/failure/cancel/plan change/refund, gate features through one helper, test mode keys only, tests that replay each event twice.
10. **Performance pass.** Review every query for N+1, missing indexes, `SELECT *`, missing pagination, and any query on a tenant table without `organization_id`.
11. **Backups.** Document restore steps in `docs/runbooks/backups.md` and **actually restore** into a separate database once.

## Pitfalls

- Checking "is logged in" but not "owns this resource" (IDOR) - the most common SaaS flaw.
- Permissions only in the frontend.
- 403 for another org's resource leaks that it exists; use 404.
- Hand-rolled password hashing or sessions.
- Editing the schema directly instead of through migrations.
- Non-idempotent payment handlers -> double charges.
- Trusting the client's input; inconsistent error shapes; stack traces in responses.

## Gate

`hyperskill.py gate foundation`. Evidence for tenant isolation, authorisation and webhook items must be test output, not a description.
