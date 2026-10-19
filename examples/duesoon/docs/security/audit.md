Security review (focused, read-only, no code executed; the Cloudflare skill's sandboxed multi-phase workflow was NOT run)

Scope: src/, public/, scripts/, migration 001_init.sql, package.json and package-lock.json, docs/permissions.md. Reviewed against the security-audit skill (focused mode) and skills/hs-harden/references/security-review.md. Reviewer did not write this code.
Process note: besides Read/Grep/Glob I used one read-only `ls`/`wc` shell listing to enumerate files. No project code, npm, node or network was run.
Result: 0 critical, 0 high, 3 medium (M3 is conditional and UNCONFIRMED), 7 low. Access control, SQL and XSS are sound.

## Findings

### M1. Login rate limit is bypassable with whitespace in the email (medium)
- routes/index.js:32 (key) vs routes/schemas.js:8 (normalisation)
- The limiter key is `ip|String(body.email).toLowerCase()`. The schema then `.trim()`s the email, so `"a@x.com"`, `"a@x.com "`, `" a@x.com"`, `"a@x.com\t"` and so on are different buckets but the same account. The limiter also runs before parsing and counts nothing per IP alone.
- Exploit: one client sends unlimited password guesses at one victim by padding the email with spaces or Unicode whitespace; each variant gets a fresh budget of 10 per 15 minutes. Distinct emails also give unlimited bcrypt work per IP (CPU pressure; bcryptjs is pure JS).
- Fix: key on the normalised value, `const e = schemas.email.safeParse(req.body?.email); key = ip + "|" + (e.success ? e.data : "invalid")`, and add a second limiter keyed on IP only (for example 100 per 15 minutes).
- Not covered by tests: tests/auth.test.js:97 only tests identical emails.

### M2. Rate limiter store grows without bound, pre-auth memory DoS (medium)
- middleware/security.js:27-41
- `hits` is a Map that is never pruned. Expired entries are only replaced if the same key comes back. The key contains attacker-controlled text, up to the 10 kb body limit, since the limiter runs before validation (routes/index.js:32).
- Exploit: an unauthenticated client posts `/api/auth/login` with a unique 5-10 kb email each time (no auth needed, each returns 400 or 401). Memory grows by the key size per request, with no cap, until the single process runs out of memory. This takes the whole service down, including its in-memory sessions.
- Fix: drop expired entries with a `setInterval(...).unref()` sweep, cap `hits.size` (evict oldest, or fail closed above the cap), and hash or truncate the key (for example sha256 or the first 100 chars).

### M3. `trust proxy` is hard-coded to 1 in production (medium if the topology differs, UNCONFIRMED)
- app.js:21
- The rate limiter keys on `req.ip`. Trusting exactly one hop is only right if exactly one proxy sits in front and it appends to X-Forwarded-For.
- (a) The process is reachable directly in production: the attacker's own `X-Forwarded-For` becomes `req.ip`, so every IP-based limit (signup 10 per hour, login) is bypassed with a rotating header value.
- (b) Two hops (CDN plus platform proxy): `req.ip` is the CDN or proxy address, so all users share one bucket. One attacker exhausts signup (10 per hour for everyone) and locks out logins.
- Topology is not in the repo (docs/hosting.md is a plan only), hence UNCONFIRMED.
- Fix: make it `TRUST_PROXY` env (hop count, validated in config.js), document the expected topology in hosting.md, and bind the listener to loopback or a private interface when behind a proxy.

### L1. Security posture depends on NODE_ENV and the default fails open (low)
- config.js:4, app.js:21, app.js:50, middleware/security.js:11
- `NODE_ENV` defaults to `development`, and `.env.example` ships `NODE_ENV=development`. In that mode the session cookie lacks `Secure`, HSTS is off, and `trust proxy` is off (see M3b).
- Exploit: a deploy that forgets `NODE_ENV=production` serves the 7-day session cookie over plain HTTP where it can be sniffed.
- Fix: require NODE_ENV explicitly (no default), or default to `production`, and set secure and trust proxy from separate explicit env flags.

### L2. Timing and enumeration (low; the signup 409 is an accepted risk, ADR 0005)
- services/users.js:6 and :24
- `DUMMY_HASH` is hashed at a fixed cost of 10, but real hashes use `BCRYPT_ROUNDS` (allowed 4-15, config.js:8). With rounds above 10, an unknown email returns measurably faster than a wrong password, so login leaks which emails exist. The signup `409 email_taken` (users.js:16) leaks it directly, so the timing leak adds little today. It matters if signup is ever changed to be uniform.
- Fix: `bcrypt.hashSync("x", rounds)` using the configured rounds. This needs `rounds` to be passed to `authenticate`.

### L3. Dev scripts: preview.js binds all interfaces and ships known credentials (low)
- scripts/preview.js:32, 12, 17; scripts/seed-demo.js:7-8
- `inner.listen(0)` has no host, so the real app (with the seeded demo account, password `demo-password-2026` in source) listens on a random port on every interface. The 127.0.0.1 bind on line 40 only covers the outer proxy. Anyone on the LAN who finds the port can log in as the demo user (demo data only, in-memory DB).
- The production guard is `NODE_ENV === "production"` only (line 12). I checked that nothing in src/ imports preview.js, package.json has no script for it, and no route can reach it, so it is not reachable in production unless someone runs it by hand. seed-demo.js with BASE pointing at a real instance creates a known-password account.
- Fix: `inner.listen(0, "127.0.0.1")`, generate the demo password with `randomUUID()`, and in seed-demo.js refuse any BASE that is not localhost.

### L4. Account deletion and session lifetime (low)
- routes/index.js:63-68, app.js:50
- `DELETE /api/me` needs only the session cookie, with no password re-entry. The cookie lives 7 days, with no idle timeout. There is no password-change feature, so there is no "sign out everywhere" lever.
- Exploit: a stolen or left-open session irreversibly deletes the account and all rows.
- Fix: require `password` in the body and verify it with bcrypt before deleting.

### L5. Secret scanner allowlist is unanchored and the history mode is ineffective (low)
- scripts/secret-scan.sh:8, 12, 18
- `ALLOW` contains the bare `tests/`, so any staged path containing `tests/` skips the scan. In `--history` mode the allowlist is applied to diff content lines, not file names, so it only drops lines that happen to mention those words (and `grep -nE` output of `git log -p` carries no file name to match). The hook also needs manual `git config core.hooksPath`.
- Fix: anchor allowed paths (`^examples/duesoon/(tests|e2e)/`), and for history use `git log --all -p --name-only`-aware scanning or a dedicated scanner in CI.

### L6. Client errors from body-parser or static become 500 plus an error log with stack (low)
- app.js:57-62
- Only two error types are mapped. Other 4xx errors that carry `err.status`, for example unsupported charset or an invalid percent-encoding in a static path, fall through to 500 `internal_error` and `logger.error` with the stack. No leak to the client, but log flooding from anonymous requests.
- Fix: `else if (err.status >= 400 && err.status < 500) { status = err.status; code = "bad_request"; message = "Bad request"; }` before the final else.

### L7. Database and backup file permissions (low, UNCONFIRMED on the deploy host)
- db/connection.js:28-29, scripts/backup.js:11
- The DB (emails plus bcrypt hashes) and backups are created with the process umask, typically 0644 in a 0755 directory. Other local users on the host could read them.
- `VACUUM INTO '${out...}'` is string-built SQL, but the single quote is escaped and `out` is an operator-supplied argument, not remote input, so it is not exploitable.
- Fix: `process.umask(0o077)` at startup and in backup.js, or `chmod 600` the files.

## Checked and found sound
- Access control and IDOR: every `/assignments/:id` route validates the id as a UUID (schemas.js:30), then queries `WHERE id = ? AND user_id = ?` (assignments.js:23, 29, 37, 43, 45), then calls `can()`. The list is scoped by `user_id` (assignments.js:68). Another user's id returns 404. The cursor cannot cross users because it only supplies a position and `user_id = ?` is always in the query. `/me`, `DELETE /me` and `/session` only touch `req.session.userId`. Mass assignment is blocked by `.strict()` schemas, so a client cannot set `user_id`. Create then count is synchronous, so the 500-row cap cannot be raced.
- SQL injection: every statement uses `?` placeholders. Template-literal SQL interpolates only the constants `COLS` and the fixed `after` string (assignments.js:6, 65-68). The migration runner reads fixed files. The only dynamic SQL is backup.js (see L7).
- XSS: public/app.js has no innerHTML, outerHTML, insertAdjacentHTML or document.write (Grep returned no matches). User data goes through `textContent`, text nodes, or `value`, `title` and `aria-label` attributes set with `setAttribute` on literal attribute names (app.js:6-16). The `style.setProperty` on line 179 is CSSOM and allowed by the CSP (UNCONFIRMED in a browser, but I found no inline style attributes or inline scripts in index.html).
- CSRF: all state-changing routes sit under `/api` behind `requireCsrfHeader` (app.js:52). A custom header forces a CORS preflight, and the app sends no CORS headers. SameSite=Lax is a second layer. GET routes have no side effects. Login and signup are covered too (login CSRF closed).
- Sessions: `regenerate` on login and signup (routes/index.js:38, 46), `destroy` plus `clearCookie` on logout and delete, `httpOnly`, `sameSite: lax`, `secure` in production, random ids, the secret must be 32 or more characters. After account deletion other sessions are dead because `requireAuth` re-reads the user on every request (routes/index.js:19), and the user id is a random UUID, so it is never reused.
- Passwords: min 10 characters, max 72 bytes enforced (schemas.js:9), so the bcrypt truncation cannot silently weaken or collide. Cost 10 default, matches the OWASP floor. bcryptjs is pure JS (slower per guess for defenders and attackers alike).
- Static serving: serve-static 2.2.1 with `dotfiles` ignored by default, root is `public/` only, and public/ contains just the app files and fonts (Glob). No path traversal source in app code. `nosniff` is set.
- Headers and CSP: default-src 'self', script-src 'self', style-src 'self', frame-ancestors 'none', base-uri and form-action 'self'. Also Referrer-Policy no-referrer, Permissions-Policy, `Cache-Control: no-store`, HSTS in production, `x-powered-by` disabled. No external URLs in public/ (Grep). Optional hardening only: add COOP and CORP.
- Logging: the logger redacts keys matching password, token, secret, authorization, cookie and email (logger.js:2). No handler logs request bodies, cookies or headers. The request log uses the path without the query string. Errors return generic messages (app.js:58).
- DoS inputs: JSON body 10 kb (app.js:47), cursor max 300 characters with try/catch parsing, limit max 50, per-user cap 500 (so the client page loop is at most 10 requests of 51 rows over the (user_id, done, due_date, id) index), no regex on user input apart from fixed-shape date and `/UNIQUE/`.
- Supply chain: 4 runtime dependencies, 2 dev dependencies (playwright-core does not download browsers by itself). package-lock.json: every `resolved` URL is registry.npmjs.org, every entry has an `integrity` hash, no `hasInstallScript`. Installed versions seen: express 5.3.0, express-session 1.19.0, bcryptjs 3.0.3, zod 4.6.7, send 1.2.1, serve-static 2.2.1, body-parser 2.3.0.
- Secrets: `.env` and `.env.*` are gitignored, `.env.example` holds no value, SESSION_SECRET is validated at startup. I saw no secret in the files I read.
- Accepted and documented, not re-reported: in-memory sessions on one instance (ADR 0004), no password reset or email verification and the signup email oracle (ADR 0005).

## Not checked
- Known CVEs in the installed dependency versions (no network, no `npm audit`). UNCONFIRMED.
- Git history for committed secrets (no git or shell execution). `.env` presence on disk was not checked.
- Behaviour in a real browser (CSP violations, cookie flags on the wire), the actual deployment topology, TLS, and the proxy.
- e2e/ui.e2e.js, tests/ in depth, styles.css beyond URL references, the .taste-skill and .hyperskill directories, docs other than permissions.md.
- Runtime behaviour of express-session MemoryStore under load, and the exact CPU cost of bcryptjs at the chosen cost.
