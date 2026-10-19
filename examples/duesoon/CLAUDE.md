# Project: DueSoon

## What this product does
A tiny deadline tracker for students: sign up, add assignments with due dates, see what is due next, mark done. Individual accounts only.

## Stack (do not change without asking)
Node 22, Express 5, node:sqlite, zod, bcryptjs, express-session. Tests: node:test. See docs/architecture.md.

## Rules
- Never commit secrets. Config only via env vars documented in `.env.example`; startup validates them.
- Every endpoint: validate input (zod), require auth, check ownership via `can()`, and have tests including 401/404 cases.
- Another user's resource returns 404, never 403.
- Every schema change is a migration in `src/db/migrations`.
- Never edit a test to make it pass; never skip a test without a written reason.
- Run `npm run lint && npm test` before saying a task is done and show the output.
- Ask before adding a dependency. One concern per commit.

## Commands
- Dev: `SESSION_SECRET=$(openssl rand -hex 32) npm run dev   (sets NODE_ENV=development; the default is production)`
- Test: `npm test`
- Lint: `npm run lint`

## Docs
docs/research.md, system-design.md, architecture.md, decisions/. Pipeline state: `.hyperskill/state.json` (HyperSkill).
