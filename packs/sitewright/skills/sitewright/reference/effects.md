# Effects: animated backgrounds, headline animations, micro-interactions

An optional layer on top of any site (animated backgrounds, headline animations, micro-interactions and [line figures](figures.md)). With nothing chosen the site keeps its default look (the dotted hero, a plain headline, a plain number); effects are only switched on when the user asks for one or Claude picks a preset and says so. When on, the generated project carries only the effects that were picked, as plain React + CSS + canvas: no GSAP, Three.js or other animation library.

The idea is the same as component libraries such as React Bits (animated text, backgrounds, small interactive pieces you copy into your own code). Everything here is **original code written for this kit**, not copied from any library, so the kit stays MIT.

## Changing effects later (in place)

Every generated site has the effect slots wired in from the start (the hero, the headline, the sign-in card and the stat numbers import them from `src/components/fx`; a slot set to "none" renders nothing). So switching an effect never needs a regenerate:

```bash
node scripts/scaffold.mjs --apply-effects ./my-site --hero-bg stars --headline typewriter
node scripts/scaffold.mjs --apply-effects ./my-site --preset calm        # a preset replaces the whole set
node scripts/scaffold.mjs --apply-effects ./my-site --preset minimal     # back to the default look
```

It rewrites only the generated effects layer (`src/components/fx/`, except the gallery's `Playground.tsx`), the `data-fx-*` attributes on `<html>` in `src/app/layout.tsx` and the `effects` entry of `src/content/site.json`. Pages, styles and anything else the user edited are never touched. If the user changed files inside `src/components/fx/` by hand, those are replaced. Projects with the `fxgallery` module are refused (the gallery previews every effect at `/effects`).

## Choosing

When the user names an effect, Claude applies exactly that; otherwise Claude picks a fitting preset and says so. List the menu with `node scripts/scaffold.mjs --list-effects`, then either write the `effects` block below or pass the picks straight to the generator:

```bash
node scripts/scaffold.mjs --config site.json --out ./my-site --preset aurora-glass --headline split-words --cards lift --extras cursor-glow,count-up
```

Flags: `--preset`, `--hero-bg`, `--login-bg`, `--headline`, `--rotate-words`, `--buttons`, `--cards`, `--reveal`, `--extras`. They override the same keys in `site.json`. Offer the live gallery if the user cannot decide (`"modules": ["fxgallery"]` generates a `/effects` page that runs every effect on a sample hero, has a brand-colour picker and prints the exact config to paste).

```jsonc
"effects": {
  "preset": "aurora-glass",            // optional shortcut; any key below overrides it
  "heroBackground": "aurora",          // territory (default) | none | aurora | mesh | dots | particles | stars | beams | waves | grid | grain | spotlight
  "loginBackground": "none",           // same list (not territory); shown behind the sign-in card
  "headline": "split-words",           // none | split-chars | split-words | blur-in | typewriter | gradient | shimmer | scramble | rotate
  "rotateWords": ["roasted", "fresh"], // only for headline "rotate" (2-8 words; the accent word is the first)
  "buttons": "glow-border",            // none | magnetic | shine | ripple | glow-border     (acts on .btn.primary)
  "cards": "spotlight",                // none | tilt | spotlight | glow-border | lift      (acts on every card)
  "reveal": "blur",                    // rise (default) | fade | scale | blur | slide      (landing sections as they scroll in)
  "extras": ["cursor-glow", "count-up"] // cursor-glow | scroll-progress | click-spark | count-up
}
```

### Presets

| Preset | Background | Headline | Buttons | Cards | Reveal | Extras |
| --- | --- | --- | --- | --- | --- | --- |
| `minimal` | territory (default) | - | - | - | rise | - |
| `calm` | mesh | blur-in | shine | lift | fade | - |
| `aurora-glass` | aurora | split-words | glow-border | spotlight | blur | cursor-glow |
| `tech-grid` | grid | scramble | shine | spotlight | rise | scroll-progress |
| `playful` | particles | split-chars | ripple | tilt | scale | click-spark |
| `cosmic` | stars | shimmer | glow-border | tilt | fade | cursor-glow, count-up |
| `editorial` | grain | gradient | magnetic | lift | rise | count-up |

## Catalogue

| Slot | Id | What it does | Built with |
| --- | --- | --- | --- |
| background | `aurora` | blurred colour clouds drifting | CSS |
| | `mesh` | slowly shifting gradient mesh | CSS |
| | `dots` | dot grid that swells around the pointer, idle ripple | canvas |
| | `particles` | floating particles with lines; the pointer pulls them together | canvas |
| | `stars` | twinkling starfield with pointer parallax | canvas |
| | `beams` | vertical light beams sweeping down | CSS |
| | `waves` | layered waves along the bottom | SVG + CSS |
| | `grid` | perspective grid moving toward you | CSS |
| | `grain` | gradient washes under animated film grain | CSS |
| | `spotlight` | soft light that follows the pointer | CSS + a few lines of JS |
| headline | `split-chars` | letters rise into place | CSS |
| | `split-words` | words slide up out of a mask | CSS |
| | `blur-in` | words sharpen from a blur | CSS |
| | `typewriter` | letters appear as typed, caret blinks | CSS |
| | `gradient` | accent word flows through brand colours | CSS |
| | `shimmer` | a band of light crosses the headline | CSS |
| | `scramble` | random glyphs resolve left to right | JS |
| | `rotate` | accent word cycles through your list | JS |
| buttons | `magnetic` | button leans toward the pointer | JS |
| | `shine` | glint sweeps across on hover | CSS |
| | `ripple` | ripple from the press point | JS |
| | `glow-border` | light travels around the edge | CSS |
| cards | `tilt` | 3D tilt with moving glare | JS |
| | `spotlight` | light follows the pointer across the card | JS |
| | `glow-border` | light travels around the edge on hover | CSS |
| | `lift` | rises, deeper shadow | CSS |
| reveal | `fade`, `scale`, `blur`, `slide` | how sections enter as you scroll | CSS |
| extras | `cursor-glow` | soft glow trails the pointer | JS |
| | `scroll-progress` | thin bar showing page progress | JS |
| | `click-spark` | sparks where you click | JS (Web Animations) |
| | `count-up` | dashboard stat numbers count up | JS |

## How it is wired

- `effects.mjs` is the registry (ids, labels, descriptions, the files each needs). `lib/fxgen.mjs` writes the layer: the chosen files under `src/components/fx/`, one `fx.css`, an `index.tsx` of slots the pages import (`Headline`, `HeroBackground`, `LoginBackground`, `CountUp`) and a `micro.tsx` that attaches the button/card/extra behaviours once.
- Pages import the slots unconditionally, so a different effect only changes `src/components/fx/`.
- Button and card effects are **attribute-scoped** (`<html data-fx-cards="tilt">`) and act through event delegation on the classes in `CARD_SELECTOR` / `BUTTON_SELECTOR`, so every existing card and primary button gets them without editing each component. Add a class to those lists if you add a new card type.
- Backgrounds sit in `.fx-bg` (absolute, behind content, `aria-hidden`). Headline effects keep the real text: split/typewriter/scramble output a visually-hidden copy for screen readers and hide the animated copy from them.

## Components

Beyond the slots above the kit has a library of 58 importable components (buttons, inputs, cards, loaders, charts...). They are listed in `reference/components.md` and chosen with `effects.components`.

## Figures

Interactive line drawings in named places of the site (a padlock on the sign-in card, a scanner on the connect page, a bar chart in an empty dashboard...): 22 of them, chosen per place or with `figures: "auto"`. Their own page: [`figures.md`](figures.md).

## Rules every effect follows (and the verifier checks)

- **Reduced motion:** `prefers-reduced-motion` shows the final state at once. CSS animations are removed, canvases draw one still frame and never start a loop, JS pointer effects do nothing.
- **Touch screens:** pointer-follow effects (magnetic, tilt, spotlight, cursor glow) are off on `(pointer: coarse)`; nothing sticks in a hover state after a tap.
- **Battery:** canvases pause when scrolled off screen or in a hidden tab, pixel density is capped at 2, particle/star counts scale with area and are lower on phones.
- **Readable:** the aurora carries a veil of the page colour so body text keeps its contrast; headline pieces end fully opaque.
- **No hydration traps:** nothing random is rendered on the server (canvas data is created after mount; beam positions are fixed).
- **Cheap to ship:** only chosen files are copied; the canvas hook is only included when a canvas background is used.

## Adding an effect

1. Add the component/CSS/JS under `templates/fx/` (`bg/`, `text/`, `micro/`, `css/`).
2. Register it in `scripts/effects.mjs` (label, description, `files`, `css`, `micro`).
3. For a background or headline, add its component file name to the maps at the top of `scripts/lib/fxgen.mjs`.
4. Run `scaffold.mjs --config` for `examples/effects.json` and the gallery site, then `verify.mjs` on both. The gallery check mounts every registered effect.
