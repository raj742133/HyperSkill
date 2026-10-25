---
name: hs-responsive
description: Turn a desktop design into a mobile one that works, and prove it - a checklist for adapting layout, navigation, type and targets, plus a measured check at phone, tablet and desktop widths for sideways scrolling, tap targets, form-field zoom and tiny text. Use when a page or screen is desktop-first, when the user says it breaks on a phone, or before the phone-test gate is marked passed.
---

# hs-responsive

Making a page "responsive" is not shrinking it. It is deciding what matters on a small screen, then proving nothing breaks. Standard library Python; the check needs a Chrome-family browser.

## Check

```
python3 ${CLAUDE_PLUGIN_ROOT}/skills/hs-responsive/scripts/page_check.py dist/index.html
python3 ${CLAUDE_PLUGIN_ROOT}/skills/hs-responsive/scripts/page_check.py dist/index.html --widths 360,390,768,1024,1440
```

It loads a temporary copy of the page into an iframe of each width (Chrome will not open a window under 500px) and reports, ranked **blocker / important / polish**: sideways scrolling and the elements that cause it, a missing viewport tag, tap targets under 44px (under 24px is a blocker), form fields under 16px (iOS zooms the page when one is focused), text under 12px. It exits 1 on a blocker. It does not judge taste: look at screenshots too (the `browser-verify` slot).

## Adapt, in this order

1. **Say what the phone user came for** in one sentence; that content comes first, in source order. Secondary content moves down, collapses, or goes behind a control.
2. **One column.** Multi-column grids become a single column at the narrowest width; side-by-side comparisons become stacked cards or a table that scrolls inside its own box (never the page).
3. **Navigation.** A long bar becomes the few things that matter plus a menu, or keeps the nav in a row that scrolls inside itself. The primary action stays reachable without scrolling back to the top.
4. **Type and space.** Body text at least 16px; headings scale with `clamp()` and keep two lines or fewer; line length about 35 to 45 characters; padding at least 16px at the sides.
5. **Targets.** At least 44 by 44 CSS px with space between them; inline links in running text are the one allowed exception.
6. **Forms.** Fields 16px or larger, the right `type` and `inputmode` (email, tel, numeric), labels above fields, a visible error beside the field.
7. **Media.** Images and video `max-width: 100%`, with width and height set so nothing shifts; do not hide meaning in a hover state.
8. **Tables and code.** Wrap them in a box with `overflow-x: auto`.
9. **Test where it breaks, not just at 390.** Also at the widths where your layout changes (resize and watch for the first overflow), and in landscape.

## Rules

- No horizontal page scroll at any width from 320px up. A wide element scrolls inside a wrapper.
- Do not use `user-scalable=no` or `maximum-scale`; people zoom.
- Fix the cause (a fixed width, a long unbreakable word, a negative margin), not the symptom (`overflow-x: hidden` on `body` hides the break and breaks sticky positioning).
- Report the widths you checked and what the check printed. A page that was only checked at 390 has not been checked at 768.
