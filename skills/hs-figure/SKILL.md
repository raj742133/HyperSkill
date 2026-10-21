---
name: hs-figure
description: HyperSkill capability, not a phase - explain a technical or product idea as an interactive isometric figure. Invent a physical machine whose working is the idea, build it from many small solid parts with the bundled zero-dependency kit, drive every number from real data, make it keyboard, screen-reader and reduced-motion safe, and verify it in a real browser. Use for architecture explainers, docs and landing-page visuals, and launch material.
---

# Figure

A figure is a small machine on a bench that behaves like the idea you are explaining. The reader understands because they recognise the machine: a boat that cannot move on until a lock has filled is "a gate that opens only when the evidence is in". Words stay out of the picture apart from a few engraved labels.

This is a **capability**, not a ninth phase. Other phases call it through the `explainer-figure` slot (run `hyperskill.py integrations resolve explainer-figure`). It helps most in three places:

- **plan**: an owner has to be able to explain every box of the architecture (gate `architecture-explained`). A working picture is a better test of that than a diagram of boxes.
- **product**: a landing-page or docs visual that shows how the product works.
- **launch**: promo stills and the "how it works" section. Every number on it must still pass `claims-true`.

## Pick the provider

`hyperskill.py integrations resolve explainer-figure` names who to use:

- `hyperskill-figure` (this skill, built in): isometric SVG, boxes and cylinders, four-tone shading, correct painter's order, a framed card, calm motion, an overlap audit and a browser check. No dependencies. One finished example in `examples/canal/`.
- `anatomy` (third party, MIT, opt-in): a much larger skill with WebGL layers and a 3D mode. Use it when a figure needs shader effects or true 3D. Read its risks with `hyperskill.py integrations list` and enable it with `integrations enable anatomy`.
- Neither available or the idea is just a flow: draw a plain diagram (Mermaid or hand-written SVG). Do not force a machine onto a list.

## The one rule

**The object is the explanation.** Before any geometry, say in one sentence what moves and what that motion means. If you cannot, the figure is not ready to draw.

| Idea | Object |
|---|---|
| Nine gated phases, each needing evidence | A boat climbing nine lock chambers; a chamber fills as checks pass and its gate opens only when full (`examples/canal/`) |
| A cache that skips work when nothing changed | A lock that turns only when every pin matches |
| Requests queuing for a limited resource | A single-lane bridge with a ticket booth |
| A rate limiter | A turnstile that releases one token per tick |

Two ways it goes wrong: **too abstract** (floating slabs and labelled boxes read as nothing) and **too bland** (one big slab, no parts, nothing to discover). The fix for both is a recognisable machine built from many small, purposeful parts.

## Truth first

Every number the figure shows (counts, thresholds, levels, labels) must come from a source file or a measurement, never from the drawing. Write the model as a small pure module that reads the data and keeps the state, test it, and let the drawing only read it. In the example, `model.mjs` reads `skills/hyperskill/gates.json` and a test fails if the figure's numbers drift from it. This is the same rule as the rest of HyperSkill: nothing is claimed without evidence.

## Steps

