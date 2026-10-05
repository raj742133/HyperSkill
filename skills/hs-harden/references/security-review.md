# Security review checklist (for `hs-reviewer`)

Report only; do not modify code in the review pass. For each finding give: **file:line, severity (critical/high/medium/low), exploit scenario (concrete steps), fix**. Do not report style. If you cannot confirm a finding by reading the code, say it is unconfirmed.

1. **Broken access control / missing org scoping** - every handler: is the caller authenticated, authorised via the central check, and is the resource's `organization_id` compared to the caller's? Try IDOR by reasoning about every route taking an ID.
2. **Injection** - raw SQL/NoSQL queries built with string concatenation; shell/command execution with user input; template injection.
3. **XSS** - unsafe HTML rendering (`dangerouslySetInnerHTML`, `v-html`, `innerHTML`), unsanitised markdown, user content in attributes or URLs.
4. **CSRF** - state-changing requests relying on cookies without CSRF protection or SameSite settings.
5. **Open redirects and SSRF** - redirects to user-supplied URLs; server-side fetches of user-supplied URLs (block internal ranges and metadata endpoints).
6. **File uploads** - type/size validation, storage path traversal, public access, content-type sniffing, serving user files from the app origin.
7. **Secrets** - in code, config, logs, client bundle, git history; `.env` handling.
8. **Sensitive data in logs and errors** - tokens, passwords, emails; stack traces returned to clients.
9. **Security headers** - CSP, HSTS, X-Content-Type-Options, frame-ancestors/X-Frame-Options, Referrer-Policy.
10. **Cookies and sessions** - Secure, HttpOnly, SameSite, expiry, rotation on login, revocation on role change/removal.
11. **Authentication flows** - reset-token expiry and single use, email verification enforced, uniform error messages, brute-force protection.
12. **Webhooks** - signature verification, replay protection, idempotency.
13. **Dependencies and supply chain** - known-vulnerable or abandoned packages; install scripts; unpinned CI actions.
14. **Debug and admin surfaces** - debug routes, verbose modes, unauthenticated admin endpoints in production config.

Run this with a fresh session or the `hs-reviewer` agent, not the context that wrote the code. Re-run before every release. Probe by hand too: paste `<script>alert(1)</script>` into every text field; request another org's IDs; hit login 20 times fast.
