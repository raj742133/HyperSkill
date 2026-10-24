# Design system

Two themes share every component, class and token name; they differ in surfaces, shadows, type and radius. Choose with `design.theme` in `site.json` (default `studio`); `scaffold.mjs --check` prints the resolved choice.

| | `studio` (default) | `classic` |
| --- | --- | --- |
| Surfaces | warm paper and ink neutrals that do not take the brand's hue (`brand.colors.neutralHue` shifts the undertone) | pale, cool, tinted by the primary |
| Depth | hairline borders, near-flat; shadow only on the sign-in card | soft brand-tinted shadows |
| Type | display face for headlines (Bricolage Grotesque), Inter body, JetBrains Mono | Montserrat throughout |
| Radius | 18 px | 16 px |
| Logo default | monogram | hex |
| Colour | the brand's two colours are the only colour on the page | brand colours plus tinted washes |

The studio rules are one block, `templates/design/studio.css`, appended to `globals.css` and scoped by `:root[data-design='studio']`. The palette for both themes is `scripts/lib/color.mjs` (`buildPalette({ ..., theme })`). The notes below describe the classic feel, which the studio theme keeps in structure (same components, same tokens).

## Classic (taken from a production field-capture dashboard)

**Feel:** a pale surface, white cards with a soft, brand-tinted shadow, one action colour (`--primary`) and one signal colour (`--signal`), pill buttons and chips,
generous radius (16 px), Montserrat + JetBrains Mono. Motion only explains something; `prefers-reduced-motion` switches all of it off.

## Tokens (CSS custom properties in `globals.css`)

`--surface --raised --raised-2 --ink --muted --line --line-strong --primary --primary-wash --on-primary --signal --signal-wash --signal-ink --ok --critical --critical-wash --corrected --added --unsure --unsure-wash --photo-bg --shadow --shadow-lift --radius --ease --font-body --font-mono`

- Three blocks: light on `:root`; dark under `@media (prefers-color-scheme: dark) { :root:not([data-theme='light']) }`; and `:root[data-theme='dark']`. The header toggle writes `localStorage['<cookie>-theme']`; an inline script in `<head>` applies it before first paint, so there is no flash.
- `scripts/lib/color.mjs` derives all of it from `brand.colors.primary` and `signal`: washes by mixing with the surface, `--on-primary` and `--signal-ink` chosen for WCAG contrast (>= 4.5:1 for text on primary and on the washes), and lighter dark-mode variants of both brand colours. A very light or very dark brand colour is adjusted, not rejected.
- Status colours (`ok`, `critical`, `corrected`, `added`, `unsure`) are fixed semantic colours, not brand colours, so "needs attention" never turns brand-coloured.

## Components (classes)

`header.site` (brand mark + nav from `nav.json` + theme toggle + sign out) · `.card .pad .card-h` · `.btn .primary .ghost .sm .danger .block` · `.chip .chips` · `.stat-grid .stat` · `.rec-grid .rec-card` (record cards) · `.facets` (selects) · `.search` ·
`.login-wrap .login-card` · `.dropzone` · `.version .version-head .badge` · `.codeblock .linkline` · `.table-scroll` · `.err` · `.hint`.
Landing: hero with territory canvas and drawing mark, `Story` (sticky phone mock-up, scroll-driven steps), `Proof` (flip numbers, bar race), `Features`, `Timeline`, `Route`, CTA, `Download` (QR + team code), `Releases`, FAQ, footer.

## Animation

Reveal-on-scroll (IntersectionObserver), number flip, bar growth, the logo path drawing itself then becoming a road, a dotted territory canvas, lenis smooth scroll on the landing page only. All gated by `prefers-reduced-motion`.

## Effects

An optional animated layer (hero backgrounds, headline animations, button/card micro-interactions, reveal styles) sits on top of this design system and reads the same tokens (`--primary`, `--signal`, `--surface`, `--ink`), so every effect follows the brand colours and the light/dark theme. See `effects.md`.

## Responsive rules (every page, verified at 1280 / 390 / 360)

- `viewport: width=device-width, initialScale=1` and `themeColor` per scheme.
- Breakpoints: 900 px (two-column grids collapse), 800 px, 720 px, 640 px (phone layout: header wraps, nav scrolls sideways, stat cards 2-up, record cards 1-up, chips scroll in one row, facets 2-up, forms stack).
- No horizontal page scroll: tables live in `.table-scroll` (scrolls inside its card), long links use `word-break`, code blocks scroll inside themselves.
- `@media (pointer: coarse)`: buttons, chips, selects, text inputs and nav links are at least 44 px tall.
- Fonts load from Google Fonts in the browser (not `next/font`, so an offline build cannot fail); each face has a system fallback.
