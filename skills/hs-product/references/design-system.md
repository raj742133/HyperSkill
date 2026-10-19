# Design system and designer pass (built-in fallback)

Fallback for the design-direction, design-system-generation, animation and design-critique slots. A provider that fills a slot advises; the gate evidence is still required.

**One voice rule.** One source sets the look (a provider or this file, never both), one sets motion, and the critique only reports. A critique may flag weak hierarchy; it may not swap the palette. Conflicts go to the owner.

## Direction before pixels

In `docs/design.md`, before any screen: three adjectives for the character and three for what to avoid; two or three reference products and what is borrowed from each; each screen's main job; density; the accent colour and type pairing.

## Tokens

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

A `/design` page renders every component in every state in both themes; anything shipped but missing from it is a one-off.

## Motion

Transitions of 120 to 240 ms, one shared easing curve, only to show cause and effect. Under `prefers-reduced-motion`, swap movement for a fade or nothing.

## Screen checklist

- [ ] Loading, empty, error and success are all designed
- [ ] One primary action per screen, clearly the strongest element
- [ ] Forms: visible labels, inline errors, submit disabled while pending, success confirmation
- [ ] 375px wide: no sideways scroll, touch targets at least 44px
- [ ] Tab order follows reading order; every control works by keyboard
- [ ] Hostile test data: long names, blank fields, thousands of rows

## Designer pass

Run on the running site with before and after screenshots. Subtract and clarify; add no features.

**1. Hierarchy.** Squint at a screenshot: the eye should land on one headline, then one primary action, then the rest. Size steps must be clearly distinct, related items closer than unrelated ones, edges aligned. Demote whatever competes for first place.

**2. Remove the generic look.** Delete template leftovers: gradient heroes, rows of identical cards, decorative badges, emoji bullets, default fonts. Replace with the pairing and accent from `docs/design.md` and one layout idea that fits this product.

**3. The 5-second test.** Show the top of the page to a stranger for five seconds. They should say what it is, who it is for, why it helps and what to do next. If not, fix words and structure before style.

**4. Review loop.** On the live site, list the ten costliest problems (confusing, hard to read, inconsistent, cramped), fix them, reload, repeat until the rest is minor. Ask "what can go?" before "what can we add?".

Honesty rule: ship no stats, logos or testimonials that are not real; use visibly marked placeholders until they exist.

## Accessibility quick run

Tab through everything, run the main flow with a screen reader, zoom to 200%, check forced colours and dark mode, and fail CI on serious or critical axe findings.

## Secrets check

Build, then search the output and client sources for key-like strings (`sk_`, `AKIA`, `secret`, `token`, private hostnames) and variables exposed via the framework's public prefix. Fix every hit and search again.
