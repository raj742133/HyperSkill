# Components

Small interactive pieces you import by name from `@/components/fx/ui`: buttons, inputs, cards, loaders, text, backgrounds, motion helpers and charts. Like the effects they are original, dependency-free code (React, CSS and inline SVG only - no animation or chart library), they respect `prefers-reduced-motion`, work with touch and keyboard, and are only copied into a project when chosen. Their ideas come from [Kitchen](https://www.dqnamo.com/kitchen), [Kokonut UI](https://kokonutui.com), [Anime.js](https://animejs.com), [Motion](https://motion.dev) and [Bklit](https://bklit.com); the code is written for this kit and none of it is copied from them.

## Choosing

- In `site.json`: `"effects": { "components": "all" }` or `{ "components": ["hold-to-confirm", "ring-chart"] }`.
- Or on the command line: `--components all` / `--components hold-to-confirm,ring-chart` (with `--apply-effects` to change an existing project in place).
- Then `import { HoldToConfirm } from '@/components/fx/ui';`. Every component has defaults, so `<HoldToConfirm />` renders; each file also exports a `Demo` you can read as an example. The `/effects` gallery (the fxgallery module) shows all of them live.

When building a site, prefer these over hand-rolling the same thing: `hold-to-confirm` for any destructive button, `dynamic-button` for save/submit, the charts for the dashboard, `invite-code` for invites, `stagger-grid` / `line-draw` for landing sections.

## Motion

| id | what it does | use it for | idea from |
|---|---|---|---|
| `stagger-grid` | A grid of cells that ripple in from any origin with a distance-based stagger; click a cell to replay from there. | landing hero decoration, empty states, loading reveals | Anime.js |
| `shape-morph` | Morphs between circle, star and heart by interpolating normalised point lists, on click or auto-cycle. | landing hero, success states, icon toggles | Anime.js |
| `motion-path` | An element follows an SVG path with tangent rotation, a fading trail and a scrub slider. | progress journeys, publishing status, landing illustrations | Anime.js |
| `scroll-timeline` | A four-step sequence (title, bar, counter, icon) driven by scroll position inside a scroll container. | landing feature storytelling, stats sections, onboarding | Anime.js |
| `timeline-sequence` | A mini timeline orchestrator with play, pause, restart and scrub controls; accepts custom steps. | animated explainers, onboarding walkthroughs, dashboard intros | Anime.js |
| `receipt-printer` | A checkout success state where a slot prints a paper receipt line by line, ending in a torn edge. | Order or payment confirmation, invoice paid, booking complete. | Kitchen |
| `animated-signature` | An SVG signature that draws itself on mount and replays on click or Enter. | Footers, about pages, letters, agreement and thank-you screens. | Kitchen |
| `spring-playground` | Three sliders (stiffness, damping, mass) drive a live spring on a ball and a plotted response curve, with presets and the settle time. | landing page feature explainer, docs or about page showing how the motion feels | Motion |
| `scroll-linked` | A scroll-progress bar, a parallax layer and a percentage readout that follow the scroll position of a scrollable stage. | long-form landing sections, changelog or terms panel, reading progress inside a card | Motion |
| `presence-list` | A list where added items animate in, removed items animate out before unmounting and the others slide into place; changes are announced. | dashboard task or notification list, publishing queue, settings lists | Motion |
| `drag-reorder` | A vertically reorderable list: drag by a handle while the others spring out of the way, or pick up with Space and move with the arrow keys. | dashboard priorities, publishing list ordering, onboarding checklist | Motion |

## Media

| id | what it does | use it for | idea from |
|---|---|---|---|
| `line-draw` | Draws SVG paths with a stroke-dashoffset animation when scrolled into view, with replay. | landing illustrations, onboarding, empty states | Anime.js |
| `cassette-player` | A compact cassette with turning reels, play/pause, a seek bar and title/artist; visual only, no audio. | Podcast or music teasers on landing pages, a playful media card on a dashboard. | Kitchen |

## Cards

| id | what it does | use it for | idea from |
|---|---|---|---|
| `draggable-spring` | Drag, flick and throw a card with momentum, edge bounce and optional snap grid; arrow keys nudge. | playful dashboard widgets, landing page toys, kanban-style pickers | Anime.js |
| `playing-cards` | A composable playing card (rank, suit, face-down) and a fanned hand you thumb through with hover or arrow keys and play with a click. | Playful feature cards, game or loyalty-card landing sections, card-style selection. | Kitchen |
| `perforated-ticket` | A ticket silhouette with notched sides and a perforated divider; header, body and stub sections, with a subtle pointer parallax. | Release notes, invites, order confirmations, event passes. | Kitchen |
| `stamp` | A scalloped postage-stamp frame around any content, with an optional postmark overlay. | Framing an avatar, badge or image; sent/verified states; landing decoration. | Kitchen |
| `scroll-fade-list` | A compact scrollable list whose top and bottom edges fade only while more content lies in that direction. | Activity feeds, notification panels, dashboard side lists. | Kitchen |
| `layout-gallery` | A grid of cards where the clicked card expands into a detail panel with a FLIP shared-element animation; Esc closes and focus returns. | landing page features, portfolio or project list, publishing list with detail view | Motion |
| `gesture-card` | A card with hover lift, press-down scale (pointer or Space/Enter) and drag with momentum that coasts inside its boundary and settles on a spring. | landing page hero decoration, playful dashboard tile, connect page | Motion |

## Charts

| id | what it does | use it for | idea from |
|---|---|---|---|
| `area-chart` | Smooth gradient area chart with axis ticks, a hover and keyboard crosshair with tooltip, and an optional stacked multi-series mode. | Traffic or growth over time on a dashboard or landing page. | Bklit |
| `bar-chart` | Vertical grouped or stacked bars with rounded tops, value labels on focus, and a horizontal option. | Comparing categories: sales by channel, tasks by status (dashboard, report). | Bklit |
| `line-chart` | Multi-series monotone line chart whose legend buttons toggle series, with a crosshair tooltip. | Trends of several metrics side by side on a dashboard. | Bklit |
| `live-line-chart` | Streaming line that appends a point every second in a sliding window, with a pause button; it pauses off-screen and in hidden tabs. | Live status panels: requests per second, queue depth, active visitors. | Bklit |
| `profit-loss-line` | Line around a zero baseline with green fill above and red below, split by a clip path, and signed values in the tooltip. | Finance dashboards: monthly net result, margin, cash flow. | Bklit |
| `composed-chart` | Columns and a line in one chart, each on its own labelled y axis (revenue and conversion rate). | Two metrics with different units: revenue vs conversion, volume vs rate. | Bklit |
| `scatter-chart` | Scatter or bubble chart with group colours and marker shapes, nice axis ticks and a nearest-point tooltip. | Correlations and distributions: usage vs account size, price vs rating. | Bklit |
| `candlestick-chart` | OHLC candles (hollow when up, filled when down) with wicks, optional volume bars and an O/H/L/C tooltip. | Prices over time: markets, stock levels, any open/high/low/close series. | Bklit |
| `pie-chart` | Pie or donut chart whose segments pull out on hover or focus, with a centre label, legend and optional leader-line labels. | dashboard revenue or traffic share, landing-page stats, publishing list breakdowns | Bklit |
| `ring-chart` | Concentric progress rings, one per category, with a centre total that animate in once. | dashboard usage by category, storage or quota overview, connect page limits | Bklit |
| `radar-chart` | Spider chart with up to three series polygons, grid rings and focusable vertices with tooltips. | comparison pages, skill or product profiles, dashboard scorecards | Bklit |
| `funnel-chart` | Conversion funnel of trapezoid stages with step percentages and drop-off between stages. | dashboard conversion analytics, sign-up flow reports, landing-page proof | Bklit |
| `gauge-chart` | Semicircle meter with low/ok/high colour bands, animated needle, target tick and a big readout. | dashboard health or capacity indicators, uptime and quota readouts | Bklit |
| `heatmap-chart` | Calendar or matrix heatmap on a sequential brand-tint scale with legend, tooltip and arrow-key grid navigation. | dashboard activity calendar, busiest hours matrix, publishing cadence | Bklit |
| `sankey-chart` | Flow diagram with proportional link widths between node columns; hovering or focusing a node highlights its flows. | dashboard traffic or funds flow, onboarding paths, order pipelines | Bklit |
| `tile-map-chart` | Tile-grid cartogram of the US states coloured by value, with legend, tooltips and keyboard grid navigation. | dashboard regional breakdowns, store or customer locator summaries | Bklit |
| `activity-rings` | Three concentric progress rings that fill on mount, with a legend of values and a Replay button. | dashboard summary card, goals or usage progress, onboarding checklist | Kokonut UI |
| `activity-terrain` | A small isometric terrain of bars (like a contribution grid) that you drag sideways or arrow-key to rotate, with a tooltip on hover and focus. | Dashboard activity overview, a profile page, or a publishing-frequency panel. | Kokonut UI |
| `liquid-gauge` | A circle or tank gauge filled with two animated waves at the value; drag sideways to slosh the liquid. Exposed as role=meter. | Storage, quota or progress on a dashboard or connect page. | Kokonut UI |

## Buttons

| id | what it does | use it for | idea from |
|---|---|---|---|
| `tactile-button` | A physical-feeling button with a shaped face on a firm edge that presses down on pointer or Space/Enter and springs back. | Primary and secondary calls to action on landing pages, sign-in and checkout. | Kitchen |
| `hold-to-confirm` | A button that fills while held (pointer or Space/Enter), confirms at 100%, then offers a timed Undo before finalising. | Destructive or irreversible actions: delete a project, revoke a key, unpublish a page. | Kitchen |
| `dynamic-button` | A button whose width animates as its label moves through states (Save, Saving…, Saved) with an inline icon swap. | Save and submit buttons in settings forms, sign-in and publishing flows. | Kitchen |
| `tear-button` | A confirm button with a perforated stub: drag it off or press Space on it to confirm, then Reset. | sign-in confirmation, publish or delete confirmation, checkout, landing call to action | Kokonut UI |
| `bell-button` | A button whose bell icon swings with a damped ring and a badge count when clicked (visual only, no sound). | dashboard header, notifications entry, subscribe or remind-me button | Kokonut UI |
| `pull-cord` | A hanging cord with a handle: drag it down past a threshold and release (or press Enter/Space) to toggle; the cord stretches and swings back. | A theme or lamp switch in a header or landing hero, or any on/off setting with some character. | Kokonut UI |

## Text

| id | what it does | use it for | idea from |
|---|---|---|---|
| `scramble-text` | Text whose changed characters scramble through random glyphs and settle left to right; screen readers get the real text. | Hero taglines, rotating status lines, dashboard headings that change. | Kitchen |
| `plucked-text` | Text with a string under it: hover, drag or press Enter on the string and it vibrates while the letters ripple along. | A playful headline on a landing page, an empty state or a 404 page. | Kokonut UI |

## Inputs

| id | what it does | use it for | idea from |
|---|---|---|---|
| `magnetic-drop-zone` | A file drop target that leans toward an incoming drag, lists the dropped file names, and falls back to a browse input. | Upload areas on a dashboard, connect page or publishing list (no upload is performed by the component). | Kitchen |
| `model-selector` | A keyboard-navigable grouped listbox with metric bars; the selected item reveals a segmented configuration row. | Plan or tier pickers, settings pages, any choice that carries extra options. | Kitchen |
| `invite-code` | An invite or token field with a scrambling Regenerate button and a Copy button with confirmation. | Team invites, API tokens, share links on dashboard and connect pages. | Kitchen |
| `spring-toggle` | A role=switch whose thumb moves and squishes with spring physics, plus a spring-driven checkbox variant. | dashboard settings, sign-in remember-me, connect page options | Motion |
| `ai-input` | A text field with a slash-command menu (listbox), file drop and attach chips, submitting text, files and command together. | dashboard composer, support or feedback box, publishing notes, search with commands | Kokonut UI |
| `detent-dial` | A rotary dial with detents you can drag, flick (it coasts and snaps with a small overshoot), or set with arrow keys and the wheel. | settings page, level or quality picker, dashboard control | Kokonut UI |
| `wheel-picker` | An iOS-style 3D wheel for choosing one value: drag or flick with inertia, mouse wheel, arrow keys and typeahead, snaps to a row. | Pick a time, day, plan or quantity in a booking form, settings page or dashboard filter. | Kokonut UI |

## Loaders

| id | what it does | use it for | idea from |
|---|---|---|---|
| `logo-trace-loader` | Traces a mark's outline and resolves into the filled mark; loops or runs once. | Page and route loading states, splash screens, empty states. | Kitchen |
| `ai-state-loading` | A list of steps that move from pending to active to done with a spinner and check, driven by props or autoplay. | publishing list, long-running job, connect page, import or build progress | Kokonut UI |

## Backgrounds

| id | what it does | use it for | idea from |
|---|---|---|---|
| `iridescent-foil` | A holographic foil frame that shifts with scroll and pointer position around an opaque content surface. | Premium plan cards, membership passes, feature callouts on landing pages. | Kitchen |
| `drape-background` | A cloth-like backdrop of soft folds that the pointer sweeps through or you grab and drag, then springs back; static folds on touch and reduced motion. | Behind a landing hero or sign-in panel (put it first inside a position:relative section). | Kokonut UI |

