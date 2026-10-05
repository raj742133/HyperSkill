---
name: hs-harden
description: HyperSkill phase 5 - threat modelling, independent security review, dependency audit, data protection, rate limiting, cost caps and safe caching. Use before any release, when handling user data or payments, when adding paid-API features, or when asked for a security or abuse review.
---

# Phase 5 - Harden (security, rate limits, caching)

Goal: assume the code was written by someone who built exactly what was asked and never thought like an attacker. Find what that missed. Detail: `references/harden-playbook.md` and `references/security-review.md`.


**Slots:** run `hyperskill.py integrations phase harden` and follow `hyperskill/references/integrations.md` for the providers it names.

## Owner decisions

- What data is sensitive and how it is protected; compliance obligations for the target market.
- Whether an external penetration test is required before handling sensitive data (payments, health, finance): AI review is **not** a substitute.
- Rate limits per route and plan; what happens at the limit (block, queue, charge overage).
- What may be stale and for how long; cache store.

## Steps

1. **Threat model** -> `docs/security/threat-model.md`: assets (data, accounts, payments), every entry point (endpoint, upload, webhook, form), relevant OWASP Top 10 threats per entry point, likelihood x impact, mitigations present vs missing.
2. **Independent security review.** Run it through `hs-reviewer` (fresh context). If the `security-audit` slot resolves to an external audit skill, have the reviewer load it, but run it **only in a sandbox with networking off** (it builds and executes project code) and save its structured output to `docs/security/`. Always also apply `references/security-review.md`; the built-in `security-review` skill is a second opinion, not a replacement. Output: findings with file, line, severity, exploit scenario, fix - **no fixes yet**. Triage with the user, then fix by severity, one concern per commit, with a regression test per fix.
3. **Dependencies.** Audit; list vulnerable packages with severity and whether the vulnerable path is used; upgrade what's safe; explain what can't be; set up Dependabot/Renovate; run the audit in CI.
4. **Data protection.** Encrypt listed sensitive fields at rest; redact passwords/tokens/PII from all logs; account deletion that removes or anonymises data; user data export.
5. **Rate limiting** with a **shared store** (Redis/Upstash), never in-memory counters. Tiers: login/signup/reset strictest (per IP and per email), expensive endpoints per org, general API per user, public per IP. Return 429 with `Retry-After` in the standard error format; limits configurable per plan; tests that exceed each limit.
6. **Cost protection** for paid APIs (LLMs etc.): per-org daily/monthly quotas tied to plan, usage stored in the DB, a hard global spending cap that disables the feature, alert at 80%, a usage page for customers.
7. **Abuse review**: signup spam, email-sending abuse (invites, resets), user enumeration via error messages, scraping, flood-able webhooks, bot protection on signup.
8. **Caching** (`docs/caching.md`): per candidate say where it's cached (browser/CDN/server/Redis), TTL, key, invalidation. Hard rules: any tenant-data cache key includes `organization_id`; authenticated responses are never cached at a shared CDN layer. Content-hashed static assets with long lifetimes; correct Cache-Control (`private`/`no-store` where needed); optimised images; cache-aside with invalidation on every relevant write and a debug bypass; tests that prove invalidation and that two orgs never see each other's cached data.

## Pitfalls

- Rate limiting that resets on deploy or doesn't span instances; one global limit for everything.
- Different messages for "no such user" vs "wrong password".
- Caching authenticated pages at a shared layer -> serving one customer's data to another.
- Logs containing tokens or emails; verbose errors and debug endpoints in production.
- Treating "the reviewer found nothing" as proof of safety.

## Gate

`hyperskill.py gate harden`. Evidence: reviewer report path, test output for limits/caching, the XSS probe procedure and result, audit output. For `independent-review`, name the agent/session that ran it.
