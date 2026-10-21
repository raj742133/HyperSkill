# Figure craft

Detail for `SKILL.md`. Everything here is about `kit/iso.mjs` and `kit/card.mjs`.

## World and camera

- Units are about 1 px of the real thing. x and y are on the floor, z is up.
- `camera({ az, el, scale, ox, oy })`. `az` 45 is the usual view (the +x and +y sides face you); 35 to 60 shows a long side better. `el` 30 is the usual height; use more to look into something.
- Nearer the viewer means larger `depth`. `cam.facing(nx, ny)` above 0 means a side faces you. A box draws its top and the one or two sides that face you.
- `viewBoxOf(cam, parts, pad)` fits the drawing. To keep the box stable while things move, fit it over the empty state and the finished state together, as `fitBox` does in the example.
- The picture is a diagonal band when a row of things runs along an axis; the empty corners are normal. Put the row along -y so it climbs up and to the right.

## Parts

- `solid(id, x, y, z, w, d, h, color, extras)` is an axis-aligned box. `cylinder(id, cx, cy, z, r, h, color)` is a vertical cylinder, drawn as a body, a shade strip and a top ellipse of height `r * sin(el)`.
- Extras: `opacity` (glass, water), `soft: true` (excluded from the overlap audit), `line` (edge width), `overlay(cam)` (extra SVG drawn right after the part, used for text on a sign).
- Give every part a unique `id`. It becomes `data-id` on the SVG group, so tests and a debugger can find it.
- Parts that stand on another part should touch it exactly (a post's bottom at the plate's top), not overlap.

## Shading

`tones(base)` gives four tones from one colour: a lit top (22% toward white), the +x side (the base), the +y side (20% toward black) and an edge line (45% toward black). Use two or three base colours per figure plus one accent. The accent marks the thing that moves.

## Painter's order

`paintOrder(parts, cam)` sorts boxes back to front using the exact rule for axis-aligned boxes: if one lies wholly on the far side of another along x, along y, or below it, it is drawn first. Cycles fall back to depth order. The rule needs non-overlapping boxes, which is why the audit matters. Split anything that wraps another part.

## Audit

`auditOverlaps(parts, { allow })` lists boxes that share volume above a tolerance. `allow` takes `"idA|idB"` strings for deliberate fits (a gate sliding into a slot). Mark water, glass and light `soft`. Run it for the empty state, a middle state and the finished state, because moving parts change what touches.

## Text in the drawing

`faceText(cam, { text, origin, u, v, size })` lays text on a plane. `u` is the direction the text reads along, `v` the direction down the letters, both as world-space vectors. At 45 degrees, the +x face reads along -y with `v = [0, 0, -1]`. Keep it to a few engraved labels. If a reader needs the words to understand, the object is wrong.

## Motion

- `follow(current, target, dt, rate)` is frame-rate independent exponential easing. Rates of 2 to 4 per second feel calm.
- Redraw only while something is moving; stop the loop when everything has settled.
- Pause when offscreen (IntersectionObserver) and when the tab is hidden.
- An idle tour starts after a few seconds without interaction and stops on the first touch.
- Under reduced motion, call the step function with `instant = true`: no loop, no tour, the picture jumps to the final state.

## Card and page

`cardHtml` and `cardCss` follow the HyperSkill design tokens (`docs/design-system.md`) in light and dark. System fonts only, so the page makes no request. The drawing lives in `<g id="fig-scene">` so a script can redraw it. Keep the start state drawn into the HTML at build time.

## Checklist before saying it is done

1. Unit tests, `node build.mjs --audit` and `verify.mjs` all pass.
2. Screenshots looked at, not just generated: 1x, zoomed 2x to 4x over the parts that matter, light, dark, 390px.
3. Every number on the page can be traced to a file or a measurement.
4. Reduced motion, keyboard and the no-script start picture checked.
5. Nothing loads from elsewhere.
