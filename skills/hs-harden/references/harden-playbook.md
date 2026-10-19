# Harden reference

The code does what was asked; this phase asks what a hostile or careless outsider could make it do. Tools named here are examples of a category; the owner chooses.

## 1. Threat model

`docs/security/threat-model.md`, one row per entry point:

| Entry point | Asset reached | Threat (OWASP Top 10 category) | Likelihood | Impact | In place | Missing |
|---|---|---|---|---|---|---|

- Assets: personal data, credentials, payment details, uploads, admin powers, money spent on paid APIs.
- Entry points: every route, form, upload, webhook receiver, and any feature that accepts a URL.
- Rate likelihood and impact low / medium / high; fix high-high rows first.
- Update it whenever an entry point is added.

## 2. Hostile input

- Paste a script tag and an attribute-breaking string (`"><img src=x onerror=alert(1)>`) into every text field, then open every screen that shows it. Nothing may run. Record the fields and screens tried.
- While signed in, request another tenant's IDs; expect 404.
- Send oversized, mistyped and empty bodies; expect a clean 400, never a stack trace.
- Use parameterised queries. Any string-built query, shell call or file path containing user input is a defect.

## 3. Dependencies

1. Run the ecosystem's audit command (`npm audit`, `pip-audit`, `cargo audit`).
2. Per hit record: package, severity, whether our code reaches the vulnerable function, decision (upgrade, replace, or accept with a revisit date).
3. Enable automated update pull requests (Dependabot, Renovate) and run the audit in CI so a new advisory fails a build.
4. Commit lockfiles; pin CI actions.

## 4. Sensitive data

- Classify fields as public, internal or sensitive; encrypt sensitive ones at rest with keys held outside the database.
- Keep passwords, tokens and personal data out of logs, error pages and analytics.
- Offer account deletion (remove or anonymise rows) and a download of the user's own data.
- Confirm the client bundle and git history hold no secrets.

## 5. Throttling

Counters live in a store shared by all instances (Redis or managed equivalent); in-process counters vanish on deploy and multiply per server.

| Surface | Key | Posture |
|---|---|---|
| Login, signup, reset | IP and target email | Tightest: a few tries per quarter hour |
| Costly endpoints (export, search, AI) | Organisation | Per minute and per day |
| Authenticated API | User | Generous |
| Anonymous pages | IP | Moderate |

Answer 429 with `Retry-After` in the standard error shape; make numbers configurable per plan; normalise keys (trim, lowercase) so padding an email cannot buy a fresh budget. Test every limit, redeploy, test again.

## 6. Spend limits

Per paid API: a per-organisation quota tied to the plan, usage stored in your database, a global ceiling that switches the feature off, a notice at 80%, and a customer usage screen. Also set a cap in the provider's console so your own bug cannot run up the bill.

## 7. Abuse paths

Ask "who profits from misusing this?" of each public feature: mass signups, invite or reset mail sent to strangers, account enumeration (messages and timing), scraping, unauthenticated webhooks that trigger work. Add a bot check at signup if spam is plausible.

## 8. Caching

`docs/caching.md`, one row per cached item: what, layer (browser, CDN, server, Redis), TTL, key, invalidation trigger.

- Keys holding tenant or user data contain that ID.
- A response that depends on the caller never enters a shared cache; send `private` or `no-store`.
- Static files: content-hashed names, long lifetime. HTML: not.
- Cache-aside with every write path deleting or updating the key, plus a debug bypass.

Tests: update then read returns fresh data; two organisations with the same query never see each other's entries.

## Done when

Reviewer report saved and triaged; injection probe recorded; audit output attached; 20 fast logins blocked before and after a redeploy; unknown user and wrong password read identically; two-tenant cache test passes.
