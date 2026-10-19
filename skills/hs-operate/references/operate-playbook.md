# Operate reference

How to learn something is wrong before a customer emails, and what to do next. Named tools are examples; the owner chooses.

## 1. Logs you can follow

- One JSON logger with debug / info / warn / error. No bare `print` or `console.log` in application code.
- Middleware assigns a request ID, stamps it on every line for that request and returns it in a response header, so a support ticket quoting the header leads to the whole story.
- Add `user_id` and `organization_id` when known.
- Redact by key name (password, token, secret, authorization, cookie, plus the project's personal fields) inside the logger, not at call sites.
- Production runs at info or above; set retention to match the privacy policy.

Example for the evidence:

```json
{"ts":"2026-03-02T10:14:07Z","level":"info","req":"b7f3c1","user_id":"u_42","org_id":"o_9","msg":"invoice.created","ms":38}
```

## 2. Errors

- Tracker in browser and server code, with separate staging and production environments.
- Tag events with request, user and organisation IDs; no emails or personal data unless approved.
- Upload source maps to the tracker; never serve them publicly.
- Add a staging-only route that throws; confirm a readable stack trace arrives within a minute.
- Sweep for swallowed failures: empty `catch`, handlers that only return a default, floating promises, errors logged without context. Handle each deliberately or report it. Users see a short human message; the tracker gets the detail.

## 3. Health endpoints

- `/api/health` (readiness): checks database, cache and job queue, each with a short timeout, returns status per component and HTTP 503 when a required one fails.
- `/api/health/live` (liveness): 200 if the process answers, touching no dependency, so a database blip does not cause healthy instances to be killed.

## 4. What to watch

Write `docs/monitoring.md`.

- **Outside probes**: home page, sign-in, health endpoint, and one request that exercises the core workflow.
- **Technical**: error rate, p95 latency per route, database connections, queue depth, job failures, disk and memory.
- **Business**: signups, active organisations, successful versus failed payments. A drop here often comes before any technical alarm.
- **Alert table**: signal, threshold, sustained for how long, severity, recipient and channel, runbook link.

Page a person only for what needs a person now; send the rest to a digest. An alert that fires twice with no action gets deleted or retuned. Define "down" and "degraded" for this product, and an availability target the owner picks.

## 5. Runbooks

One file per alert in `docs/runbooks/`, same skeleton:
1. What the alert means
2. Who is affected and how to check
3. Likely causes, commonest first
4. Fix steps, copy-pasteable
5. Escalation: when and to whom
6. How to confirm recovery

## 6. Incidents

- A public status page the owner can update without a deploy.
- `docs/runbooks/incident.md`: how to declare one, who leads and who talks to customers, update cadence, where notes go.
- Afterwards, a short blameless review: timeline, impact, cause, what detection missed, actions with owners and dates.

## Prove it

Trace one request ID through the logs; search logs for "password" and a real token, finding nothing; trigger the staging error; stop the staging database and note when the alert reached a human; follow each alert's runbook link. Put a weekly dashboard look in a calendar.
