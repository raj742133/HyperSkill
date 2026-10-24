// The effects catalogue: animated hero backgrounds, headline text animations, button and card micro-interactions, scroll-reveal
// styles and a few extras. Every one is original, dependency-free code under templates/fx/ (no GSAP, Three.js or OGL), so a
// generated site only carries the effects it picked.
//
// Slots (one choice each):  heroBackground, loginBackground, headline, buttons, cards, reveal.   extras: any number.
// Figures: interactive isometric line drawings (Hairline, MIT, vendored in templates/fx/figures, plus three of our own) placed in named
// PLACES of the generated site: the landing hero, the sign-in cards, the connect page, empty states, the releases list, the 404 page.
// `files` are copied from templates/fx/ to src/components/fx/; `css` snippets are concatenated into src/components/fx/fx.css.

import { UI, resolveComponents, uiMenu } from './ui.mjs';

export const BACKGROUNDS = {
  aurora:    { label: 'Aurora',        desc: 'Soft blurred colour clouds drifting slowly. Pure CSS.',                         files: ['bg/Aurora.tsx'],    css: ['bg-aurora'] },
  mesh:      { label: 'Gradient mesh', desc: 'A slowly shifting mesh of brand-coloured gradients. Pure CSS.',                 files: ['bg/Mesh.tsx'],      css: ['bg-mesh'] },
  dots:      { label: 'Dot grid',      desc: 'A grid of dots that swell and glow around the pointer, with an idle ripple.',   files: ['bg/Dots.tsx'],      css: [], canvas: true },
  particles: { label: 'Particles',     desc: 'Floating particles joined by faint lines; the pointer pulls them together.',    files: ['bg/Particles.tsx'], css: [], canvas: true },
  stars:     { label: 'Starfield',     desc: 'Twinkling stars drifting with a little pointer parallax.',                      files: ['bg/Stars.tsx'],     css: [], canvas: true },
  beams:     { label: 'Light beams',   desc: 'Vertical beams of light sweeping down the hero. Pure CSS.',                     files: ['bg/Beams.tsx'],     css: ['bg-beams'] },
  waves:     { label: 'Waves',         desc: 'Layered waves rolling along the bottom edge. Pure SVG + CSS.',                  files: ['bg/Waves.tsx'],     css: ['bg-waves'] },
  grid:      { label: 'Perspective grid', desc: 'A grid receding to the horizon and moving toward you. Pure CSS.',            files: ['bg/Grid.tsx'],      css: ['bg-grid'] },
  grain:     { label: 'Grain gradient', desc: 'Soft gradient washes under animated film grain. Pure CSS.',                    files: ['bg/Grain.tsx'],     css: ['bg-grain'] },
  spotlight: { label: 'Spotlight',     desc: 'A soft light that follows the pointer (rests top-right on touch screens).',     files: ['bg/Spotlight.tsx'], css: ['bg-spotlight'] },
};

export const HEADLINES = {
  'split-chars': { label: 'Split letters', desc: 'Letters rise into place one after another.',                          files: ['text/split.tsx', 'text/SplitChars.tsx'],  css: ['text-split'] },
  'split-words': { label: 'Split words',   desc: 'Words slide up out of a mask.',                                       files: ['text/split.tsx', 'text/SplitWords.tsx'],  css: ['text-split'] },
  'blur-in':     { label: 'Blur in',       desc: 'Words sharpen from a soft blur.',                                     files: ['text/split.tsx', 'text/BlurIn.tsx'],      css: ['text-split'] },
  typewriter:    { label: 'Typewriter',    desc: 'Letters appear as if typed, with a blinking caret.',                  files: ['text/split.tsx', 'text/Typewriter.tsx'],  css: ['text-split'] },
  gradient:      { label: 'Gradient accent', desc: 'The accent word flows through the brand colours.',                  files: ['text/split.tsx', 'text/Gradient.tsx'],    css: ['text-split'] },
  shimmer:       { label: 'Shimmer',       desc: 'A band of light sweeps across the whole headline.',                   files: ['text/split.tsx', 'text/Shimmer.tsx'],     css: ['text-split'] },
  scramble:      { label: 'Decode',        desc: 'Random glyphs resolve into the headline, left to right.',             files: ['text/split.tsx', 'text/Scramble.tsx'],    css: ['text-split'] },
  rotate:        { label: 'Rotating word', desc: 'The accent word cycles through a list you give (effects.rotateWords).', files: ['text/split.tsx', 'text/Rotate.tsx'],     css: ['text-split'] },
};

