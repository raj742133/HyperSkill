# What each test on the sheet is looking for

| Block | It catches | A fail looks like |
|---|---|---|
| Size ladder | Detail that needs room | Counters fill in, thin strokes vanish, two shapes merge into one at 32 px or 16 px |
| One colour (black) | A mark that is only its colour or its inner detail | A solid blob, or two shapes that were only separated by colour |
| Reversed (white on black) | Marks drawn for a light page only | Holes that were white now show the dark page and change the shape |
| Greyscale | Marks that depend on hue to read | Two parts of different hue become the same grey |
| On backgrounds | Low contrast, colour clashes | The mark disappears on yellow, mid grey or its own brand colour |
| Blur (squint) | A missing silhouette | After blur it is a smudge instead of a shape; the idea is in the detail, not the form |
| Mirror, upside down | Accidents and imbalance | It reads as another letter, a rude shape, or loses its balance |
| Browser tab, app icon, round avatar | Real use | Cropped corners, a tab icon you cannot identify, a round crop that cuts the mark |

Fixes, in order of preference: remove detail; thicken strokes; open counters; simplify the silhouette; make a separate small-size drawing (a "favicon source") rather than shrinking the big one.

Audit warnings, and what to do about them:

- `live-text`: convert to outlines before delivery; keep the typeface name and licence in `docs/brand.md`.
- `many-colours`, `gradient`, `effects`, `opacity`: pick the one to three solid colours that carry the identity; make the one-colour version first.
- `off-centre`, `small`, `no-margin`: centre the visual weight, not only the bounding box; give it the same margin on all sides.
- `thin-stroke`: a stroke under about 2% of the canvas disappears at 16 px.
- `complex`: this is an illustration; a logo can be drawn from memory.
