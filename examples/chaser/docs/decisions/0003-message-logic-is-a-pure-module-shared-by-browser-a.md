# 0003. Message logic is a pure module shared by browser and tests

- Date: 2026-10-19T20:20:06Z
- Phase: plan

## Decision
All message text, formatting of rupees and dates, and safety rules live in src/core with no I/O, DOM or HTTP imports.

## Why
Keeps the product testable (golden files, forbidden-phrase tests) and guarantees the server never sees form inputs.

## Alternatives considered
- Logic inside the page script: rejected, untestable and prone to drift between email and WhatsApp text.
- Logic on the server: rejected, it would mean the server receives client details.

## Consequences
- The same file is imported by the page and by tests.
- `src/core` may not import I/O, DOM or HTTP modules; a test enforces this.
- Server routes cannot depend on message content.