export const BUTTONS = {
  magnetic:     { label: 'Magnetic',    desc: 'Buttons lean toward the pointer. Fine pointers only.', micro: ['magnetic'], css: ['buttons'] },
  shine:        { label: 'Shine',       desc: 'A glint sweeps across on hover. Pure CSS.',            micro: [],           css: ['buttons'] },
  ripple:       { label: 'Ripple',      desc: 'A ripple spreads from the press point.',               micro: ['ripple'],   css: ['buttons'] },
  'glow-border': { label: 'Glow border', desc: 'A light travels around the button edge. Pure CSS.',    micro: [],           css: ['buttons'] },
};

export const CARDS = {
  tilt:         { label: 'Tilt',         desc: '3D tilt toward the pointer with a moving glare. Fine pointers only.', micro: ['tilt'],      css: ['cards'] },
  spotlight:    { label: 'Spotlight',    desc: 'A soft light follows the pointer across the card.',                   micro: ['spotlight'], css: ['cards'] },
  'glow-border': { label: 'Glow border',  desc: 'A light travels around the card edge on hover. Pure CSS.',            micro: [],            css: ['cards'] },
  lift:         { label: 'Lift',         desc: 'The card rises and its shadow deepens. Pure CSS.',                    micro: [],            css: ['cards'] },
};

export const REVEALS = {
  rise:  { label: 'Rise',  desc: 'Fade up a little (the default).', css: [] },
  fade:  { label: 'Fade',  desc: 'Fade only, no movement.',         css: ['reveal'] },
  scale: { label: 'Scale', desc: 'Grow slightly into place.',       css: ['reveal'] },
  blur:  { label: 'Blur',  desc: 'Sharpen from a blur.',            css: ['reveal'] },
  slide: { label: 'Slide', desc: 'Slide in from the left.',         css: ['reveal'] },
};

export const EXTRAS = {
  'cursor-glow':     { label: 'Cursor glow',     desc: 'A soft glow follows the pointer across the page. Fine pointers only.', micro: ['cursorGlow'],     css: ['extras'] },
  'scroll-progress': { label: 'Scroll progress', desc: 'A thin brand-coloured bar shows how far down the page you are.',        micro: ['scrollProgress'], css: ['extras'] },
  'click-spark':     { label: 'Click sparks',    desc: 'A small burst of sparks where you click.',                              micro: ['clickSpark'],     css: ['extras'] },
  'count-up':        { label: 'Count-up numbers', desc: 'Dashboard stat numbers count up when they appear.',                    micro: [],                 css: ['extras'], files: ['CountUp.tsx'] },
};


// ---- figures ---------------------------------------------------------------------------------------------------------------
// Isometric line figures that answer the pointer. The engine and 19 figures are Hairline (github.com/lucasmarkes/hairline, MIT,
// (c) 2026 Lucas Marques; the licence travels with the files); bars, scanner and parcel are written for this kit on the same engine.
const fig = (label, desc, extra = []) => ({ label, desc, files: [], extra });
export const FIGURES = {
  terrain:   fig('Terrain',   'Eighty-one pillars on a plinth that rise around the pointer.'),
  riffle:    fig('Riffle',    'A tray of eight cards; the card under the pointer stands up. Keyboard operable.', ['riffle-geometry']),
  exploded:  fig('Exploded',  'An app window in four layers; moving across opens the gap.'),
  phosphor:  fig('Phosphor',  'A dot matrix that plays a loop and fades like phosphor where the pointer paints it.'),
  slow:      fig('Slow',      'Crates riding a belt through a gate; hovering slows the clock.'),
  turntable: fig('Turntable', 'Blocks on a turntable; a flick spins it and it settles on a quarter turn.', ['turntable-geometry']),
  keyboard:  fig('Keyboard',  'A sixty-key board; the key under the pointer sinks and its neighbours follow.'),
  elevator:  fig('Elevator',  'Four floors beside an open shaft; the pointer picks the floor the car travels to.'),
  phone:     fig('Phone',     'A phone in layers: glass, board, battery, shell.'),
  laptop:    fig('Laptop',    'A thin laptop; the pointer\'s height sets the lid.'),
  terminal:  fig('Terminal',  'A terminal window with its history in rows; the line under the pointer lifts.'),
  cabinet:   fig('Cabinet',   'A rack of twelve blades; the pointer pulls the nearest ones out.'),
  branches:  fig('Branches',  'A commit graph with a branch forking off and merging back.'),
  vault:     fig('Vault',     'A vault door with a dial and three bolts; the pointer turns the dial.'),
  lockers:   fig('Lockers',   'A bank of twelve lockers; the one under the pointer opens.'),
  padlock:   fig('Padlock',   'A padlock whose shackle lifts and swings open as the pointer comes near.'),
  patch:     fig('Patch panel', 'Twenty-four ports with cables; the cable under the pointer lifts.'),
  dish:      fig('Dish',      'A parabolic dish on a gimbal that follows the pointer.'),
  router:    fig('Router',    'A router whose antennas lean toward the pointer.'),
  bars:      fig('Bars',      'A bar chart on a plinth; the bar under the pointer climbs and its neighbours follow. (New in Sitewright.)'),
  scanner:   fig('Scanner',   'A code on a plinth; the pointer sets a scan line and that row stands up. (New in Sitewright.)'),
  parcel:    fig('Parcel',    'A shipping box; the pointer\'s height opens the lid and lifts what is inside. (New in Sitewright.)'),
};
for (const [id, f] of Object.entries(FIGURES)) f.files = [`figures/factories/${id}.ts`, `figures/engines/${id}.ts`, ...f.extra.map((e) => `figures/engines/${e}.ts`)];

