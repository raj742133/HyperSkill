# 0007. Keep can() and structured logging despite review advice to drop them

- Date: 2026-10-19T18:15:44Z
- Phase: plan

## Decision
Keep both; every query is also scoped by user_id

## Why
HyperSkill rules require a central authorisation function and structured logs; cheap at this size

## Alternatives considered
_Add here._

## Consequences
_Add here._
