---
name: hs-product
description: HyperSkill phase 3 - build the frontend: design system first, then screens with loading/empty/error/success states, accessibility and mobile support. Use for UI work, design systems, pages, forms, accessibility audits, or checking the client bundle for leaked secrets.
---

# Phase 3 - Product (frontend)

Goal: a UI that looks designed rather than templated, handles every state, is accessible, and leaks nothing. Detail: `references/design-system.md`.


**Slots:** run `hyperskill.py integrations phase product` and follow `hyperskill/references/integrations.md` for the providers it names.

## Owner decisions

- Design direction and brand. Ask for 2-3 reference products or screenshots; do not invent a look.
- Component library (shadcn/ui, Radix, MUI, ...).
- Which screens matter for launch (cut the rest).

## Steps

1. **Run the design chain.** Slots in order: `design-direction` (sets the look and dials *before* pixels), then `animation` (motion craft), then after building `design-critique` (audit/critique; write the report to `docs/design-audit.md`). One voice per concern: direction decides the look, animation decides motion, critique never rewrites direction. Conflicts go to the owner. With no provider installed use `references/design-system.md`. Either way, run steps 2-6.
2. **Design system first.** Colour tokens (with dark mode), type scale, spacing scale, radii; base components (Button, Input, Select, Modal, Toast, Table, EmptyState, ErrorState, Skeleton); a `/design` page showing every component in every state. From now on use only these components.
3. **Build each screen** on the design system and the real API. Every data-driven view handles four states: **loading** (skeletons), **empty** (helpful text + primary action), **error** (message + retry), **success**. Forms: client validation that mirrors the server rules, submit disabled while pending, inline field errors, success feedback. Works at 375px and desktop.
4. **Verify in a real browser.** Use the `browser-verify` slot (Chrome DevTools for agents, `run` skill, or Playwright; use a clean browser profile, never the owner's signed-in one) to drive the screens, take screenshots at 375px and desktop, and exercise the empty/error states by faking responses. Look at the screenshots yourself and fix visible defects.
5. **Accessibility pass (WCAG 2.1 AA).** Labels on all inputs, keyboard navigation, visible focus, contrast, alt text, heading order, ARIA only where native elements can't do the job. Add an automated check (axe) to the test suite.
6. **Secrets check.** Search the built bundle and client code for API keys, tokens and private URLs. Only variables intended to be public may reach the browser.

## Pitfalls

- Happy path only; no loading/empty/error states.
- Generic template look. Fix with real references and a deliberate type/colour system, not with more gradients.
- Missing labels, no focus states, keyboard traps, low contrast.
- Giant components and duplicated UI code; inconsistent spacing.
- Server secrets pulled into client code through framework env conventions (check the public-prefix rules of the framework in use).

## Gate

`hyperskill.py gate product`. Evidence: screenshots/paths, axe output, the secrets-search command and its result.