/** What every figure shares: the core, the mount and the licence. */
export const FIGURE_COMMON = ['figures/core/iso.ts', 'figures/core/motion.ts', 'figures/core/stage.ts', 'figures/core/styles.ts', 'figures/mount.ts', 'figures/intensity.ts', 'figures/LICENSE-hairline.txt'];

/** Where a figure can go. `needs` are the modules the place lives in; `suggest` is what `figures: "auto"` puts there. */
export const PLACES = {
  hero:     { label: 'Landing hero',      needs: ['landing'],              suggest: 'exploded', desc: 'Beside the headline, above the mark the page scrolls out of.' },
  releases: { label: 'Releases list',     needs: ['landing', 'publishing'], suggest: 'parcel',   desc: 'Next to the "what\'s new" list on the home page.' },
  signin:   { label: 'Sign-in card',      needs: ['signin'],               suggest: 'padlock',  desc: 'On top of the shared-password sign-in card.' },
  mfa:      { label: 'Account sign-in',   needs: ['mfa'],                  suggest: 'vault',    desc: 'On every account step: password, code, set-up, invite.' },
  connect:  { label: 'Connect page',      needs: ['connect'],              suggest: 'scanner',  desc: 'In the header of the "connect a phone" page.' },
  empty:    { label: 'Empty states',      needs: ['dashboard'],            suggest: 'bars',     desc: 'Where the records list is empty, or a search finds nothing.' },
  notfound: { label: 'Page not found',    needs: [],                       suggest: 'dish',     desc: 'On the 404 page.' },
};

export const PRESETS = {
  minimal:        { heroBackground: 'territory', headline: 'none',         buttons: 'none',        cards: 'none',      reveal: 'rise',  extras: [] },
  calm:           { heroBackground: 'mesh',      headline: 'blur-in',      buttons: 'shine',       cards: 'lift',      reveal: 'fade',  extras: [] },
  'aurora-glass': { heroBackground: 'aurora',    headline: 'split-words',  buttons: 'glow-border', cards: 'spotlight', reveal: 'blur',  extras: ['cursor-glow'] },
  'tech-grid':    { heroBackground: 'grid',      headline: 'scramble',     buttons: 'shine',       cards: 'spotlight', reveal: 'rise',  extras: ['scroll-progress'] },
  playful:        { heroBackground: 'particles', headline: 'split-chars',  buttons: 'ripple',      cards: 'tilt',      reveal: 'scale', extras: ['click-spark'] },
  cosmic:         { heroBackground: 'stars',     headline: 'shimmer',      buttons: 'glow-border', cards: 'tilt',      reveal: 'fade',  extras: ['cursor-glow', 'count-up'] },
  editorial:      { heroBackground: 'grain',     headline: 'gradient',     buttons: 'magnetic',    cards: 'lift',      reveal: 'rise',  extras: ['count-up'] },
};

const none = (v) => v === undefined || v === null || v === '' || v === 'none' || v === false;

/** Turns the `effects` block of site.json into one validated, fully-resolved choice per slot. Throws on an unknown id.
 *  `modules` (optional) drops figure places whose module is not in the build, and lists them in `figuresIgnored`. */
