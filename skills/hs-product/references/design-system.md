# Design system essentials (built-in fallback for the `frontend-design` slot)

## Direction before pixels
Write 5 lines in `docs/design.md`: the product's personality (3 adjectives), 2-3 reference products and what to borrow from each, the primary user task per screen, density (dense tool vs airy marketing), and what to avoid.

## Tokens
- **Colour:** neutral scale (9-11 steps), one brand hue with hover/active/subtle variants, semantic colours (success, warning, danger, info). Define light and dark values for every token; components reference tokens only. Check text contrast >= 4.5:1 (3:1 for large text and UI borders).
- **Type:** one UI family (+ optional display family). A scale such as 12 / 14 / 16 / 20 / 24 / 32 / 48 with set line heights; at most 3 weights.
- **Spacing:** 4px base grid (4, 8, 12, 16, 24, 32, 48, 64). No off-grid values.
- **Radius / elevation / motion:** 2-3 radii, 2-3 shadows, durations 120-240ms with one easing curve; respect `prefers-reduced-motion`.

## Components and their states
Button (default, hover, focus, active, disabled, loading) - Input/Select (empty, focus, filled, error, disabled) - Modal (focus trap, Esc to close, return focus) - Toast (polite live region) - Table (loading skeleton, empty, sorted, paginated) - EmptyState - ErrorState (retry) - Skeleton.

The `/design` page renders each component in each state, in both themes. Anything shipped that isn't on this page is a smell.

## Screen checklist
- [ ] Loading, empty, error, success all designed
- [ ] One primary action per screen, visually dominant
- [ ] Forms: labels, helper text, inline errors, disabled-while-pending, success feedback
- [ ] 375px: no horizontal scroll, tap targets >= 44px
- [ ] Focus order matches reading order; all controls keyboard reachable
- [ ] No text in images; alt text on meaningful images
- [ ] Real content in mock data (long names, empty values, 10k items)

## Avoiding the "AI template" look
Specific type pairing instead of defaults; a restrained palette with one confident accent; consistent spacing rhythm; real empty states with personality; no stock gradient hero, no emoji bullet lists, no identical card grids everywhere.

## Accessibility quick-run
Tab through the whole app; use a screen reader on the main flow; zoom to 200%; test with forced colours / dark mode; run axe in CI and fail on serious/critical violations.

## Secrets check
Build, then search the output directory and client sources for key patterns (`sk_`, `AKIA`, `secret`, `token`, private hostnames) and for env vars exposed with the framework's public prefix. List what's found, fix it, and re-run.
