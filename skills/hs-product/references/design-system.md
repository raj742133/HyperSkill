# Design system and designer pass (built-in fallback)

Used when no provider fills the design-direction, design-system-generation, animation or design-critique slots. If one does, it advises and this file still supplies the gate evidence.

**One voice rule.** One source sets the look (a provider or this file, never both), one sets motion, and the critique only reports. A critique may say "the hierarchy is weak"; it may not swap the palette. Disagreements go to the owner.

## Direction before pixels

In `docs/design.md`, before any screen: three adjectives for the product's character and three for what it must not feel like; two or three reference products with the one thing borrowed from each; the main job of each screen; density (work tool or spacious marketing); the accent colour and type pairing.

## Tokens

Components read tokens and never hold raw values.

- **Colour.** About ten neutral steps, one brand hue with hover, pressed and tint variants, plus success, warning, danger and info. Every token has a light and a dark value. Body text needs 4.5:1 contrast; large text and control borders 3:1.
- **Type.** One interface family, optionally one display family. Build the scale from a ratio (about 1.2 to 1.25) with a fixed line height per step; three weights at most.
- **Spacing.** A 4px unit and its multiples (4, 8, 12, 16, 24, 32, 48, 64). Anything else is a bug.
- **Shape and depth.** Two or three radii, two or three shadow levels.

## Components and their states

Build first: Button, Input, Select, Modal, Toast, Table, EmptyState, ErrorState, Skeleton.

| Component | States to design and show |
|---|---|
| Button | default, hover, focus, pressed, disabled, loading |
| Input / Select | empty, focused, filled, error, disabled |
| Modal | focus moves in and is trapped, Esc closes, focus returns to the trigger |
| Toast | announced politely to screen readers |
| Table | loading skeleton, empty, sorted, paginated |
| EmptyState / ErrorState | says what happened and offers the next step or a retry |

A `/design` page renders every component in every state in both themes. Anything shipped that is missing from it is a one-off or a gap in the system.

## Motion

Transitions of 120 to 240 ms with one shared easing curve, used to show cause and effect only. Under `prefers-reduced-motion`, swap movement for a fade or nothing.

## Screen checklist

- [ ] Loading, empty, error and success are all designed
- [ ] One primary action per screen, clearly the strongest element
- [ ] Forms: visible labels, helper text, inline errors, submit disabled while pending, confirmation on success
- [ ] 375px wide: no sideways scroll, touch targets at least 44px
- [ ] Tab order follows reading order; every control works by keyboard
- [ ] No text baked into images; useful alt text where an image carries meaning
- [ ] Hostile test data: very long names, blank fields, thousands of rows

## Designer pass

Run on the running site once real screens exist, with before and after screenshots. Subtract and clarify; do not add features.

**1. Hierarchy.** Blur or squint at a screenshot. The eye should land on one headline, then one primary action, then the rest. Check that size and weight steps are clearly distinct, related items sit closer together than unrelated ones, and elements share alignment edges. Demote whatever competes for first place.

**2. Remove the generic look.** Delete what is there only because templates have it: gradient heroes, rows of identical feature cards, decorative badges, emoji bullets, stock blobs, a default font stack. Replace with the type pairing and accent from `docs/design.md` and one layout idea that belongs to this product.

**3. The 5-second test.** Show the top of the page to a stranger for five seconds, or read only its visible text. They should say what it is, who it is for, why it helps and what to do next. If not, fix words and structure before style.

**4. Review loop.** On the live site, list the ten costliest problems (confusing, hard to read, inconsistent, cramped, slow to scan), fix them, reload, repeat until what remains is minor. Ask "what can go?" before "what can we add?".

Honesty rule: example layouts love round numbers and famous logos. Ship none that are not real; use visibly marked placeholders until true figures, customers and quotes exist.

## Accessibility quick run

Tab through everything; run the main flow with a screen reader; zoom to 200%; check forced colours and dark mode; run axe in CI and fail on serious or critical findings.

## Secrets check

Build, then search the output folder and client sources for key-like strings (`sk_`, `AKIA`, `secret`, `token`, private hostnames) and for variables exposed through the framework's public prefix. Fix every hit and search again.