1. **Decide a figure is the right tool.** For a plain list, a sequence or a table, use text or a normal diagram.
2. **Size it.** *Figure*: one mechanism, 40 to 80 parts. *Hero*: a dense object, 80 to 150 parts. *Epic*: a whole plant with many moving systems. Name the size to the owner; propose a Hero version instead of starting an Epic, and ask before building anything bigger than a Figure.
3. **Model.** Collect the real data, write the pure model and its tests. See `examples/canal/machine.mjs` and `model.mjs`.
4. **Invent the object** and write the one sentence (above). Never copy a reference image: take its finish, not its object.
5. **Parts list.** At least 40 parts, grouped: base (plate, feet, label), structure (posts, rails, walls), mechanism (the thing that moves), controls (knobs, lamps, gauges), fasteners and small details. Every part sits on another part and ends on an edge. Details belong to the mechanism, not decoration.
6. **Build the geometry** with `kit/iso.mjs`: `camera`, `solid`, `cylinder`, `ticks`, `faceText`, `paintOrder`, `viewBoxOf`. World units are about one pixel of the real thing; x and y on the floor, z up. See `references/craft.md`.
7. **Audit.** `auditOverlaps` must report nothing (list the few deliberate fits, such as a gate sliding into its slot, in `allow`). It found a funnel sunk into a cabin and signs that cut through bollards while this skill was being written.
8. **Frame it** with `kit/card.mjs`: `Fig n` top left, a short title top right, the hint bottom left, a live readout bottom right, a plain caption underneath.
9. **Make it live.** Calm time-based motion (`follow`), pointer and keyboard control, an idle tour that plays when nobody touches it, pause when offscreen, a still page under reduced motion. See `examples/canal/client.js`.
10. **Verify in a real browser.** Run the unit tests, `node build.mjs --audit`, then `CHROME_PATH=... node verify.mjs --out shots` (needs Chrome and playwright-core), and look at the screenshots at 1x and zoomed 2x to 4x, in light, dark and at 390px. The `product` gate's `a11y-automated` and `real-device` checks and the designer pass are about the page the figure sits on; put the figure's checks in the evidence.
11. **Record evidence.** Cite the test output, the audit line and the verify output in the gate that asked for the figure (for example `gate plan --pass architecture-explained --evidence "docs/figures/..."`; that item needs the owner to confirm they can explain it, so only they can pass it).

## Accessibility is part of the figure

- A focusable group with an `aria-label` that says what the machine is and how it works, an `<svg role="img">` with the same, a plain caption under it, and a `<noscript>` note. The start picture is drawn into the page at build time, so it shows without JavaScript.
- Keyboard: Space, Enter and one more key do everything a pointer does. A visible focus ring.
- A polite live region that announces **changes of meaning** (a new phase, finished), not every tick.
- `prefers-reduced-motion`: no animation loop, no idle tour, the state is reached at once.
- No inline `style` attributes and a `--split` build (separate `.css` and `.js`) for sites with a strict Content-Security-Policy.
- Text in the drawing is a label, never the only carrier of meaning.

## Pitfalls

- Painter's order cycles: a part that wraps another (a spring around a rod, a frame around a carriage) must be split into a back half and a front half. `paintOrder` falls back to depth order on a cycle, which can look wrong.
- A moving part must be drawn in the slot where it physically sits. Water that is translucent should not be counted as a solid in the audit (`soft: true`).
- Text on a face reads along a direction in world space. On the `+x` face seen from the front, text runs along `-y` and goes down along `-z` (see `faceText`).
- Detail must be true. Do not add ticks, screws or labels that do not mean anything, and do not invent statistics.
- A figure that only works in light mode or only on a wide screen is half finished.

## Files

- `kit/iso.mjs`: camera, boxes, cylinders, ticks, text on a face, painter's order, overlap audit, colour tones, motion helpers. Tests in `kit/iso.test.mjs`.
- `kit/card.mjs`: the frame and the page styles.
- `examples/canal/`: the worked example. `model.mjs` and `machine.mjs` (truth), `scene.mjs` (geometry), `client.js` (behaviour), `build.mjs` (page, `--audit`, `--split`, `--light`, `--dark`), `verify.mjs` (real-browser check), and tests for each.
- `references/craft.md`: the detail: parts lists, shading, camera, text, motion, verification.

Run the tests from this folder: `node --test "kit/*.test.mjs" "examples/canal/*.test.mjs"` (Node 22 or later).

## Where the idea comes from

The idea of explaining a concept as a working, finely made object is taken from the MIT-licensed `wheresryan22/anatomy` skill, which is far larger (WebGL, 3D, eight examples). This kit is a small, separate, original implementation written for HyperSkill: no code or text was copied, and the object, the geometry, the audit and the verification are its own. See `docs/sources.md`.
