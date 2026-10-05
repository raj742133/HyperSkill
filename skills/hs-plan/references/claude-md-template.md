# Project: <name>

## What this product does
<2-3 sentences: who the user is, what problem it solves.>

## Stack (do not change without asking)
- Frontend: <...>
- Backend: <...>
- Database / ORM: <...>
- Auth: <provider>
- Hosting: <...>

## Rules
- Never commit secrets. All config comes from environment variables documented in `.env.example`.
- Every endpoint: input validation, authentication, authorisation (`can()`), tests.
- Every tenant-owned query is scoped by `organization_id` and has a cross-tenant test.
- Every schema change is a migration file. Never edit the database by hand.
- Never edit a test to make it pass; never skip a test without a written reason.
- Run lint, typecheck and tests before saying a task is done, and show the output.
- Ask before adding a dependency.
- One feature per branch; small commits (Conventional Commits); no direct pushes to the default branch.

## Commands
- Dev: `<...>`
- Test: `<...>`
- Lint + typecheck: `<...>`
- Migrate: `<...>`

## Docs
- `docs/system-design.md`, `docs/architecture.md`, `docs/decisions/`, `docs/permissions.md`, `docs/api-conventions.md`, `docs/runbooks/`

## HyperSkill
Pipeline state lives in `.hyperskill/state.json`. Run `/hyperskill` to resume.
