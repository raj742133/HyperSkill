# Operate reference

Learn something is wrong before a customer emails, and know what to do next. Named tools are examples; the owner chooses.

## 1. Logs you can follow

- One JSON logger (debug / info / warn / error); no bare `print` or `console.log`.
- Middleware assigns a request ID, stamps it on every line for that request and returns it in a response header, so one ticket traces the whole story.
- Add `user_id` and `organization_id` when known.
- Redact by key name (password, token, secret, authorization, cookie, plus the project's personal fields) inside the logger, not at call sites.
- Production runs at info or above; retention matches the privacy policy.

Example line:

```json
{"ts":"2026-03-02T10:14:07Z","level":"info","req":"b7f3c1","user_id":"u_42","org_id":"o_9","msg":"invoice.created","ms":38}
```

## 2. Errors

- Tracker in browser and server code; separate staging and production.
- Tag events with request, user and organisation IDs; no emails or personal data unless approved.
- Source maps go to the tracker, never public.
- Add a staging-only route that throws; confirm a readable stack trace arrives within a minute.
- Sweep for swallowed failures: empty `catch`, handlers that only return a default, floating promises. Handle each deliberately or report it; users see a short message, the tracker gets the detail.

## 3. Health endpoints

- `/api/health` (readiness): checks database, cache and job queue, each with a short timeout, returns status per component and HTTP 503 when a required one fails.
- `/api/health/live` (liveness): 200 if the process answers, touching no dependency, so a database blip cannot get healthy instances killed.

## 4. What to watch

In `docs/monitoring.md`:

- **Outside probes**: home page, sign-in, health endpoint, and one request that exercises the core workflow.
- **Technical**: error rate, p95 latency per route, database connections, queue depth, job failures.
- **Business**: signups, active organisations, payment successes and failures.
- **Alert table**: signal, threshold, duration, severity, recipient, runbook link.

Page a person only for what needs a person now; send the rest to a digest. Retune alerts nobody acts on. Define "down" and "degraded" for this product, and an availability target the owner picks.

## 5. Runbooks

One file per alert in `docs/runbooks/`, same skeleton:
1. What the alert means
2. Who is affected
3. Likely causes, commonest first
4. Fix steps
5. Escalation
6. How to confirm recovery

## 6. Incidents

- Public status page, updatable without a deploy.
- `docs/runbooks/incident.md`: how to declare one, who leads and who talks to customers, update cadence, where notes go.
- Afterwards, a short blameless review: timeline, impact, cause, detection gaps, actions with owners.

## Prove it

Trace one request ID through the logs; search logs for "password" and a real token, finding nothing; trigger the staging error; stop the staging database and note when the alert reached a human.
