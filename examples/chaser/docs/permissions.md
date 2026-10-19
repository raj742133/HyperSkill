# Permissions matrix

There are no accounts, so there are two kinds of caller: **anonymous** (every visitor) and **operator** (holds `OPERATOR_TOKEN`). `tests/permissions.test.js` walks this table and fails if any cell is wrong.

| Route | Anonymous | Operator |
|---|---|---|
| `GET /`, `/styles.css`, `/app.js`, `/core/*.js`, `/favicon.svg` | 200 | 200 |
| `GET /api/health`, `/api/health/live` | 200 | 200 |
| `GET /api/config` | 200 (operator name and contact only when the waitlist is open) | 200 |
| `POST /api/event` | 200 / 202 (counted or ignored), needs the `X-Requested-By` header | same |
| `POST /api/waitlist` | 202, 503 while closed, needs the header | same |
| `GET /api/stats` | **401** | 200 |
| anything else under `/api/` | 404 | 404 |

There is no per-user data, so there are no 403 or other-user-404 cases. The operator reads the waitlist file on the server, not through the API, so no route returns an email address.
