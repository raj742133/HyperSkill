---
name: hs-a11y-review
description: Accessibility review with measured results, not opinions - real contrast ratios for text and focus rings in light and dark, exact colours that fix a failure, and a ranked list of keyboard, label, target and motion problems. Use before an accessibility gate is marked passed, when the user asks for an accessibility or WCAG check, or after a colour or theme change.
---

# hs-a11y-review

An accessibility finding is only useful if it can be checked and fixed. Every finding here has the measurement, the rule it breaks and the exact change. Standard library Python; the page check needs a Chrome-family browser.

## Measure

```
python3 ${CLAUDE_PLUGIN_ROOT}/skills/hs-a11y-review/scripts/page_contrast.py dist/index.html        # what the browser actually paints, light and dark
python3 ${CLAUDE_PLUGIN_ROOT}/skills/hs-a11y-review/scripts/contrast.py src/ --theme both           # what the stylesheets declare, before a build exists
```

- `page_contrast.py` opens a temporary copy of the page in headless Chrome, reads each text element's computed colour and its real background (translucent layers composited), and checks 4.5:1, or 3:1 for large text (24px, or 18.66px bold). It runs once in each colour scheme. Text over a gradient or an image is listed as **not measured**: look at it yourself.
- `contrast.py` reads CSS directly, resolves `var(--x)`, and also checks focus-ring colours (3:1). A colour with no background of its own is paired with the page background and reported as **check**, not as a failure, because a panel behind it may change the answer; `page_contrast.py` settles those.
- Both exit 1 on a failure and print `-> use #xxxxxx`: the nearest colour of the same hue that passes. Use it, or change the background; do not lower the bar.

## Then review what a number cannot see

Work through these on the running page (the `browser-verify` slot drives it), at phone and desktop width, and rank each finding:

1. **Keyboard.** Tab through everything. Every control reachable, in a sensible order, with a visible focus ring that is clearly not just the border; no keyboard trap; Escape closes what opened.
2. **Names.** Every button, link and field has an accessible name that says what it does (not "click here", not an icon with no label); form fields have real `<label>`s; images that carry meaning have alt text, decorative ones have empty alt.
3. **Structure.** One `h1`, headings in order, landmarks (`header`, `nav`, `main`, `footer`), the language set on `<html>`, a skip link.
4. **Targets.** Touch targets at least 44 CSS px (24px is the WCAG floor); `hs-responsive` measures them.
5. **Motion and time.** `prefers-reduced-motion` honoured; nothing flashes more than three times a second; auto-playing media can be paused.
6. **Colour alone.** Errors, states and chart series are not told apart by colour only.
7. **Zoom and text.** The page works at 200% zoom and with larger default text; nothing is clipped or overlaps.

## Report

Write `docs/a11y-audit.md`. One block per finding, ranked **blocker** (a user cannot do something, or a measured failure), **warning** (a real barrier with a workaround), **advisory** (better practice):

```
BLOCKER  Hero body text, #8a8a8a on #f4f4f4 = 2.6:1, needs 4.5:1 (WCAG 1.4.3)
  Where:  .hero p (src/styles.css:112), light theme
  Fix:    colour #5c5c5c  (7.1:1)
```

Quote the command and its output as evidence for the gate. Say what was not measured (gradients, images, anything only reachable by a flow you did not run), and do not claim "accessible": say which checks passed on which pages.
