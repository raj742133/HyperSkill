# CLAUDE.md starter

Copy to the repository root as `CLAUDE.md`, fill every `<...>`, delete lines that do not apply. Keep it short: it loads every session, so each line should change behaviour. If the owner also uses Codex, copy it to `AGENTS.md`.

```markdown
# <Product name>

## Purpose
<Two or three sentences: who uses it, what problem it removes.>
Tenancy: <individual | team | organisation>.

## Stack (ask before changing)
- Frontend: <framework, language>
- Backend: <framework, language>
- Data: <database, ORM>
- Auth: <provider or library>
- Hosting: <platform>

## Working rules
- Secrets live in environment variables; each appears, commented, in `.env.example`.
- New endpoints need input validation, authentication, a `can()` check and tests.
- Queries on tenant-owned data are scoped by `<organization_id | user_id>` and have a cross-tenant test.
- Business logic goes in `<services/ | domain/>`, not components or route handlers.
- Schema changes are migration files; never edit the database by hand.
- Never weaken a test to get green; a skipped test needs a written reason.
- Run lint, typecheck and tests before calling a task done, and show the output.
- Ask before adding a dependency.
- Branch per feature, small Conventional Commits, no direct pushes to the default branch.

## Commands
- Dev server: `<cmd>`
- Tests: `<cmd>`
- Lint and typecheck: `<cmd>`
- Migrations: `<cmd>`

## Docs
`docs/system-design.md`, `docs/architecture.md`, `docs/decisions/`, `docs/permissions.md`, `docs/api-conventions.md`, `docs/runbooks/`

## Pipeline
Phase progress lives in `.hyperskill/state.json`; run `/hyperskill` to continue.
```
