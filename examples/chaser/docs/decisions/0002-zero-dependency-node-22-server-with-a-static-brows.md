# 0002. Zero-dependency Node 22 server with a static browser page

- Date: 2026-10-19T20:20:06Z
- Phase: plan

## Decision
Node 22 built-in http and node:test, plain HTML/CSS/ES module front end, no npm dependencies, JSON Lines files for counters and the waitlist.

## Why
Four routes and two small files do not justify a framework or database; every dependency is audit cost for a throwaway test. Owner to confirm they can debug it.

## Alternatives considered
- Express plus a validation library: rejected, four routes do not need it and each dependency is audit cost.
- Static host plus a managed counter only: viable and simpler, noted by the review; kept as the swap path through the `store/` boundary.
- SQLite: rejected for two tiny append-only files.

## Consequences
- No supply-chain surface from npm for this test.
- Hosting must offer a persistent disk, or the store module must be swapped.
- The owner must be comfortable debugging plain Node; confirm.
