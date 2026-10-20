# Permissions matrix

There are no accounts and no secrets. Every caller is anonymous and the server accepts no input. `tests/permissions.test.js` walks this table and fails if any cell is wrong.

| Route | Anyone |
|---|---|
| `GET /`, `/styles.css`, `/app.js`, `/core/*.js`, `/favicon.svg` | 200 |
| `GET /api/health`, `/api/health/live` | 200 |
| any other route, and any POST, PUT or DELETE | 404 |

The measuring version also had `POST /api/event`, `POST /api/waitlist`, `GET /api/stats` and `GET /api/config`. They were removed (decision 0007) and the test checks that they stay gone.
