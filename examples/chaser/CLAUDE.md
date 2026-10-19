# Chaser

## Purpose
v1 is an experiment, not a product: a no-accounts page where a freelancer enters an unpaid invoice and gets three ready-to-send payment reminders (polite, firm, final). It tests whether people want this and would pay. See `docs/research.md` and decision 0001. If the pass conditions in `docs/system-design.md` section 9 are not met, the project stops.
Tenancy: none (no accounts, no stored client data).

## Stack (ask before changing)
- Runtime: Node 22, built-in `http` and `node:test`, **no npm dependencies** (decision 0002).
- Front end: plain HTML, CSS and one ES module in `public/`.
- Data: JSON Lines files on disk (`src/store/`), only for counters and the waitlist.
- Hosting: undecided (needs a persistent disk or a swapped store).

## Working rules
- **The server must never receive the form inputs** (client name, amount, UPI ID). Any new code that sends them anywhere is a bug. The CSP keeps `connect-src 'self'`; do not loosen it.
- Message logic lives only in `src/core/` and imports no I/O, HTTP or DOM code; a test enforces it.
- Generated text must pass the forbidden-phrase list in `docs/system-design.md` F3; add golden-file tests for every template.
- Copy-and-send only: no automatic sending, no WhatsApp API, no `upi://` links (decision 0005).
- Secrets live in environment variables listed in `.env.example`; startup validates them.
- Never weaken a test to get green; a skipped test needs a written reason.
- Run `npm run lint && npm test` before saying a task is done, and show the output.
- Ask before adding a dependency. One concern per commit; Conventional Commits.

## Commands
- Dev: `OPERATOR_TOKEN=$(openssl rand -hex 16) npm run dev`
- Test: `npm test`
- Lint (syntax check): `npm run lint`

## Docs
`docs/research.md`, `docs/system-design.md`, `docs/architecture.md`, `docs/design-review.md`, `docs/decisions/`. Raw research briefs: `docs/research-raw/`.

## Pipeline
Phase state: `.hyperskill/state.json` (not committed); `/hyperskill` resumes. Current phase: plan.
