---
name: hs-research
description: HyperSkill phase 0 - validate an idea before building. Researches the problem, users, alternatives and risks, and ends with a go / pivot / stop recommendation in docs/research.md. Use at the start of a new product, or when the user asks whether an idea is worth building.
---

# Phase 0 - Research

Goal: decide whether to build, and what the smallest valuable version is, **before** any code. Output: `docs/research.md` and a recorded go/pivot/stop decision.

## Owner decisions (ask, don't assume)

- Who is the first customer: individual, small team, or company? (this later decides the whole data model)
- What would make this a success in 6 months (revenue, users, learning)?
- Constraints: budget, solo vs team, regions, regulated data (health, finance, children)?

## Steps

1. **Frame the idea.** One paragraph: who, what painful job, what they do today. Restate it to the user and get a yes.
2. **Research in parallel.** Use the `deep-research` slot if installed (see `hyperskill/references/slots.md`). Otherwise spawn up to 4 `hs-researcher` agents, one per angle, in a single message:
   - Alternatives and competitors (including spreadsheets and "do nothing")
   - Users and pain evidence (forums, reviews, job posts, communities)
   - Market size, pricing norms, and how competitors acquire customers
   - Legal / compliance / platform risk for this kind of product
   Each returns findings with **source URLs** and a confidence level. Instruct them to separate what a source says from what they infer.
3. **Synthesise** into `docs/research.md` using `references/research-template.md`. Keep claims tied to sources; mark anything unsourced as an assumption.
4. **Stress the idea.** List the 3-5 riskiest assumptions, and for each a cheap test (landing page, 5 interviews, a manual concierge version). Prefer tests that take days, not weeks.
5. **Recommend** go / pivot / stop with reasons, plus a proposed v1 scope: the single workflow that must work, and a short list of what is out.
6. **Record the decision** with `hyperskill.py decide` and ask the user to confirm.

## Pitfalls

- Research that only confirms the idea. Actively search for why it would fail and who already tried.
- Invented numbers. Market sizes without a source are guesses; label them.
- Treating competitor marketing pages as evidence of demand.
- Scope creep: the output is a recommendation, not a spec (that's phase 1).

## Gate

Walk `hyperskill.py gate research`. Evidence for `alternatives-mapped` and `user-evidence` should be the URLs/quotes in `docs/research.md`.