export function resolveEffects(input = {}, { modules } = {}) {
  const fail = (what, id, table) => { throw new Error(`effects.${what}: "${id}" is not one of ${['none', ...Object.keys(table)].join(', ')}`); };
  let base = {};
  if (input.preset && !none(input.preset)) {
    base = PRESETS[input.preset];
    if (!base) throw new Error(`effects.preset: "${input.preset}" is not one of ${Object.keys(PRESETS).join(', ')}`);
  }
  const pick = (key) => (input[key] !== undefined ? input[key] : base[key]);

  const heroBackground = pick('heroBackground') ?? 'territory';
  if (heroBackground !== 'territory' && !none(heroBackground) && !BACKGROUNDS[heroBackground]) fail('heroBackground', heroBackground, { territory: 1, ...BACKGROUNDS });
  const loginBackground = input.loginBackground ?? 'none';
  if (!none(loginBackground) && !BACKGROUNDS[loginBackground]) fail('loginBackground', loginBackground, BACKGROUNDS);
  const headline = pick('headline') ?? 'none';
  if (!none(headline) && !HEADLINES[headline]) fail('headline', headline, HEADLINES);
  const buttons = pick('buttons') ?? 'none';
  if (!none(buttons) && !BUTTONS[buttons]) fail('buttons', buttons, BUTTONS);
  const cards = pick('cards') ?? 'none';
  if (!none(cards) && !CARDS[cards]) fail('cards', cards, CARDS);
  const reveal = pick('reveal') ?? 'rise';
  if (!REVEALS[reveal]) fail('reveal', reveal, REVEALS);
  const extras = [...new Set(pick('extras') ?? [])];
  for (const x of extras) if (!EXTRAS[x]) fail('extras', x, EXTRAS);
  const rotateWords = (input.rotateWords ?? []).map((w) => String(w).trim()).filter(Boolean).slice(0, 8);
  if (headline === 'rotate' && rotateWords.length < 2) throw new Error('effects.headline "rotate" needs effects.rotateWords with at least two words.');

  // figures: "auto" (the suggested figure in every place) or { place: figureId | "none" }
  const figIn = input.figures;
  let figures = {};
  if (figIn === 'auto') for (const [place, p] of Object.entries(PLACES)) figures[place] = p.suggest;
  else if (figIn && typeof figIn === 'object') {
    for (const [place, id] of Object.entries(figIn)) {
      if (!PLACES[place]) throw new Error(`effects.figures: "${place}" is not a place. Places: ${Object.keys(PLACES).join(', ')}`);
      if (!none(id) && !FIGURES[id]) fail(`figures.${place}`, id, FIGURES);
      if (!none(id)) figures[place] = id;
    }
  } else if (!none(figIn)) throw new Error('effects.figures must be "auto" or an object like { "hero": "terrain" }.');
  const figuresIgnored = [];
  if (modules) for (const place of Object.keys(figures)) if (!PLACES[place].needs.every((m) => modules.includes(m))) { figuresIgnored.push(place); delete figures[place]; }
  const components = resolveComponents(input.components);
  const figureIntensity = input.figureIntensity === undefined ? 0.5 : Math.min(1, Math.max(0, Number(input.figureIntensity)));
  if (!Number.isFinite(figureIntensity)) throw new Error('effects.figureIntensity must be a number from 0 to 1.');

  const r = {
    heroBackground: none(heroBackground) ? 'none' : heroBackground,
    loginBackground: none(loginBackground) ? 'none' : loginBackground,
    headline: none(headline) ? 'none' : headline,
    buttons: none(buttons) ? 'none' : buttons,
    cards: none(cards) ? 'none' : cards,
    reveal, extras, rotateWords, figures, figureIntensity, components,
  };
  if (figuresIgnored.length) r.figuresIgnored = figuresIgnored;
  r.active = r.heroBackground !== 'territory' || r.loginBackground !== 'none' || r.headline !== 'none' || r.buttons !== 'none' || r.cards !== 'none' || r.reveal !== 'rise' || extras.length > 0 || Object.keys(figures).length > 0 || components.length > 0;
  return r;
}

