# Threat model: DueSoon v1

## Assets
| Asset | Why it matters |
|---|---|
| Account email and bcrypt password hash | Identity; reused passwords make a leak spread |
| Assignment titles and courses (free text) | Personal data about a student's studies |
| Session cookie `sid` | Whoever holds it is the user |
| `SESSION_SECRET` | Signs the cookie; leak lets an attacker forge sessions |
| The SQLite file and its backups | Everything above in one file |

## Entry points
`POST /api/auth/signup`, `/login`, `/logout`; `GET /api/session`, `/api/me`, `DELETE /api/me`; `GET|POST /api/assignments`, `GET|PATCH|DELETE /api/assignments/:id`; `GET /api/health*`; static files in `public/`; the browser form fields (title, course, due date, email, password). No uploads, webhooks, email, or third-party calls.

## Threats (OWASP Top 10 lens) and what is in place
| # | Threat | Entry points | L / I | Mitigation present | Missing or accepted |
|---|---|---|---|---|---|
| A01 | Broken access control / IDOR: user A reads or changes B's assignment | `/assignments/:id` | M / H | Every query scoped by `user_id` **and** `can()`; other user's id returns 404; matrix-generated tests; mutation check | none known |
| A02 | Weak crypto / password storage | signup, login | M / H | bcrypt (cost 10) via `bcryptjs`, 72-byte cap, no custom crypto | bcryptjs is pure JS (CPU on the event loop under heavy login load) |
| A03 | Injection (SQL) | all routes | L / H | prepared statements everywhere, zod-validated inputs, strict schemas reject unknown fields | none known |
| A03 | XSS | list, strip, status line | M / H | All DOM text via `textContent`; no `innerHTML`; CSP `script-src 'self'`; hostile-text e2e test | none known |
| A04 | Insecure design: no password recovery, signup reveals registered emails | auth | H / M | documented and accepted (decision 0005); signup rate limit | accounts are lost on a forgotten password |
| A05 | Misconfiguration | all | M / M | startup validation of env; security headers; `x-powered-by` off; `no-store` | CSP depends on the platform not stripping headers |
| A06 | Vulnerable dependencies | `package.json` | M / M | `npm audit` clean at build; Dependabot configured; CI audit step | none yet; pin Node 22 |
| A07 | Auth failures: brute force, session fixation, enumeration | login | M / H | per ip+normalised-email limiter plus a per-ip limiter (bounded store), uniform error message (dummy hash at the real cost), session id rotated on login, HttpOnly + SameSite=Lax + Secure (prod) | limiter is in-memory: resets on restart and is per process |
| A08 | CSRF | state-changing routes | M / M | custom header `X-Requested-By` required; no CORS | none known |
| A09 | Logging failures | server | M / L | JSON logs with request id; passwords, tokens, cookies and emails redacted | no alerting yet (operate phase) |
| A10 | SSRF | none: the server makes no outbound requests | - | - | - |
| DoS | Oversized bodies, list abuse, limiter-memory growth | all | M / M | 10 KB body limit; limiter keys truncated, store capped and swept; 500-assignment cap; page size cap 50 | no global request rate limit |

## Not covered / out of scope
Account recovery, email verification, MFA, admin tooling, regional privacy compliance (region undecided), penetration test by a human. A human penetration test is **not** replaced by this document or by the AI review.

## Review follow-up (2026-10-19)
An independent read-only review (`audit.md`) found 3 medium and 7 low issues; all were fixed with regression tests (`tests/security.test.js`). Changed assumptions: `NODE_ENV` defaults to `production`; `TRUST_PROXY` is an explicit hop count (default 0); the listener binds `127.0.0.1` unless `HOST` is set; `DELETE /api/me` needs the password; database and backups are created owner-only. Accepted and unchanged: signup 409 reveals registered emails (ADR 0005); in-memory sessions and limits on one instance (ADR 0004); COOP/CORP headers not added (nothing cross-origin to isolate).
