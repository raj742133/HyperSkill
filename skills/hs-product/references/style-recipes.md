# Visual style recipes

Ten named styles people ask for by name. Each one is a set of choices with a known way to go wrong, so a pick from the dashboard's "Popular visual styles" group comes with these rules. They are HyperSkill's own working notes (not copied from anywhere); the larger, generated catalogue of 88 styles is in the "UI UX Pro Max: visual styles" group.

Read the style you were given, then the **checks** under it. Every style must still pass the same gates as any other design: contrast, focus, reduced motion, phone width, and the designer pass. A style is a look, not an exemption.

Two things apply to all ten:

- **One style per product.** Mixing two (glass cards on a brutalist page) reads as an accident. A style can be the main look and another can appear in one place on purpose (a bento block on a minimalist page), and that choice is written in `docs/decisions/`.
- **Tokens first.** Every colour, radius, shadow and blur is a token declared once. A style is a token set; switching or dialling it back means editing tokens, not components.

## Skeuomorphism

Interfaces that imitate real objects: leather, paper, metal, buttons that look pressable, shadows that agree on one light direction.

- **Use when** the object metaphor is the point: audio and music tools, calculators, journals, games, hardware-like dashboards, anything people hold in their head as a physical thing.
- **Recipe:** one light source (shadows fall the same way everywhere); layered gradients plus an inner highlight for raised surfaces and an inner shadow for pressed ones; real texture as a small tiled image or SVG filter, not a full-screen photo; controls that change state visibly on `:active`.
- **Traps:** image weight (textures as huge PNGs), text on textured backgrounds failing contrast, controls that look physical but behave wrongly (a toggle that does not slide), and a 2010 look from too many bevels.
- **Checks:** text contrast measured on the textured area, not on the flat colour; total image weight of textures under 150 KB; pressed and disabled states exist for every control.

## Neumorphism (soft UI)

Elements that look extruded from or pressed into a surface of the same colour, using a light and a dark shadow.

- **Use when** a calm, tactile control panel is wanted and the surface is large and simple: smart-home controls, music players, a handful of big toggles.
- **Recipe:** the surface and the element share one background colour; two shadows, light up-left and dark down-right, with the same blur; a pressed state swaps to inset shadows; radii are generous; the text and icon colour carries all the contrast.
- **Traps:** this style has the lowest contrast of the ten. Edges that carry meaning (where a button ends) are barely visible, so people miss controls; focus rings are lost against the shadows; it breaks in dark mode unless both shadows are re-derived.
- **Checks:** every interactive element also has a 3:1 non-text contrast edge or an icon or label that carries the meaning; a visible `:focus-visible` ring that is not a shadow; use it for a few large controls, not for forms and tables.

## Glassmorphism

Frosted translucent panels over a colourful or image background.

- **Use when** there is something worth seeing through the glass: a hero image, a gradient, a video, a wallpaper-like backdrop; overlays, sidebars, music or weather widgets.
- **Recipe:** `background: rgb(255 255 255 / .12-.25)`; `backdrop-filter: blur(8px-20px) saturate(1.2)`; a 1px border in a lighter translucent tone; a soft shadow; a solid fallback colour under `@supports not (backdrop-filter: blur(1px))`.
- **Traps:** text over a busy backdrop changes contrast as the backdrop moves; many stacked blurred layers cost real GPU time and drain phones; the style looks like every AI landing page when used by reflex (it is on the "tells" list for that reason).
- **Checks:** contrast measured against the worst part of the backdrop, or a scrim behind the text; no more than two blurred layers visible at once; a solid-colour fallback; the effect respects `prefers-reduced-transparency` where supported.

## Claymorphism

Soft, puffy, toy-like shapes with a thick feel: big radii, inner highlights and a soft outer shadow.

- **Use when** the product is friendly and playful: kids' and education products, onboarding, illustrations-led apps, casual games and finance apps for first-time users.
- **Recipe:** large radii (20px and up); pastel fills; two inner shadows (a light one top-left, a darker one bottom-right) plus one soft outer shadow; chunky type with a rounded face; generous spacing.
- **Traps:** pastel text on pastel fills fails contrast; the heavy shadows are expensive on long lists; it ages quickly if every element is puffy.
- **Checks:** text uses the dark ink token, never a pastel; shadows are limited to the elements that should feel pressable; lists use a flat variant.

## Brutalism (and neo-brutalism)

Raw and deliberate: hard edges, thick black borders, default-looking type, no softness. Neo-brutalism keeps that and adds flat saturated colour and hard offset shadows.

