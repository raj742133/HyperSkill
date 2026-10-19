# Scale notes

## Load test (measured)
`BASE=... USERS=50 SECONDS=20 node scripts/loadtest.js` against `src/server.js` with a file-backed SQLite database, `BCRYPT_ROUNDS=10`, rate limits raised through env so they did not interfere. Client and server ran on the same sandbox machine.

50 virtual students, 5 s ramp + 20 s steady, 30 rows each, 100-250 ms think time: **9,585 requests in 25.1 s (381/s), 0 errors.**

| Request | n | p50 | p95 | p99 |
|---|---|---|---|---|
| sign-up (bcrypt cost 10) | 50 | 529 ms | 2,211 ms | 2,423 ms |
| list (50 rows) | 8,670 | 2.3 ms | 12.5 ms | 36.6 ms |
| add | 865 | 3.1 ms | 14.3 ms | 35.9 ms |

Reading it: reads and writes are cheap. The expensive operation is the password hash, and `bcryptjs` is pure JavaScript, so hashing runs on the event loop and a burst of sign-ups stalls other requests (the sign-up p95 is the 50 users arriving over 5 s). An earlier run was **discarded**: it hit the 10-per-hour sign-up limit and measured 429 responses, not the app.
Not measured: more than 50 users, a real network, a slow disk, a long soak, memory growth of the in-memory session store.

## Multi-instance (measured, fails by design)
`node scripts/two-instances.js` starts two servers on one database file. Result: an account is visible to both, but a session cookie from instance A is rejected by instance B (401), and rate limits are per process. Two instances need a shared session store and a shared limiter first (ADR 0004).

## Optimisations
None were made, so there are no before/after numbers. The one candidate is moving password hashing off the event loop (native `bcrypt` or a worker); it was not measured as a problem at this load, so it was not done.

## Cost model
No hosting provider or price was researched, so no money figures are given. In capacity terms: one small instance served 381 req/s of this mix in the test. A student opening the app a few times a day produces tens of requests, so a single instance covers on the order of thousands of daily users on CPU alone; the real limits are the single SQLite file on one disk, memory sessions (a restart signs everyone out) and sign-up bursts at semester start. At 10x and 100x the first change is architectural (shared session store, a database that allows several writers), not a bigger machine. Price the plan on a chosen provider's current page before relying on any number.
