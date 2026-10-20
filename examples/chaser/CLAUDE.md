# Chaser

## Purpose
A free, no-accounts page where a freelancer enters an unpaid invoice and gets three ready-to-send payment reminders (polite, firm, final). It is not a business: no pricing, no counters, no waitlist (decision 0007; the earlier plan in `docs/research.md` and `docs/system-design.md` is kept as the record).
Tenancy: none (no accounts, nothing stored).

## Stack (ask before changing)
- Runtime: Node 22, built-in `http` and `node:test`, **no npm dependencies** (decision 0002).
- Front end: plain HTML, CSS and one ES module in `public/`.
- Data: none. The server stores nothing.
- Hosting: any static or Node host; no disk or secrets needed.

## Working rules
- **The page makes no request after it loads** and the server must never receive the form inputs. Any new code that sends anything anywhere is a bug. The CSP keeps `connect-src 'none'`; do not loosen it.
- Message logic lives only in `src/core/` and imports no I/O, HTTP or DOM code; a test enforces it.
- Generated text must pass the forbidden-phrase list in `docs/system-design.md` F3; add golden-file tests for every template.
- Copy-and-send only: no automatic sending, no WhatsApp API, no `upi://` links (decision 0005).
- Never weaken a test to get green; a skipped test needs a written reason.
- Run `npm run lint && npm test` before saying a task is done, and show the output.
- Ask before adding a dependency. One concern per commit; Conventional Commits.

## Commands
- Dev: `npm run dev`
- Test: `npm test`
- Lint (syntax check): `npm run lint`

## Docs
`docs/decisions/` (0007 is the current direction), `docs/design-critique.md`, `docs/permissions.md`; `docs/research.md`, `docs/system-design.md`, `docs/architecture.md` and `docs/design-review.md` describe the earlier measuring plan. Raw research briefs: `docs/research-raw/`.

## Pipeline
Phase state: `.hyperskill/state.json` (not committed); `/hyperskill` resumes. Current phase: product, free version (see decision 0007).
