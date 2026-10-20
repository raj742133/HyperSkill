# 0004. Measure with event counts and a priced fake door

- Date: 2026-10-19T20:20:06Z
- Phase: plan

## Decision
Event counters with exact ratios, page loads as the visitor proxy, a Rs 149/month priced control as the pay-intent metric, owner and friends excluded.

## Why
Independent review (docs/design-review.md H1, H2) showed an unpriced waitlist and an unspecified denominator could not test willingness to pay.

## Alternatives considered
- Unpriced waitlist: rejected by the review (measures curiosity).
- Unique-visitor counting with cookies or fingerprinting: rejected, it conflicts with the no-tracking promise.
- Third-party analytics: rejected for the same reason.

## Consequences
- Page loads stand in for visitors, so reloads and repeat visits inflate the denominator.
- Owner and friends are excluded from decisions through `src` tags.
- A borderline result extends the test instead of ending it.
