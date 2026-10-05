---
name: hs-scale
description: HyperSkill phase 8 - measure and scale: load tests, scaling-readiness review, targeted optimisation with before/after numbers, and cost modelling. Use when traffic grows, latency degrades, or the user asks whether the app can handle N users or what it will cost at 10x.
---

# Phase 8 - Scale

Rule zero: **measure first, then optimise the actual bottleneck.** No sharding, microservices or Kubernetes on a hunch.


**Slots:** run `hyperskill.py integrations phase scale` and follow `hyperskill/references/integrations.md` for the providers it names.

## Owner decisions

- Target (e.g. p95 < 300 ms at N concurrent users) and the infrastructure budget as you grow.

## Steps

1. **Load test** (k6 or similar) against **staging**, never production: the 5 most important endpoints plus the core user flow, N concurrent users ramping over ~10 minutes. Report p50/p95/p99 latency, error rate, and the load at which performance degrades. Name the bottleneck component (use metrics from `hs-operate`).
2. **Scaling-readiness review** (via `hs-reviewer` if large): is the app stateless (no in-memory sessions, uploads, rate-limit counters) so several instances can run; DB connection pooling correct for multiple instances/serverless; slow queries (`EXPLAIN` the top ones) and missing indexes; heavy work still in requests; unbounded list endpoints; large payloads. Rank by what breaks first at 10x and 100x.
3. **Targeted optimisation.** For the measured bottleneck propose 3 options from simplest to most complex with cost and effort; implement the simplest that meets the target; **re-run the load test and show before/after numbers.**
4. **Multi-instance check.** Run two backend instances at once and repeat the core flow; nothing may break (sessions, jobs run once, limits shared).
5. **Cost at scale.** Using `docs/hosting.md` and current usage, model monthly infrastructure cost at 10x and 100x; find the most expensive component at each level and ways to reduce it. Update billing alerts.

## Pitfalls

- Over-engineering for traffic you don't have, or ignoring basics that break first: missing indexes, N+1 queries, no connection pooling, synchronous heavy work.
- Optimising without a baseline, so there is no proof it helped.
- Load-testing production, or a staging environment that doesn't resemble it.

## Gate

`hyperskill.py gate scale`. Evidence: tool output files with numbers, before/after tables, the two-instance run, the cost model path.

## Afterwards

The list never ends: transactional email (SPF/DKIM/DMARC), product analytics, feature flags, audit logs, an internal admin panel with audit trail, onboarding, internationalisation, disaster recovery. Treat each as its own mini-cycle: plan, review the plan, implement small, verify, record the decision.
