# Foundation playbook

Condensed working notes for layers 3-5. Prompts are starting points; adapt them to the project's stack and docs.

## Layer 3 - Databases and storage

Typical agent mistakes: no migrations; no indexes (fine at 100 rows, slow at 100k); missing `organization_id` (cross-customer leaks); files stored in the DB or public; no backups, no soft deletes, no timestamps.

Schema prompt:
> From `docs/system-design.md` design the schema. Multi-tenant: every tenant table has `organization_id` with an FK. Every table has `id` (UUID), `created_at`, `updated_at`. Soft delete (`deleted_at`) where recovery matters. Index every FK and every column we filter or sort by. Use NOT NULL / UNIQUE / CHECK constraints instead of app-code checks. Money as integer minor units. Output: Mermaid ERD, the schema in our ORM format, an explanation of each index. Don't run migrations yet.

Seed prompt:
> Create the initial migration from the approved schema. Write a seed that creates 2 organisations with 3 users each plus realistic data so tenant isolation can be tested. Run both against the local DB and show the output.

Storage prompt:
> Implement uploads with <S3/R2/Supabase Storage>: private by default; pre-signed direct uploads; validate type and size before issuing the URL; store only key + metadata; short-lived signed downloads after an authorisation check; paths scoped by `organization_id`. Tests: wrong type, too large, other-org download.

Query review prompt (run later too):
> Review every database query. Flag N+1, queries with no supporting index, `SELECT *` where few columns are needed, list endpoints without pagination, and any tenant-table query lacking `organization_id`. Table: file, line, problem, fix. Fix the high-severity ones.

Verify: all schema changes are migrations; fetching Org B's data as Org A by changing an ID in a request fails; a backup has been restored at least once.

## Layer 4 - Auth and permissions

Authentication = who you are. Authorisation = what you may do, and on whose data.

Typical mistakes: custom password hashing; permission checks only in the frontend; checking login but not ownership; no email verification, no reset expiry, no session revocation.

Auth prompt:
> Implement authentication with <provider>. Do not hand-roll hashing or sessions. Include signup, login, logout, email verification, password reset, Google login, session expiry. Protect every route under `/app` and `/api` except <public routes>. Add middleware attaching current user and organisation to each request.

Authorisation prompt:
> Design RBAC for <roles>. (1) Write the role x action matrix to `docs/permissions.md`. (2) Implement one central `can(user, action, resource)` used by every endpoint; no ad-hoc role checks. (3) Every read/write of a tenant resource verifies its `organization_id` equals the user's current organisation. (4) The frontend hides disallowed actions but the server is the source of truth.

Authorisation tests prompt:
> For every endpoint write integration tests: unauthenticated -> 401; authenticated without permission -> 403; user from Org A requesting Org B's resource by ID -> 404; each role can do exactly what `docs/permissions.md` says and nothing more. Generate them from the matrix so they stay in sync.

Team features prompt:
> Implement invite by email, accept, change role, remove member, transfer ownership, leave. Edge cases: last owner can't leave; invites expire in 7 days; removed members lose access immediately (revoke sessions).

Verify: change a resource ID in DevTools to another org's -> 404; a Viewer calling a delete endpoint directly -> 403; no file contains custom password-hashing code.

## Layer 5 - APIs and backend logic

Typical mistakes: trusting client input; inconsistent error formats; slow work inside requests; non-idempotent payment/webhook handling; unpaginated lists.

Conventions prompt:
> Write `docs/api-conventions.md` and a summary in `CLAUDE.md`: URL/naming style; one error format with codes; validation (<Zod/Pydantic>) on every input at the boundary; cursor pagination for all lists; how auth and org context are read in a handler; which HTTP status codes and when. Then refactor existing endpoints to match.

Feature endpoint prompt:
> Build the API for <feature>. Follow the conventions and permissions docs. Logic in `/services`, thin handlers; validate every input; authorise every operation via `can()`; scope every query by `organization_id`; cursor pagination on lists. Unit tests for services; integration tests per endpoint including permission and cross-tenant cases.

Jobs prompt:
> Set up background jobs with <tool>. Move <emails, exports, third-party calls> out of the request path. Jobs must be idempotent, retry with exponential backoff, have a max retry count, log failures with context, and failed jobs must be visible.

Payments prompt:
> Integrate <Stripe/Razorpay> subscriptions for <plans>. Webhooks are the source of truth, not the checkout redirect. Verify signatures. Idempotent handlers by storing processed event IDs. Handle payment success, failure, cancellation, plan change, refund. Gate features with one helper like `hasFeature(org, feature)`. Tests replay each event twice and assert no duplicates. Test-mode keys only.

Verify: garbage JSON to an endpoint yields a clean 400 in the standard format; the same webhook twice changes nothing; any request over ~1s has a reason or is a background job.
