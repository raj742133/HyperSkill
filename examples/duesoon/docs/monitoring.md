# Monitoring plan (nothing is wired up yet)

No provider has been chosen and nothing is deployed, so none of this is running. It says what to set up first.

## Uptime checks
| Check | URL | Meaning of "down" |
|---|---|---|
| Process alive | `GET /api/health/live` | no 200 within 5 s, 2 checks in a row |
| Dependencies | `GET /api/health` | non-200 or `database: "down"` |
| Core workflow | sign in + add + list with a dedicated test account (synthetic) | any step fails, 2 runs in a row |

## Technical metrics (from the JSON request log; fields: `status`, `ms`, `path`, `requestId`)
Error rate (5xx / all), p95 latency per path, 429 rate on login (credential stuffing signal), process restarts, database file size and free disk.

## Business metrics
Sign-ups per day, active users per week, assignments created per day. No payments in v1.

## Alert rules (only things a human must act on)
| Alert | Threshold | Severity | Who | Runbook |
|---|---|---|---|---|
| App down | live check fails 2x | page | owner | `runbooks/app-down.md` |
| Database unhealthy | `/api/health` 503 for 5 min | page | owner | `runbooks/database.md` |
| 5xx rate high | over 5% for 10 min | warn | owner | `runbooks/errors.md` |
| Disk almost full | over 80% | warn | owner | `runbooks/database.md` |
| Login 429 spike | over 100 per hour | info | owner | `runbooks/errors.md` |
