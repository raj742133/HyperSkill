# 0007. Free tool: no pricing test, no counters, no waitlist

- Date: 2026-10-20
- Phase: product

## Decision
Chaser is a free message generator. The priced "I would pay for this" button, the email waitlist, the event counters and the operator stats endpoint are removed. The server only serves the page and answers health checks.

## Why
The owner does not want to make money from it. Decisions 0001 and 0004 existed to test willingness to pay; without that goal the measuring has no purpose, and it was the only reason the project needed a named operator, a persistent disk, a privacy notice for stored emails and three open owner questions (operator name, traffic source, interviews).

## Alternatives considered
- Keep counters but drop the price: still needs a disk and a notice for no decision that anyone will make.
- Keep the waitlist for "tell me when automatic sending exists": that feature is out of scope, so the list would collect emails for nothing.

## Consequences
- Nothing is stored or counted on the server. The page makes no request after it loads, and the CSP now says `connect-src 'none'` to enforce it. A browser test fails if any request is made.
- Hosting is a plain static host: no persistent disk, no secrets, no environment values beyond PORT, HOST and NODE_ENV.
- Supersedes decisions 0001's success rule (section 9 of the system design), 0004 and the data sections of `system-design.md`, `architecture.md` and `research.md`, which are kept as the record of the earlier plan.
- Whether anyone uses it can no longer be measured by this page. The host's own access logs are the only trace.
