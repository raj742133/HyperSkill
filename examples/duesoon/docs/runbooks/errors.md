# Alert: 5xx rate high / login 429 spike
**Find the cause:** take a `requestId` from a failing response header (`X-Request-Id`) and search the logs for it; `unhandled_error` lines include the stack.
**5xx:** usually a recent deploy: compare the first failing timestamp with the deploy time; roll back if they match.
**429 spike on login:** many distinct emails from one or few IPs = credential stuffing. The per-ip+email limit slows it; if it persists, block the source at the platform edge. Do not weaken the limit.
**Escalate when:** user data may have been exposed: follow `incident.md`.
