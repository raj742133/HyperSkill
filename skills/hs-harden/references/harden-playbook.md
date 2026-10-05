# Harden playbook (layers 10-12)

## Layer 10 - Security
Agents build what you ask without thinking like an attacker; trust user input in queries, HTML, file paths and redirects; log sensitive data; add outdated packages; leave debug routes on.

Threat model prompt:
> Create `docs/security/threat-model.md`. List assets (data, accounts, payments) and entry points (every endpoint, upload, webhook, form). For each entry point list relevant OWASP Top 10 threats, rate likelihood and impact, and list mitigations we have and are missing.

Review prompt: see `security-review.md` (run in a fresh context, report only).

Dependency prompt:
> Run a dependency vulnerability audit. List vulnerable packages with severity and whether we actually use the vulnerable code path. Upgrade what's safe; explain what can't be upgraded. Set up automated dependency-update PRs (Dependabot or Renovate) and add the audit to CI.

Data protection prompt:
> Implement: encryption at rest for <fields>; redaction of passwords, tokens and personal data from all logs; account deletion that removes or anonymises the user's data; a data-export feature so users can download their data.

Verify: independent reviewer ran it; script payload in every text field executes nothing; logs contain no emails, tokens or passwords.

## Layer 11 - Rate limiting
Agents don't add it unless asked; use in-memory counters that reset on deploy and don't span servers; apply one global limit.

Prompt:
> Implement rate limiting with a shared store (Redis/Upstash) so it works across instances. Limits: login/signup/password-reset <N per 15 min per IP and per email>; expensive endpoints <list> <N per minute per org>; general API <N per minute per user>; unauthenticated <N per minute per IP>. Return 429 with Retry-After in our standard error format. Configurable per plan. Write tests that exceed each limit.

Cost protection prompt:
> We call <paid API>. Add per-org daily/monthly quotas tied to plan; usage tracking in the database; a hard global spending cap that disables the feature; an alert at 80% of an org's quota or the global cap; a usage page in the UI.

Abuse review prompt:
> Review our public surface for abuse: signup spam, email sending abuse (invites, resets), user enumeration via error messages, scraping of public pages, flood-able webhook endpoints. Propose protections for each, including bot protection on signup.

Verify: 20 rapid logins get blocked; limits survive a redeploy; wrong password and no such user give the same message.

## Layer 12 - Caching and CDN
Agents cache too aggressively (stale or, worse, another tenant's data), cache nothing, forget invalidation, serve huge images.

Strategy prompt:
> Propose caching in `docs/caching.md`. For each candidate (static assets, public pages, API responses, expensive queries, third-party results) specify where it's cached (browser, CDN, server, Redis), TTL, cache key, and how it's invalidated. Rules: any cache of tenant data includes `organization_id` in the key; authenticated responses are never cached at a shared CDN layer.

CDN prompt:
> Serve static assets from a CDN with long lifetimes and content-hashed filenames. Optimise images (modern formats, responsive sizes, lazy loading). Set correct Cache-Control for static assets, public pages and authenticated API responses (private / no-store where needed). Show the headers for one example of each.

App cache prompt:
> Add Redis caching for <slow operations> using cache-aside with keys that include `organization_id`. Invalidate on every write that affects the data. Add a way to bypass the cache for debugging. Tests: cache invalidated on update; two orgs never receive each other's cached data.

Verify: two browsers logged into different orgs never see each other's data even after refreshes; an update shows up immediately (or within the agreed TTL); Lighthouse run on main pages.