/** Everything the chosen effects need: files to copy, css snippets (ordered, unique) and micro-interaction modules. */
export function effectPlan(r, { all = false } = {}) {
  const files = new Set(['useCanvasLoop.ts']);
  const css = new Set(['base']);
  files.add('text/split.tsx'); files.add('text/Plain.tsx');
  const micro = new Set();
  const use = (table, id) => { const e = table[id]; if (!e) return; (e.files ?? []).forEach((f) => files.add(f)); (e.css ?? []).forEach((c) => css.add(c)); (e.micro ?? []).forEach((m) => { micro.add(m); files.add(`micro/${m}.ts`); files.add('micro/selectors.ts'); }); };
  const useUi = (id) => { const e = UI[id]; if (!e) return; e.files.forEach((f) => files.add(`ui/${f}`)); (e.css ?? []).forEach((c) => css.add(c)); };
  if (all) {
    for (const t of [BACKGROUNDS, HEADLINES, BUTTONS, CARDS, REVEALS, EXTRAS, FIGURES]) for (const id of Object.keys(t)) use(t, id);
    for (const id of Object.keys(UI)) useUi(id);
    css.add('figures');
  } else {
    if (r.heroBackground !== 'territory' && r.heroBackground !== 'none') use(BACKGROUNDS, r.heroBackground);
    if (r.loginBackground !== 'none') use(BACKGROUNDS, r.loginBackground);
    if (r.headline !== 'none') use(HEADLINES, r.headline);
    if (r.buttons !== 'none') use(BUTTONS, r.buttons);
    if (r.cards !== 'none') use(CARDS, r.cards);
    use(REVEALS, r.reveal);
    r.extras.forEach((x) => use(EXTRAS, x));
    for (const id of new Set(Object.values(r.figures))) use(FIGURES, id);
    (r.components ?? []).forEach(useUi);
    if (Object.keys(r.figures).length) css.add('figures');
  }
  // the figures' shared engine and its licence travel with whichever figures were chosen; their style is always there, so a figure used by name in your own code is styled too
  if ([...files].some((f) => f.startsWith('figures/factories/'))) for (const f of FIGURE_COMMON) files.add(f);
  css.add('figures');
  return { files: [...files], css: [...css], micro: [...micro] };
}

/** The whole menu as plain text, so a user can read it and choose before anything is built (`scaffold.mjs --list-effects`). */
export function effectsMenu() {
  const rows = (title, table, flag) => [`${title}   ${flag}`, ...Object.entries(table).map(([id, e]) => `  ${id.padEnd(13)} ${e.desc}`), ''];
  return [
    'Effects you can choose from. All are optional; anything you leave out stays at the default look.',
    '',
    ...rows('Hero backgrounds', { territory: { desc: 'The default dotted hero.' }, none: { desc: 'A plain hero.' }, ...BACKGROUNDS }, '--hero-bg <id>'),
    ...rows('Sign-in backgrounds', BACKGROUNDS, '--login-bg <id>'),
    ...rows('Headline animations', HEADLINES, '--headline <id>   (rotate also needs --rotate-words "a,b")'),
    ...rows('Buttons', BUTTONS, '--buttons <id>'),
    ...rows('Cards', CARDS, '--cards <id>'),
    ...rows('Scroll reveal', REVEALS, '--reveal <id>'),
    ...rows('Extras (any number)', EXTRAS, '--extras <id,id,...>'),
    'Figures: interactive isometric line drawings that answer the pointer (Hairline, MIT, plus three of our own).   --figures auto | place=figure,place=figure   --figure-intensity 0..1',
    '  Figures',
    ...Object.entries(FIGURES).map(([id, e]) => `    ${id.padEnd(11)} ${e.desc}`),
    '  Places (what `auto` puts there)',
    ...Object.entries(PLACES).map(([id, p]) => `    ${id.padEnd(9)} ${p.suggest.padEnd(9)} ${p.desc}${p.needs.length ? ` Needs: ${p.needs.join(' + ')}.` : ''}`),
    '',
    uiMenu(),
    '',
    'Presets (a ready-made bundle of the above; your own picks override it)   --preset <id>',
    ...Object.entries(PRESETS).map(([id, p]) => `  ${id.padEnd(13)} ${p.heroBackground} / ${p.headline} / ${p.buttons} / ${p.cards} / ${p.reveal}${p.extras.length ? ` + ${p.extras.join(', ')}` : ''}`),
    '',
  ].join('\n');
}

/** The class lists the micro-interactions act on - one place; scaffold writes them into the css and js (__FX_BTN__ / __FX_CARD__). */
export const BUTTON_SELECTOR = '.btn.primary';
export const CARD_SELECTOR = '.rec-card, .stat-card, .card, .why-card, .cta';
