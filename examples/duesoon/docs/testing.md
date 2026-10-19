# Test strategy

| Level | What | Tool | Real or mocked |
|---|---|---|---|
| Unit | `public/due.js` date logic (midnight, month, year, leap day) | `node:test` | pure functions |
| Integration | Every endpoint over real HTTP against a real in-memory SQLite: validation, auth, ownership, limits, errors, logging, migrations, backup and restore | `node:test` (`tests/*.test.js`) | **Nothing of our own is mocked**: database, sessions, password hashing and authorisation are real |
| Authorisation | One request set per row of `docs/permissions.md`: anonymous, owner, other user. Generated from the table, so the table and the tests cannot drift | `tests/authz.test.js` | real |
| End-to-end | Sign-up, add, finish, edit, delete, log out/in, reload; overdue; load error + Retry; offline; keyboard-only; hostile text and CSP; axe WCAG 2.1 AA in light and dark; phone layout; account deletion | `playwright-core` driving system Chromium (`npm run test:e2e`) | real browser, real server |
| Mutation check | 13 deliberate one-line breaks; the unit tests must fail for each (`npm run mutation`) | `scripts/mutation-check.js` | throwaway copy |

Mocked: nothing external exists in v1 (no email, no payments). Never mocked: our database, our auth checks, our authorisation function.

Rules: never edit a test to make it pass; a skipped test needs a written reason (there are none); bug fixes start with a failing test.

Known gaps: no load test yet (scale phase); e2e does not cover Safari or Firefox; the mutation set is hand-picked, not exhaustive; `can()` is covered by behaviour through the API, and weakening it alone is *not* detected because every query is also scoped by `user_id` (deliberate defence in depth).
