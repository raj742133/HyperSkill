# Permissions matrix

Roles in v1: **anonymous** and **user**. A user owns their own assignments only. "Other" is a different logged-in user.
Another user's resource returns **404** (not 403) so its existence is not revealed. The authorisation tests are generated from this table (`tests/authz.test.js`): edit the table and the tests follow.

| Method | Path | Body | Anonymous | Owner | Other |
|---|---|---|---|---|---|
| GET | /api/session | | 200 | 200 | 200 |
| GET | /api/me | | 401 | 200 | 200 |
| GET | /api/assignments | | 401 | 200 | 200 |
| POST | /api/assignments | {"title":"New","dueDate":"2026-12-01"} | 401 | 201 | 201 |
| GET | /api/assignments/:id | | 401 | 200 | 404 |
| PATCH | /api/assignments/:id | {"done":true} | 401 | 200 | 404 |
| DELETE | /api/assignments/:id | | 401 | 204 | 404 |

Notes: `GET /api/session` is the browser's sign-in probe: it returns `{"user":null}` when signed out, so a normal signed-out visit is not a console error. `GET /api/assignments` for "Other" returns Other's own (empty) list; isolation of list contents is tested separately. `DELETE /api/me` deletes the caller's account and all their rows; it only ever acts on the caller.