- **Use when** a loud, honest, anti-corporate voice suits the product: creator tools, indie products, portfolios, merch, events, developer tools with attitude.
- **Recipe:** 2-4px solid borders; no blur on shadows, only a hard offset (`6px 6px 0 #000`); a limited flat palette with one or two clashing accents; large type with a heavy grotesque or a mono face; visible grid lines are fine; no gradients.
- **Traps:** ugly by accident instead of by design (inconsistent borders and spacing); focus states forgotten because everything already has a border; walls of high-saturation colour that tire the eyes; hover effects that move the layout.
- **Checks:** one border width and one shadow offset token used everywhere; a focus ring clearly different from the border (outline offset, a second colour); long text stays on a calm surface; hover changes shadow or colour, not size.

## Minimalism

Few elements, plenty of space, strong type, one accent. The Swiss and editorial tradition.

- **Use when** the content is the product: documentation, writing, portfolios, finance and enterprise tools, anything for long sessions.
- **Recipe:** a modular spacing scale; two type sizes doing most of the work; a restrained palette (neutrals plus one accent); real hierarchy from size, weight and space instead of boxes and rules; every element earns its place.
- **Traps:** it is not "nothing": removing affordances makes controls undiscoverable; low-contrast grey text for "elegance"; sameness, where the result looks like every template.
- **Checks:** body text at least 4.5:1; primary action unmistakable; one memorable thing (a type choice, an image, a layout move) that is specific to the product.

## Maximalism

More is more: dense collage, clashing patterns, layered type, stickers, loud colour, deliberate excess.

- **Use when** the brand is the show: music, fashion, festivals, youth and culture products, experimental portfolios.
- **Recipe:** a strong underlying grid so the chaos is composed; two or three dominant colours with accents; type used as image; layered elements at deliberate angles; motion limited to a few hero moments.
- **Traps:** unreadable body text; performance from many large images and animations; a layout that collapses on a phone; motion that cannot be turned off.
- **Checks:** body copy sits on a calm panel; every animation has a reduced-motion variant; the page stays under the performance budget in `hs-product`; the phone layout is designed, not shrunk.

## Liquid Glass

The translucent, light-bending material Apple introduced across its platforms in 2025: panels that refract and tint what is behind them and respond to content.

- **Use when** the product feels native to Apple platforms, or a few floating controls (a tab bar, a toolbar, a player) sit over rich content.
- **Recipe:** use it for the *controls layer* floating above content, not for the content itself; a blur plus a slight saturation lift plus a thin bright edge and a soft specular highlight; adapt tint to the backdrop (light over dark, dark over light); keep shapes concentric and rounded.
- **Traps:** the web can only approximate it (`backdrop-filter`, SVG filters), and real refraction is costly; legibility over moving content; it is on the "tells" list when used on everything.
- **Checks:** at most one glass layer per view; labels stay readable over the worst backdrop; a solid fallback and `prefers-reduced-transparency` support; verified on a mid-range phone.

## Bento Grid

A modular layout of tiles of different sizes, each holding one idea, like a bento box.

- **Use when** the content has parts of genuinely different weight: a product overview with one hero feature and several smaller ones, a dashboard summary, a profile page.
- **Recipe:** CSS grid with a 4- or 6-column track; tiles span 1-3 columns and 1-2 rows from a small set of sizes; one consistent radius and gap; the biggest tile carries the most important thing; `grid-auto-flow: dense` only when order does not matter.
- **Traps:** equal tiles with equal weight (it is then a card grid with extra steps, which is also on the "tells" list); tile order that breaks the reading order for keyboard and screen-reader users; fixed heights that clip text.
- **Checks:** the DOM order is the reading order; the grid collapses to a single column on phones without losing the hierarchy; tiles have no fixed height for text content.

## Spatial UI

Interfaces designed for depth and glanceable, gaze-and-gesture input, as in visionOS: floating panels, layers that separate in z, generous targets.

- **Use when** the product is for an actual spatial device, or you want a restrained version of the idea (depth and floating panels) on a flat screen.
- **Recipe:** a few layers with clear order (background, panel, controls); soft glass panels with large radii; large hit targets (at least 44-48 CSS px, more for gaze); hover and focus feedback that is immediate and generous; depth cues from scale, shadow and parallax kept small.
- **Traps:** parallax and tilt on desktop becoming motion sickness; tiny type on translucent panels; building a spatial look with no spatial input to justify it.
- **Checks:** motion is subtle and can be switched off; targets meet the size above; text sits on a stable panel; the layout holds without the depth effects.

## How these show up in the pipeline

- The pick is passed to Claude with this file named, so the build follows the recipe and the checks.
- The **design-critique** step (the `design-critique` slot) tests the checks above; `design-lint` (Hallmark's linter, when enabled) tests the mechanical ones.
- If the style makes a gate impossible (neumorphism and contrast, for instance), the gate wins: change the style or dial it back, and record the decision.
