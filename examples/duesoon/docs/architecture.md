# Architecture: DueSoon (v1)

Modular monolith, one process. Chosen for a solo owner who must debug it at 2 a.m.

```mermaid
flowchart LR
  B[Browser: static HTML + JS] -->|JSON over HTTPS, cookie session| A[Express app]
  A --> R[routes: parse + validate + call services]
  R --> S[services: business rules + can()]
  S --> D[(SQLite via node:sqlite)]
  A --> L[logger: JSON lines, request id, redaction]
```

## Stack (one alternative each)
| Layer | Choice | Rejected | Why |
|---|---|---|---|
| Runtime | Node 22 | Python/FastAPI | available here; built-in `node:test` and `node:sqlite` mean few dependencies |
| HTTP | Express 5 | Fastify | most familiar, smallest surprise |
| DB | SQLite (`node:sqlite`) | Postgres | zero-ops for v1. **Limit:** single writer, single instance; migrate to Postgres before multi-instance |
| Auth | `bcryptjs` for hashing + `express-session` | hand-rolled | no custom crypto. **Limit:** default memory session store is single-instance only and logs everyone out on restart |
| Validation | `zod` | hand-written checks | one schema per input |
| SQLite driver | `node:sqlite` (experimental in Node 22: prints a warning, API may change) | `better-sqlite3` | Fallback if the built-in API changes. Node version pinned via `engines` and `.nvmrc` |
| Tests | `node:test` + real in-memory SQLite | Jest | no mocks of our own DB or auth |

## Folder structure
`src/config.js` (env validation) - `src/logger.js` - `src/db/` (migrations, connection) - `src/services/` (users, assignments, can) - `src/routes/` - `src/app.js` (factory) - `src/server.js` - `public/` - `tests/`

## Authorisation
One function, `can(user, action, resource)`, is called by every service that touches an assignment, **and** every query is also scoped by `user_id`. Belt and braces: a forgotten check still cannot read another user's row.

## Background jobs
None in v1 (no email, no exports).

## Third-party services and cost
None. Free to run locally. Hosting not chosen (see `hosting.md` later).

## Three riskiest decisions
1. SQLite + memory sessions block horizontal scaling (documented, revisit at the scale phase).
2. Rolling our own session/CSRF wiring on Express (mitigated by well-known libraries and tests).
3. Per-user tenancy instead of organisations: simpler now, a data-model change if teams are added later.
