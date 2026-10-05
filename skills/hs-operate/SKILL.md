---
name: hs-operate
description: HyperSkill phase 6 - structured logging, error tracking, health checks, monitoring, alerts, runbooks and an incident process, so problems are found before users report them. Use when setting up observability, adding Sentry-style tracking, writing alerts/runbooks, or cleaning up error handling.
---

# Phase 6 - Operate (logs, errors, monitoring)

Goal: know the product is unhealthy **before** users tell you, and know what to do about it. Detail: `references/operate-playbook.md`.


**Slots:** run `hyperskill.py integrations phase operate` and follow `hyperskill/references/integrations.md` for the providers it names.

## Owner decisions

- Error-tracking tool (Sentry, Rollbar, Highlight, ...), log destination and retention.
- What counts as "down" vs "degraded" for *this* product (include the core workflow, not just the server).
- Who is alerted, how (email, Slack, SMS, call) and when; the SLO target (e.g. 99.9%).

## Steps

1. **Structured logging.** Replace `console.log`/`print` with a JSON logger (debug/info/warn/error). Request ID on every line and in a response header; `user_id` and `organization_id` when known; automatic redaction of password/token/secret/authorization and listed personal fields; debug off in production. Show an example log line.
2. **Error tracking** on frontend and backend: attach user/org/request IDs (no emails or personal data unless approved), source maps uploaded but not served publicly, separate staging vs production, and a staging-only route that throws so delivery can be verified.
3. **Error-handling cleanup.** Find empty or over-broad `catch` blocks, ignored promise rejections, errors caught but neither logged nor rethrown. Fix so each is handled meaningfully or reported; users see a friendly message, error tracking gets the detail.
4. **Health checks.** `/api/health` verifies DB, cache and job system with timeouts and returns per-component status; `/api/health/live` is a cheap process-up check for the load balancer.
5. **Monitoring plan** (`docs/monitoring.md`): uptime checks (homepage, login, health, core workflow endpoint); technical metrics (error rate, p95 latency per endpoint, DB connections, job queue depth and failure rate); business metrics (signups, active orgs, successful and failed payments); alert rules with threshold, duration, severity and recipient. **Only alert on things a human must act on.**
6. **Runbooks** in `docs/runbooks/`: per alert - what it means, how to check impact, likely causes, step-by-step fixes, when to escalate. Link each alert to its runbook.
7. **Incidents.** A simple public status page and `docs/runbooks/incident.md`: how to declare, how to talk to customers, a short post-incident review template.

## Pitfalls

- Nothing set up because nothing is visible until it breaks.
- Noisy alerts that train everyone to ignore them.
- Watching the server but not whether users can complete the core workflow.
- Logging sensitive data; no way to follow one request through the system.

## Gate

`hyperskill.py gate operate`. Evidence: example log line + request-ID trace, tracker event link/screenshot, `grep -ri password` on logs, the staging-DB-stop drill and the alert timestamp.
