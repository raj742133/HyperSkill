# System design: DueSoon (v1)

## Problem
Students miss or rush deadlines because assignments live in portals, chat groups and memory (see `research.md`).

## Roles and tenancy
- **Tenancy model: individual accounts.** One user = one private workspace. There are no organisations, teams or sharing in v1.
- Every `assignments` row has `user_id`. A user can only ever read or change their own rows. Another user's id yields **404**, never 403.
- Roles: `user` only. (No admin in v1.)

## Core flows
1. Sign up with email + password. 2. Log in / log out / delete account. 3. Add an assignment (title, course, due date). 4. See "due soon" sorted by due date, overdue flagged. 5. Mark done / undo. 6. Edit or delete.

## Functional requirements
- Email must be unique, normalised to lower case. Password 10 to 72 bytes, stored only as a bcrypt hash (cost 10).
- Assignment: title (1-120 chars), course (0-60 chars), due date (valid ISO date), done flag.
- List endpoint is paginated (cursor) and sortable by due date; default shows not-done first.
- All input validated at the boundary; one error format `{error:{code,message}}`.

## Due dates and ordering (decided after design review)
- A due date is a **date only** (`YYYY-MM-DD`), with no time and no server timezone. "Overdue" means due date < the **client's local today**; the client computes it, so a student in any timezone sees the right flag at their own midnight.
- "Due soon" = not done and due within the next 7 days (including overdue). The list shows all assignments; default order is `done ASC, due_date ASC, id ASC`.
- Boundary cases (today, yesterday, tomorrow, month/year ends) are unit-tested.

## Sessions, CSRF and cookies (decided after design review)
- Session cookie `sid`: HttpOnly, SameSite=Lax, `Secure` in production, 7-day maximum age. The session id is regenerated on login and signup.
- CSRF: every state-changing request must send the custom header `X-Requested-By: duesoon` (browsers cannot add custom headers cross-origin without a CORS preflight, and the app sends no CORS headers). Requests without it get 403.
- `trust proxy` is on only in production (one hop), so client IPs for rate limits come from the platform proxy.
- Session store: process memory. **All users are logged out on every restart or deploy**, and the store is not for multi-instance use. Accepted for v1.

## Persistence and backup (decided after design review)
- The database path comes from `DB_PATH` and must sit on a persistent volume. On a host with an ephemeral disk, data is lost on deploy until a persistent volume is configured.
- SQLite runs in WAL mode with `busy_timeout`. A backup is a `VACUUM INTO` copy (`npm run backup`), restorable by copying the file back; the restore is tested.

## Limits and accepted trade-offs (decided after design review)
- Request body 10 KB; password 10 to 72 bytes (bcrypt ignores beyond 72); at most 500 assignments per user (422 beyond that); signup and login are rate limited per process.
- **No password recovery in v1** (it needs email): a forgotten password means a lost account. Accepted.
- **Signup reveals whether an email is registered** (409). There is no email verification. Accepted and mitigated only by the signup rate limit.
- The p95 latency target covers the list endpoint, not login (bcrypt is deliberately slow).
- v1 is not launched publicly until the target region is decided (privacy rules, minors).

## Non-functional requirements
- **Performance:** list endpoint under 100 ms p95 at 50 concurrent users on one small instance (local test).
- **Availability:** single instance; best-effort. No uptime promise.
- **Security:** sessions in HttpOnly, SameSite=Lax cookies; CSRF protection on state-changing requests; login rate limit; uniform "wrong email or password" message; security headers; no secrets in code.
- **Privacy:** store email and assignment text only (titles and course names may still contain personal data). Account deletion (`DELETE /api/me`) removes all rows.

## Out of scope (v1)
Payments, email reminders, notifications, calendar sync, notes, file uploads, teams/sharing, mobile app, OAuth/social login, AI features, admin panel, internationalisation.

## Open questions
Is this a business or a learning build? Which regions (affects privacy wording)?
