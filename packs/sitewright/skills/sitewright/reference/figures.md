# Figures: interactive line drawings in named places

Small isometric drawings that answer the pointer: a padlock whose shackle lifts as you come near, a box that opens as you move up it, a bar chart whose bars climb after the pointer. They are drawn in a single thin stroke, wear the site's own colours (the bright stroke is the brand colour, the rest are tints of the text colour, so they follow light and dark mode), and cost nothing until they are chosen: a site with no figures chosen ships none of their code.

Nineteen of the 22 figures are **[Hairline](https://github.com/lucasmarkes/hairline)** by Lucas Marques, MIT licensed (`templates/fx/figures/LICENSE-hairline.txt` is copied into every project that uses them and must stay). **`bars`, `scanner` and `parcel`** are written for this kit on the same engine, to Hairline's ten rules.

## Just use one in your code

Every generated project has a `Figure` component. Put a figure anywhere in your own pages, by name; nothing to register, no command to run:

```tsx
import { Figure } from '@/components/fx';

<Figure name="padlock" />                 // any of the 22, anywhere
<Figure name="terrain" intensity={0.9} /> // how strongly it answers the pointer, 0 to 1
<Figure name="vault" className="my-hero-art" />
```

The project finds it and brings the figure in by itself: while `npm run dev` runs (a few seconds after you save), before every `npm run build` (the build stops, naming the file and suggesting the right name, if a figure doesn't exist), or on demand with `npm run figures`. Only the figures you use are part of the site; the rest of the library stays in `scripts/lib/figures` and costs nothing. Nothing is removed on its own (`npm run figures -- --prune` drops the unused). The figure is an empty 5:4 box that takes the width you give its parent (`.fx-fig` in `fx.css`), so size it with a wrapper or `className`.

## The site's places

`effects.figures` still puts figures in the places the generator knows (below), and `--apply-effects` changes them; `<Figure name>` is for everything else.

```jsonc
"effects": {
  "figures": "auto",                        // the fitting figure in every place the chosen modules have
  // or choose per place:
  // "figures": { "hero": "terrain", "signin": "padlock", "connect": "phone", "empty": "bars" },
  "figureIntensity": 0.5                    // 0 subtle ... 1 strong
}
```

Command line (same as every other effect), and in place on an existing project:

```bash
node scripts/scaffold.mjs --config site.json --out ./my-site --figures auto
node scripts/scaffold.mjs --apply-effects ./my-site --figures hero=bars          # change one place
node scripts/scaffold.mjs --apply-effects ./my-site --figures hero=none          # remove one
node scripts/scaffold.mjs --apply-effects ./my-site --figures none               # remove them all
node scripts/scaffold.mjs --apply-effects ./my-site --figure-intensity 0.8
```

A place whose module is not in the site is ignored (and listed in `figuresIgnored` / printed by the generator). Nothing is added unless chosen.

## Where they go

| Place | Where it is | Needs | `auto` puts | Why it fits |
| --- | --- | --- | --- | --- |
| `hero` | the landing hero, above the mark the page scrolls out of | `landing` | `exploded` | an app taken apart in layers says "this is a product" |
| `releases` | beside the "what's new" list | `landing` + `publishing` | `parcel` | a box that opens is a download |
| `signin` | top of the shared-password card | `signin` | `padlock` | the obvious one, and it opens as you reach for the field |
| `mfa` | top of every account step | `mfa` | `vault` | a dial and three bolts: a code, then it opens |
| `connect` | beside the "connect a phone" title | `connect` | `scanner` | a code you scan, with a scan line that follows the pointer |
| `empty` | where the records list is empty or a search finds nothing | `dashboard` | `bars` | a chart with nothing to chart yet; it climbs when touched |
| `notfound` | the 404 page | none | `dish` | an aerial looking for a signal |

Other good matches, if the user wants something different: `phone` for connect, `cabinet` or `branches` for the releases list (a rack of builds, a history), `laptop` or `terminal` for a developer tool's hero, `lockers` for a storage or pickup brand, `router` or `patch` for a network product, `keyboard` for an input or typing tool, `turntable` for a product with views, `elevator` for floors or levels, `slow` for logistics, `phosphor` or `riffle` for anything with items and cards.

Rules of thumb: one figure per place, never the same figure twice on a page; keep austere or very dense pages without them (the hero and the sign-in card are the two places most sites can afford); figures sit in the empty parts of a page, they never replace content.

## The figures

| Id | What it is | The pointer |
| --- | --- | --- |
| `terrain` | 81 pillars on a plinth | a wider area rises under it |
| `riffle` | a tray of eight cards | the card under it stands up; the arrow keys walk the cards |
| `exploded` | an app window in four layers | across opens the gap, down picks a layer |
| `phosphor` | a dot matrix playing a loop | paints it; the trail fades like phosphor |
| `slow` | crates on a belt through a gate | hovering slows the clock |
| `turntable` | blocks on a turntable | a flick spins it; it settles on a quarter turn |
| `keyboard` | a sixty-key board | the key under it sinks, its neighbours follow |
| `elevator` | four floors beside a shaft | its height picks the floor the car goes to |
| `phone` | a phone in layers | across opens the gap, down picks a layer |
| `laptop` | a thin laptop | its height sets the lid |
| `terminal` | a terminal with its history | its height scrolls back; the line under it lifts |
| `cabinet` | a rack of twelve blades | its height pulls the nearest ones out |
| `branches` | a commit graph | the commit under it rises, its history follows |
| `vault` | a vault door | turns the dial; on the combination the bolts draw back |
| `lockers` | a bank of twelve lockers | the one under it opens |
| `padlock` | a padlock | the shackle lifts and swings open as it nears |
| `patch` | a patch panel of 24 ports | the cable under it lifts, neighbours lean away |
| `dish` | a parabolic dish on a gimbal | aims it |
| `router` | a router with antennas | each leans toward it |
| `bars` (new) | a bar chart on a plinth | the bar under it climbs to the top gridline, neighbours follow |
| `scanner` (new) | a nine by nine code | sets a scan line; that row stands up |
| `parcel` (new) | a shipping box | its height opens the lid and lifts what is inside |

`intensity` (0 to 1, `figureIntensity` here) is the same idea for every figure: how strongly it answers (a wider rise, a bigger swing, a longer coast).

## Behaviour (all of it comes from the engine and is checked by the verifier)

- The figure is an `img` with a description (Riffle is a focusable group you can walk with the arrow keys), drawn into an empty 5:4 box, so nothing shifts when it appears.
- Under `prefers-reduced-motion` ambient figures hold still and every figure still answers the pointer; on touch, a tap acts as a look and holds for a moment.
- One shared frame loop runs for every figure on the page, sleeps when they are off screen or at rest, and stops when nothing moves.
- Colours come from `--surface`, `--raised`, `--ink`, `--primary` through the six `--hairline-*` properties in `fx.css`, so a re-themed site re-themes its figures.

## How it is wired

`src/components/fx/figures/config.json` holds the places, the figure chosen for each and the names used in code; `npm run figures` rewrites `Slots.tsx` from it and from what your code uses.


`src/components/fx/figures/` holds the engine (`core/`, `mount.ts`), only the chosen figures (`engines/`, `factories/`) and `Slots.tsx`. Pages render `<Figure place="signin" />` from `@/components/fx`; every site has these in place from the start (a place with no figure renders nothing), so `--apply-effects` swaps figures by rewriting this folder alone. Change which figure a place shows by editing the `CHOSEN` line in `Slots.tsx` by hand if you prefer.

## Adding a figure of your own

1. Draw it with Hairline's `hairline-create` skill (an idea in, a single HTML file out) or write it directly: a `mount({ stage, svg, read }, value)` in `templates/fx/figures/engines/<id>.ts` on `core/` (look at `bars.ts`, `scanner.ts`, `parcel.ts`: each under 130 lines), following the ten rules (no words in the drawing, the stroke is the only highlight, a designed rest pose, hit tests on the rest pose, everything inside `register`).
2. Add `templates/fx/figures/factories/<id>.ts` (copy a sibling: it names the figure, its accessible label and its rest caption) and a line in `templates/fx/figures/intensity.ts` (`FigureId` and `TABLE`: the figure's own number at intensity 0, 0.5 and 1).
3. Register it in `FIGURES` in `scripts/effects.mjs` (label, description) and, if it should be a place's suggestion, in `PLACES`.
4. Scaffold the gallery example and a site that uses it, run `verify.mjs` on both (the gallery check draws every registered figure; the figures check drives every place).
