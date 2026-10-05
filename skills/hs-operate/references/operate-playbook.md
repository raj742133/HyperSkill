# Operate playbook (layers 13-14)

## Layer 13 - Error tracking and logs

Prompts:

> Replace all console.log/print calls with a structured logger (JSON; debug, info, warn, error). Every request gets a request ID included in every log line and returned in a response header. Every line includes user_id and organization_id when available. Automatically redact password, token, secret, authorization, and <personal fields>. Debug level is off in production. Show an example log line for a request.

> Integrate <Sentry> on frontend and backend. Attach user_id, organization_id and request ID to every error (no emails or personal data without approval). Upload source maps but don't serve them publicly. Separate staging and production. Add a staging-only route that throws so I can verify delivery.

> Find every empty or overly broad catch block, ignored promise rejection, and place where an error is caught but not logged or rethrown. Fix them so errors are handled meaningfully or reported. Users see a friendly message; full detail goes to error tracking.

Verify: a staging error shows in the tracker with a readable stack trace within a minute; a request ID from a response header finds every log line for that request; searching logs for "password" returns zero results.

## Layer 14 - Monitoring and alerts

> Write `docs/monitoring.md` defining: uptime checks for homepage, login, `/api/health` and <core workflow endpoint>; technical metrics (error rate, p95 latency per endpoint, DB connections, job queue depth and failure rate); business metrics (signups, active orgs, successful and failed payments); alert rules with threshold, duration, severity and who is notified. Only alert on things that need a human.

> Upgrade `/api/health` to verify DB, cache and job-system connectivity with timeouts and component-level status. Keep a lightweight `/api/health/live` for the load balancer that only confirms the process is up.

> For each alert in `docs/monitoring.md` write a runbook in `docs/runbooks/`: what it means, how to check impact, likely causes, step-by-step fixes, when to escalate. Link each alert to its runbook.

> Set up a simple public status page and write `docs/runbooks/incident.md`: how to declare an incident, how to communicate with customers, and a template for a short post-incident review.

Verify: stop the staging database and an alert reaches you within the defined time; every alert has a runbook; someone looks at the dashboard at least weekly (put it in a calendar).
