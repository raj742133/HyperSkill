# Foundation playbook

Working notes for the backend phase. The section order here is not the build order; `hs-foundation/SKILL.md` gives that. Adapt every example to the project's stack and tenancy model (swap `organization_id` for `user_id` in a per-user product).

## Identity: who is calling

Use a maintained provider or library. Writing your own password hashing, token signing or session store is a reason to stop and ask the owner, not a shortcut.

Cover: signup, login, logout, email verification, password reset with an expiring single-use token, session lifetime, and revoking sessions when a member is removed or a password changes. Middleware resolves the signed-in user and their current organisation once per request and puts both on the request context; handlers read them from there, never from the request body.

Auth failures should not reveal which half was wrong: one message for "bad password" and "no such account".

Check: grep the codebase for hashing primitives (bcrypt, argon2, scrypt, pbkdf2, sha) outside the auth library's configuration; expect nothing.

## Access control: what they may do

1. Write a role-by-action table in `docs/permissions.md`. Begin with few roles (Owner, Admin, Member, Viewer) and add only when a real need appears.
2. Implement one function, `can(user, action, resource)`. Every endpoint calls it; no inline `if role === ...`.
3. A resource check always includes "belongs to the caller's organisation". Being logged in proves nothing about ownership.
4. Return **404**, not 403, when the resource belongs to another tenant, so existence is not revealed. Use 403 only when the caller can see the resource but lacks the right.
5. Generate tests from the table, one per endpoint, role and outcome: no credentials gives 401, a role without the right gives 403, someone else's tenant gives 404, an allowed role succeeds. Store the table in a data structure the tests iterate over, so a table change cannot silently diverge from the tests.

Team lifecycle to test: invite (with expiry), accept, change role, remove, transfer ownership, leave. Rules: the last owner cannot leave or be demoted; expired invites fail; a removed member's next request fails.

## Data model and migrations

Draw the entity diagram (Mermaid) first and let the owner look at it, then write the schema.

- Tenant-owned tables carry the tenant column with a foreign key and an index; unique constraints usually include it.
- Primary key, `created_at`, `updated_at` everywhere. Add `deleted_at` only where users could reasonably ask for undo.
- Put rules in the database: `NOT NULL`, `UNIQUE`, `CHECK`, foreign keys. Application checks can be bypassed by the next script.
- Index foreign keys and anything used in `WHERE` or `ORDER BY`; confirm with `EXPLAIN` on realistic row counts.
- Store money as integer minor units plus a currency code.
- Every change, however small, is a migration file in version control. Never alter a shared database by hand. Do not edit a migration that has already run elsewhere; add a new one.
- Seed two organisations with three users each so isolation can actually be exercised.

Isolation proof: log in as a member of org A, request an org B record by its real ID, and expect 404. Keep that as an automated test and paste its output.

## Uploaded files

Treat every upload as hostile and private. Store objects in a non-public bucket under a path that includes the tenant ID. Check declared type and size before issuing an upload URL, ideally also inspect the content afterwards. Keep only the object key and metadata in the database. Serve downloads through short-lived signed URLs, issued only after `can()` approves. Tests: disallowed type, oversized file, another tenant's download.

## The request boundary

Write `docs/api-conventions.md` and refactor to it: naming, one error body shape with stable codes, schema validation on every input at the edge, cursor pagination for lists, which status code means what, and how handlers obtain user and tenant. Handlers parse, authorise, call a service and format; the service holds the rules.

Check: send malformed JSON, wrong types and oversized values to each endpoint. Expect 400 in the standard shape, with no stack trace, SQL or file path.

## Work that should not block a request

Anything slow, retryable or dependent on a third party (email, exports, outbound calls) goes to a queue. Jobs must be safe to run twice, retry with backoff and a cap, log failures with the job ID and tenant, and leave failed jobs somewhere a person can see them. Time a representative request; over about one second needs either a stated reason or a job.

## Payments and webhooks, if the product charges

The provider's webhook, not the browser redirect, decides what the customer has paid for. Verify the signature on the raw body. Record each processed event ID and skip repeats. Handle success, failure, cancellation, plan change and refund. Let one helper decide feature access. Use test-mode keys only. Test by delivering every event twice and asserting exactly one effect.

## Query review and backups

Before closing the phase, list every query and look for N+1 loops, unindexed filters, `SELECT *` on wide tables, unpaginated lists, and tenant tables queried without the tenant column.

Write `docs/runbooks/backups.md`, then follow it: restore the latest backup into a separate empty database, run a few row counts and one login against it, and note how long it took. An untested backup is a hope.
