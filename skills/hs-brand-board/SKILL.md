---
name: hs-brand-board
description: Make a one-page bento brand board from a small spec - logo, colours with measured contrast, type, voice, a sample of the UI and do/don't rules - as one self-contained HTML file. Use after a logo and palette are chosen, for a pitch, a case study, a README header or a handover to a designer.
---

# hs-brand-board

A brand board shows the decisions that were made, in one glance. This one is generated from a spec so it cannot drift from the real values, and it measures what a designer would otherwise eyeball.

```
python3 ${CLAUDE_PLUGIN_ROOT}/skills/hs-brand-board/scripts/board.py --example > brand.json     # edit it
python3 ${CLAUDE_PLUGIN_ROOT}/skills/hs-brand-board/scripts/board.py brand.json --out docs/brand-board.html
```

## The spec

`name`, `tagline`, `logo` (an SVG or PNG path, relative to the spec; use the audited mark from `hs-logo`), `colors` (2 to 10, each `name`, `hex` like `#1a2b3c`, and a `role`: `text`, `background`, `highlight` or `action`), `fonts` (`display`, `body`, `mono`: names only), `voice` (a few words), `dos` and `donts`.

## What it does

- Lays the tiles out as a bento grid that becomes one column on a phone.
- Labels every colour tile with the text colour that reads best on it and the measured ratio.
- Lists the contrast of every text, highlight or action colour against the background and says which fail 4.5:1.
- Embeds the logo as an image (so a script inside an SVG cannot run), escapes all text, and fetches nothing: fonts are shown by name in a fallback stack, so ship the real font files with the project.

## Rules

- **No invented proof.** The spec refuses `stats`, `quotes` and `customers`: a board must not show numbers, testimonials or client logos unless they are real; if you have real ones, write them into the page yourself with their source.
- Use the real logo and the real palette from the project; do not generate a mark here (that is `hs-logo`, with its tests).
- If the Contrast tile shows a failure, fix the palette (`hs-a11y-review` suggests the nearest passing colour) before sharing the board.
