# Plan playbook

## Layer 1 - System design

**What it is:** the what and how-much before code: users, workflows, data and traffic expectations, what must never break, the trade-offs taken.

**Where agents go wrong:** they jump straight to code and invent requirements; they design for a toy (one user, no concurrency) or over-engineer; they ignore multi-tenancy.

**Interview prompt (adapt, don't paste blindly):**
> I'm building <one paragraph>. Do not write code. Interview me one group of questions at a time about: users and roles; the 3-5 core workflows; tenancy; data stored and its sensitivity; expected scale in year one; billing and plans; compliance and regional rules; third-party integrations. When I've answered, write `docs/system-design.md` with: problem statement, user roles, core flows, functional requirements, non-functional requirements (performance, availability, security), out of scope, open questions.

**Stress-test prompt (for `hs-reviewer`):**
> Read `docs/system-design.md`. Act as a skeptical staff engineer. Find missing requirements, ambiguous flows, scaling risks, security and privacy risks, and anything over-engineered for this stage. Rank by severity. Propose the simplest design that meets the requirements. Do not edit the file; return a list.

**Capacity prompt:**
> From the design, estimate for year one: peak requests per second, database size, file storage, background-job volume. Show the maths. Name the first component to become a bottleneck.

**Verify:** the file exists and the owner read it; tenancy is written; there is an out-of-scope section (without one the agent keeps adding features).

## Layer 2 - System architecture

**What it is:** the concrete building blocks - services, how they talk, where data lives, what runs in the background, which third parties are used.

**Where agents go wrong:** choose whatever was most common in training data; add dependencies freely; mix concerns; do slow work inside requests.

**Owner decisions:** modular monolith vs services (default: modular monolith); managed vs self-hosted (default: managed); language/framework the owner can maintain.

**Architecture prompt:**
> Read `docs/system-design.md`. Propose an architecture for a solo/small team with low ops burden and easy debugging; prefer a modular monolith. Give: a Mermaid component diagram; stack per layer with one rejected alternative each; repo folder structure; where background jobs run; third-party services with cost at our scale; the 3 riskiest decisions. Write to `docs/architecture.md`. No code yet.

**Scaffold prompt:**
> Scaffold exactly per `docs/architecture.md`: folder structure, strict typing, linter, formatter, `.env.example` documenting every variable, a README with setup steps, and `/api/health`. No features. Start the dev server and call the health endpoint to prove it.

**Verify:** the owner can explain every box; each dependency has a reason; logic is in a dedicated layer (`services/`, `domain/`), not in UI or route files.
