# Video style presets

Pick **one** per video. Each is a spec to append to the brief. Fonts are loaded from local files in `fonts/`; confirm each font's licence (open fonts are typically under the SIL OFL).

## Kinetic Type
- Text is the whole video: no cards or boxes. Huge all-caps heavy display face (e.g. Archivo Black); the key word fills most of the width.
- Black background, white text, one accent (e.g. lime `#c6ff3d`) on the most important word per screen.
- Words slam in one by one, 0.25-0.4 s, strong ease-out (power4.out). Mix slide-from-side, squash-to-full-height, letter split and rejoin. Screens exit fast; cut on the rhythm of the words.

## Liquid Glass
- Frosted cards: white ~80%, ~30px backdrop blur, thin white border, ~32px radius, soft shadow.
- Soft light gradient background with 2-3 slowly drifting blurred blobs (pale blue, lilac, peach).
- Inter (bold headings, regular small text); dark grey text; small uppercase grey labels over headings; green accent only for ticks/checks.
- Calm: cards rise ~30px and fade in over ~0.6 s with ease-out, scaling up from 0.96; text arrives piece by piece; nothing bounces.

## Editorial Grain
- Reads as a printed magazine page: warm paper background (`#efe8dc`) with animated film grain (~12% SVG noise).
- Serif display face (e.g. Instrument Serif) mixing upright and italic; small uppercase letter-spaced sans labels.
- Ink black plus one deep red accent (`#c2412d`); slightly rotated cut-out paper rectangles behind key words; thin rules; page numbers in corners.
- Unhurried, slightly imperfect staggers; gentle slides and wipes; no bounces.

## Pop Bold
- Loud, flat, playful: no gradients or glass. Chunky grotesque (e.g. Bricolage Grotesque ExtraBold).
- Flat blocks of lime, purple, pink and near-black, 4px black outlines, hard 8px offset shadows (no blur).
- Rotating star/circle stickers, arrows, simple CSS shapes.
- Bouncy: overshoot (back.out ~2.5), wobble, squash and stretch; stickers spin continuously.

## Custom brand
Provide: background, surface, text and accent hex values; heading and body fonts (local files); corner radius; motion personality (calm / snappy / bouncy). Write it as a style block like the above and keep it in `launch/style.md`.
