#!/usr/bin/env node
// Sitewright scaffold: turns a site.json + a list of modules into a complete Next.js project.
//
//   node scaffold.mjs --config site.json --out ./my-site [--modules landing,signin,dashboard] [--force] [--password secret]
//   node scaffold.mjs --list
//   node scaffold.mjs --list-effects                       the effects menu (ids and what each does)
//   ... --preset calm --hero-bg aurora --headline split-words --buttons shine --cards lift --reveal blur --extras cursor-glow,count-up
//   ... --components all | hold-to-confirm,ring-chart      small interactive components to import from '@/components/fx/ui'
//                                                          effect choices passed directly; they override the config file
//   ... --figures auto | hero=terrain,signin=padlock   --figure-intensity 0.7     interactive line figures in named places
//   ... --icons auto | none   --icon nav.dashboard=layout-dashboard,stats.0=package   --icon-set lucide   --offline-icons
//   node scaffold.mjs --list-icons <word> [--icon-prefix lucide]        find icons by name (the kit's pack, installed sets, Iconify)
//   node scaffold.mjs --apply-icons ./my-site --icons auto              change the icons of an existing project in place
//   node scaffold.mjs --apply-effects ./my-site --hero-bg stars --headline typewriter
//                                                          change the effects of an existing project in place (nothing else is touched)
//
// Nothing here is clever on purpose: copy the module folders, fill __TOKENS__, strip //#if blocks, assemble the few files that
// depend on the whole module set (package.json, middleware, schema, env, navigation, palette). Then npm install && npm run dev.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { MODULES, resolveModules } from './modules.mjs';
import { DEFAULTS, deepMerge, interpolate } from './defaults.mjs';
import { buildPalette, paletteCss, onColour } from './lib/color.mjs';
import { logoComponent, faviconSvg, LOGO_STYLES } from './lib/logo.mjs';
import { resolveEffects, effectsMenu, BUTTON_SELECTOR, CARD_SELECTOR } from './effects.mjs';
import { generateFx, fxHtmlAttrs, FX_GENERATED } from './lib/fxgen.mjs';
import { syncFigures } from './lib/figures.mjs';
import { iconSlots, planIcons, resolveIcons, customIcons, iconFiles, normalizeId, searchIcons, searchLocal, syncIcons, DEFAULT_SET } from './lib/icons.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATES = path.join(HERE, '..', 'templates');

// ---- args ---------------------------------------------------------------------------------------------------------------
function args(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const k = a.slice(2);
      if (['force', 'list', 'list-effects', 'check', 'quiet', 'offline-icons'].includes(k)) out[k] = true;
      else out[k] = argv[++i];
    } else out._.push(a);
  }
  return out;
}

const fail = (msg) => { console.error(`sitewright: ${msg}`); process.exit(1); };

// ---- templating ---------------------------------------------------------------------------------------------------------
const TEXT = /\.(ts|tsx|css|json|md|mjs|svg|txt|example|gitignore)$|^_gitignore$|^\.env/;

/** Strips //#if / {/*#if*​/} blocks. Conditions: `a`, `!a`, `a|b` (any), `a&b` (all). Directive lines are removed entirely. */
export function applyDirectives(text, flags) {
  const lines = text.split('\n');
  const out = [];
  const stack = []; // each: { active, taken, parent }
  const dir = /^\s*(?:\/\/|\{\/\*)\s*#(if|else|endif)\b\s*([^*}]*?)\s*(?:\*\/\})?\s*$/;
  const test = (expr) => {
    const e = expr.trim();
    const one = (s) => (s.startsWith('!') ? !flags.has(s.slice(1)) : flags.has(s));
    if (e.includes('|')) return e.split('|').some((s) => one(s.trim()));
    if (e.includes('&')) return e.split('&').every((s) => one(s.trim()));
    return one(e);
  };
  for (const line of lines) {
    const m = dir.exec(line);
    if (!m) { if (stack.every((s) => s.active)) out.push(line); continue; }
    const [, kind, expr] = m;
    if (kind === 'if') { const t = test(expr); stack.push({ active: t, taken: t }); }
    else if (kind === 'else') { const top = stack[stack.length - 1]; if (!top) throw new Error('#else without #if'); top.active = !top.taken; top.taken = true; }
    else { if (!stack.pop()) throw new Error('#endif without #if'); }
  }
  if (stack.length) throw new Error('unterminated #if');
  return out.join('\n');
}

function fill(text, tokens, file) {
  return text.replace(/__([A-Z][A-Z0-9_]+)__/g, (m, k) => {
    if (!(k in tokens)) throw new Error(`unknown token ${m} in ${file}`);
    return tokens[k];
  });
}

function walk(dir, base = dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p, base));
    else out.push(path.relative(base, p));
  }
  return out;
}

// ---- main ---------------------------------------------------------------------------------------------------------------
const a = args(process.argv.slice(2));

if (a.list) {
  for (const [id, m] of Object.entries(MODULES)) if (!m.internal) console.log(`${id.padEnd(11)} ${m.title}\n${' '.repeat(12)}${m.summary ?? ''}\n${' '.repeat(12)}requires: ${m.requires.join(', ') || '-'}`);
  process.exit(0);
}

if (a['list-effects']) { console.log(effectsMenu()); process.exit(0); }

// The user's effect choices can be passed straight on the command line; they win over the config file and the preset.
// (--preset calm --hero-bg aurora --headline rotate --rotate-words "roasted,fresh" --buttons shine --cards lift --reveal blur --extras cursor-glow,count-up)
const csv = (s) => String(s).split(',').map((x) => x.trim()).filter(Boolean);
const FX_FLAGS = { preset: 'preset', 'hero-bg': 'heroBackground', 'login-bg': 'loginBackground', headline: 'headline', buttons: 'buttons', cards: 'cards', reveal: 'reveal' };
const picked = {};
for (const [flag, key] of Object.entries(FX_FLAGS)) if (a[flag] !== undefined) picked[key] = a[flag];
if (a.extras !== undefined) picked.extras = csv(a.extras);
if (a.components !== undefined) picked.components = ['all', 'none'].includes(String(a.components).trim()) ? String(a.components).trim() : csv(a.components);
// --figures auto | none | hero=terrain,signin=padlock      --figure-intensity 0..1
if (a.figures !== undefined) {
  const v = String(a.figures).trim();
  picked.figures = v === 'auto' || v === 'none' ? v : Object.fromEntries(csv(v).map((kv) => { const [k, id] = kv.split('='); if (!k || !id) fail(`--figures: "${kv}" should look like hero=terrain (places and figures: --list-effects)`); return [k.trim(), id.trim()]; }));
}
if (a['figure-intensity'] !== undefined) picked.figureIntensity = Number(a['figure-intensity']);
if (a['rotate-words'] !== undefined) picked.rotateWords = csv(a['rotate-words']);


// ---- icons ---------------------------------------------------------------------------------------------------------------------
// Icons are named in site.json ("lucide:coffee", or just "coffee" in the default set), resolved to SVG once here, checked, and written
// into the project as data (src/components/icons/icons.data.json). See lib/icons.mjs and reference/icons.md.
const iconOpts = () => ({
  auto: a.icons === 'auto' ? true : a.icons === 'none' ? false : undefined,
  none: a.icons === 'none',
  set: a['icon-set'],
  offline: !!a['offline-icons'],
  allow: a['allow-icon-license'] ? csv(a['allow-icon-license']) : [],
  assign: a.icon ? Object.fromEntries(csv(a.icon).map((kv) => { const i = kv.indexOf('='); if (i < 1) fail(`--icon: "${kv}" should look like nav.dashboard=layout-dashboard (places: reference/icons.md)`); return [kv.slice(0, i).trim(), kv.slice(i + 1).trim()]; })) : {},
});

/** Applies the person's icon choices to the config, then resolves every icon in use. Mutates cfg (icons become full ids). */
async function iconStep(cfg, modules, o) {
  const block = typeof cfg.icons === 'string' ? { auto: cfg.icons === 'auto' } : (cfg.icons ??= {});
  if (o.set) block.set = o.set;
  if (o.auto !== undefined) block.auto = o.auto;
  const set = block.set || DEFAULT_SET;
  const slots = iconSlots(cfg, modules);
  if (o.none) for (const sl of slots) sl.set(null);
  for (const [key, val] of Object.entries(o.assign)) {
    const sl = slots.find((x) => x.key === key);
    if (!sl) fail(`--icon: there is no place "${key}" in this site. Places here: ${slots.map((x) => x.key).join(', ')}`);
    sl.set(val === '' || val === 'none' ? null : val);
  }
  const custom = customIcons(block.custom);
  const plan = planIcons(cfg, modules, { auto: !!block.auto, set, map: block.map ?? {} });
  const extra = (block.extra ?? []).map((x) => normalizeId(x, set) ?? fail(`icons.extra: "${x}" is not an icon id.`));
  const ids = [...plan.used, ...extra];
  const wantCustom = ids.filter((i) => i.startsWith('custom:'));
  const missingCustom = wantCustom.filter((i) => !custom.icons[i]);
  const remote = ids.filter((i) => !i.startsWith('custom:'));
  const res = await resolveIcons(remote, { offline: o.offline, allowLicenses: o.allow });
  const problems = [...plan.problems, ...custom.problems, ...res.problems, ...missingCustom.map((i) => `${i}: no such custom icon (define it in icons.custom).`)];
  if (res.missing.length) problems.push(`not found: ${res.missing.join(', ')}. Find the right name with:  node scaffold.mjs --list-icons <word>   (or better-icons: npx better-icons search <word> --prefix ${set})`);
  if (problems.length) fail(`icons:\n  - ${problems.join('\n  - ')}${res.notes.length ? `\n  (${res.notes.join('; ')})` : ''}`);
  // anything that could not be resolved was reported above; what is here is safe to write
  return { ...iconFiles({ icons: res.icons, sets: res.sets, custom: custom.icons, set }), notes: res.notes, count: Object.keys(res.icons).length + Object.keys(custom.icons).length, set };
}

/** `--list-icons <word>`: icons by name, from what works offline and, when the network allows, from Iconify (what better-icons searches). */
if (a['list-icons'] !== undefined) {
  const q = String(a['list-icons']), prefix = a['icon-prefix'] || DEFAULT_SET;
  const local = searchLocal(q, prefix);
  console.log(`In the kit's pack / installed sets (${prefix}), usable with no network:\n  ${local.slice(0, 40).join('\n  ') || '(none)'}${local.length > 40 ? `\n  ... ${local.length - 40} more` : ''}`);
  if (!a['offline-icons']) {
    try { const r = await searchIcons(q, { prefix: a['icon-prefix'], limit: 30 }); console.log(`\nIconify${a['icon-prefix'] ? ` (${prefix})` : ''}:\n  ${r.join('\n  ') || '(none)'}`); }
    catch (e) { console.log(`\nIconify could not be reached (${e.message}). Use --offline-icons to skip this.`); }
  }
  process.exit(0);
}

/** `--apply-icons <project>`: change which icon a place has, in an existing project. Pages are not touched: only site.json, nav.json and the icon data. */
if (a['apply-icons']) {
  const dir = path.resolve(a['apply-icons']);
  const siteFile = path.join(dir, 'src/content/site.json'), navFile = path.join(dir, 'src/content/nav.json');
  if (!fs.existsSync(siteFile) || !fs.existsSync(navFile)) fail(`${dir} does not look like a Sitewright project.`);
  if (!fs.existsSync(path.join(dir, 'scripts/sync-icons.mjs'))) fail('this project was generated before icons followed the code. Regenerate it once with the current Sitewright; after that, icons follow your code by themselves.');
  const o = iconOpts();
  if (o.auto === undefined && !o.none && !Object.keys(o.assign).length && !o.set && !a['prune-icons']) fail('nothing to apply: pass --icons auto|none, --icon place=icon,... or --icon-set (see reference/icons.md).');
  const site = JSON.parse(fs.readFileSync(siteFile, 'utf8'));
  const block = typeof site.icons === 'string' ? (site.icons = { auto: site.icons === 'auto' }) : (site.icons ??= {});
  if (o.set) block.set = o.set;
  if (o.auto !== undefined) block.auto = o.auto;
  const mods = site.modules ?? [];
  const slots = iconSlots(site, mods);
  if (o.none) for (const sl of slots) sl.set(null);
  for (const [key, val] of Object.entries(o.assign)) {
    const sl = slots.find((x) => x.key === key);
    if (!sl) fail(`--icon: there is no place "${key}" in this site. Places here: ${slots.map((x) => x.key).join(', ')}`);
    sl.set(val === '' || val === 'none' ? null : val);
  }
  const plan = planIcons(site, mods, { auto: !!block.auto && o.auto !== false, set: block.set || DEFAULT_SET, map: block.map ?? {} });
  if (plan.problems.length) fail(`icons:\n  - ${plan.problems.join('\n  - ')}`);
  fs.writeFileSync(siteFile, JSON.stringify(site, null, 2) + '\n');
  const nav = JSON.parse(fs.readFileSync(navFile, 'utf8'));
  for (const it of nav.items) { const ic = site.nav?.icons?.[it.id]; if (ic) it.icon = ic; else delete it.icon; }
  fs.writeFileSync(navFile, JSON.stringify(nav, null, 2) + '\n');
  const r = await syncIcons({ root: dir, offline: o.offline, allow: o.allow, prune: !!a['prune-icons'] });
  if (r.hints.length || r.problems.length) fail(`icons:\n  - ${[...r.hints.map((h) => `not found: ${h}`), ...r.problems].join('\n  - ')}`);
  console.log(`sitewright: icons updated in ${dir}\n  ${r.count} icons${r.added.length ? `, added ${r.added.join(', ')}` : ''}${r.removed.length ? `, removed ${r.removed.join(', ')}` : ''}`);
  for (const n of r.notes) console.log(`  note: ${n}`);
  process.exit(0);
}

// ---- --apply-effects <project>: change the effects of an existing project in place -------------------------------------------
// Rewrites only the generated effects layer (src/components/fx/), the data-fx-* attributes on <html> in the root layout and the
// `effects` entry of src/content/site.json. Pages, styles and anything else you edited are never touched.
if (a['apply-effects']) {
  const dir = path.resolve(a['apply-effects']);
  const siteFile = path.join(dir, 'src/content/site.json');
  const layoutFile = path.join(dir, 'src/app/layout.tsx');
  if (!fs.existsSync(siteFile) || !fs.existsSync(layoutFile)) fail(`${dir} does not look like a Sitewright project (no src/content/site.json or src/app/layout.tsx).`);
  const site = JSON.parse(fs.readFileSync(siteFile, 'utf8'));
  const layout = fs.readFileSync(layoutFile, 'utf8');
  if (!fs.existsSync(path.join(dir, 'src/components/fx/index.tsx')) || !layout.includes('FxMicro')) fail('this project was generated before effects could be changed in place. Regenerate it once with the current Sitewright, then --apply-effects works.');
  if ((site.modules ?? []).includes('fxgallery')) fail('this project contains the fxgallery module, which previews every effect at /effects; choose effects there, or in a separate project.');
  if (!Object.keys(picked).length) fail('nothing to apply: pass at least one of --preset --hero-bg --login-bg --headline --rotate-words --buttons --cards --reveal --extras (see --list-effects).');

  // A preset starts from scratch; individual picks change only their own slot of what the project has now.
  const { active, ...current } = site.effects ?? {};
  let fx;
  // --figures hero=bars changes that place only; "none" for a place removes it; "auto" / "none" on their own replace the lot.
  const figures = typeof picked.figures === 'object' && current.figures && !picked.preset
    ? Object.fromEntries(Object.entries({ ...current.figures, ...picked.figures }).filter(([, id]) => id !== 'none')) : picked.figures;
  const next = picked.preset ? picked : { ...current, ...picked };
  if (figures !== undefined) next.figures = figures;
  try { fx = resolveEffects(next, { modules: site.modules }); } catch (e) { fail(e.message); }

  const files = new Map();
  const tokens = { FX_BTN: BUTTON_SELECTOR, FX_CARD: CARD_SELECTOR };
  generateFx({ fx, landing: (site.modules ?? []).includes('landing'), all: false, templates: TEMPLATES, tokens, put: (rel, content) => files.set(rel, content), fill });

  const fxDir = path.join(dir, 'src/components/fx');
  for (const name of FX_GENERATED) fs.rmSync(path.join(fxDir, name), { recursive: true, force: true });
  for (const [rel, content] of files) { const dest = path.join(dir, rel); fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.writeFileSync(dest, content); }

  // figures used by name in the project's own code are brought back (the folder above was rewritten from the choices alone)
  if (fs.existsSync(path.join(dir, 'src/components/fx/figures/config.json'))) syncFigures({ root: dir });
  const attrs = fxHtmlAttrs(fx);
  const html = /(<html\b[^>]*?\bsuppressHydrationWarning)((?:\s+data-fx-[a-z]+="[^"]*")*)/;
  if (html.test(layout)) fs.writeFileSync(layoutFile, layout.replace(html, (_, head) => head + attrs));
  else console.warn(`sitewright: could not find the <html> tag in ${layoutFile}; add this to it by hand:${attrs || ' (no data-fx-* attributes needed)'}`);

  site.effects = fx;
  fs.writeFileSync(siteFile, JSON.stringify(site, null, 2) + '\n');
  console.log(`sitewright: effects updated in ${dir}  (${files.size} files)`);
  console.log(`  hero ${fx.heroBackground}, login ${fx.loginBackground}, headline ${fx.headline}, buttons ${fx.buttons}, cards ${fx.cards}, reveal ${fx.reveal}, extras ${fx.extras.join('+') || 'none'}${fx.components.length ? `, components ${fx.components.length}` : ''}`);
  console.log(`  figures ${Object.entries(fx.figures).map(([p, id]) => `${p}=${id}`).join(', ') || 'none'}${fx.figuresIgnored ? `   (no such place in this site: ${fx.figuresIgnored.join(', ')})` : ''}`);
  console.log('  run:  npm run dev   (or npm run build)');
  process.exit(0);
}

if (!a.config) fail('--config <site.json> is required (see reference/config.md). Use --list to see the modules, --apply-effects <project> to change effects.');
if (!a.out && !a.check) fail('--out <directory> is required.');

let userCfg;
try { userCfg = JSON.parse(fs.readFileSync(a.config, 'utf8')); } catch (e) { fail(`cannot read ${a.config}: ${e.message}`); }

if (Object.keys(picked).length) userCfg.effects = { ...(userCfg.effects ?? {}), ...picked };

const merged = deepMerge(DEFAULTS, userCfg);
const brandName = String(merged.brand?.name ?? '').trim();
if (!brandName) fail('brand.name is required.');
const slug = (merged.brand.slug || brandName).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'site';
const cookie = (merged.brand.cookie || slug.replace(/-/g, '').slice(0, 6) || 'site');
if (!/^[a-z0-9]{2,8}$/.test(cookie)) fail(`brand.cookie "${cookie}" must be 2-8 lowercase letters/digits.`);

const vars = {
  brand: brandName, record: merged.vocab.record, records: merged.vocab.records,
  device: merged.vocab.device, artifact: merged.vocab.artifact, area: merged.vocab.area,
};
const cfg = interpolate(merged, vars);
cfg.brand.slug = slug;
cfg.brand.cookie = cookie;

// design theme and fonts. A font the config names is respected; otherwise the theme brings its own (the display face falls back to the body face)
const theme = String(cfg.design?.theme ?? 'studio');
if (!['studio', 'classic'].includes(theme)) fail(`design.theme must be "studio" or "classic", not "${theme}".`);
cfg.design = { ...(cfg.design ?? {}), theme };
if (!userCfg.brand?.logo?.style) cfg.brand.logo.style = theme === 'studio' ? 'monogram' : 'hex'; // the studio default is a letter mark; name a style to choose another
{
  const uf = userCfg.brand?.font ?? {};
  cfg.brand.font = {
    body: uf.body ?? (theme === 'classic' ? 'Montserrat' : 'Inter'),
    display: uf.display ?? uf.body ?? (theme === 'classic' ? 'Montserrat' : 'Bricolage Grotesque'),
    mono: uf.mono ?? 'JetBrains Mono',
  };
}

// colours / logo
for (const k of ['primary', 'signal']) if (!/^#[0-9a-fA-F]{3,6}$/.test(cfg.brand.colors[k])) fail(`brand.colors.${k} must be a hex colour like #1e5bd8`);
if (!LOGO_STYLES.includes(cfg.brand.logo.style)) fail(`brand.logo.style must be one of ${LOGO_STYLES.join(', ')}`);
// The monogram letter lands in SVG text: letters and digits only, so '<', '&' or '{' cannot reach the markup.
const alnum = (s) => String(s || '').replace(/[^\p{L}\p{N}]/gu, '');
const letter = (alnum(cfg.brand.logo.letter).slice(0, 2) || alnum(brandName).slice(0, 1) || 'A').toUpperCase();

// modules
const wanted = a.modules ? a.modules.split(',').map((s) => s.trim()).filter(Boolean) : (cfg.modules ?? ['landing', 'signin', 'dashboard', 'connect', 'mfa', 'publishing']);
let modules;
try { modules = resolveModules(wanted); } catch (e) { fail(e.message); }
const has = (id) => modules.includes(id);
const added = modules.filter((m) => !wanted.includes(m) && m !== 'base');

if (a.check) {
  let effects; try { effects = resolveEffects(cfg.effects ?? {}, { modules }); } catch (e) { fail(e.message); }
  console.log(JSON.stringify({ brand: brandName, slug, design: cfg.design, modules, addedAsDependencies: added, effects }, null, 2)); process.exit(0);
}

// output dir
const out = path.resolve(a.out);
if (fs.existsSync(out) && fs.readdirSync(out).length && !a.force) fail(`${out} is not empty. Use --force to write into it.`);
fs.mkdirSync(out, { recursive: true });

// flags for //#if
const flags = new Set(modules);
if (has('publishing') && cfg.publishing.testers) flags.add('testers');
if (has('publishing') && cfg.publishing.parseApk) flags.add('parseApk');
if (has('landing') && cfg.landing.proof) flags.add('proof');
if (has('landing') && cfg.landing.features) flags.add('features');
if (has('landing') && cfg.landing.compat) flags.add('compat');
if (has('landing') && cfg.landing.faq?.length) flags.add('faq');
if (theme === 'studio') flags.add('studio');
if (cfg.storage?.provider === 's3') flags.add('s3');
if (cfg.storage?.provider === 'azure') flags.add('azure');

// effects (animated backgrounds, headline animations, button and card micro-interactions): see effects.mjs
let fx;
try { fx = resolveEffects(cfg.effects ?? {}, { modules }); } catch (e) { fail(e.message); }
const fxGallery = has('fxgallery');
if (fxGallery && modules.every((m) => m === 'base' || m === 'fxgallery')) flags.add('fx_home');
// The effects layer is always generated, even with nothing chosen: the pages import its slots (a "none" slot renders nothing), which is
// what lets `--apply-effects` swap effects later by rewriting src/components/fx/ alone.
flags.add('fx');

// icons
const iconResult = await iconStep(cfg, modules, iconOpts());

// palette
const palette = buildPalette({ primary: cfg.brand.colors.primary, signal: cfg.brand.colors.signal, neutral: cfg.brand.colors.neutralHue, theme });

const loginRedirect = has('dashboard') ? '/dashboard' : has('connect') ? '/connect' : has('mfa') ? '/admin' : has('fxgallery') ? '/effects' : '/';
// A sign-in with nothing behind it would redirect '/' to '/' forever, so that site gets a small page of its own.
if (!has('landing') && loginRedirect === '/') flags.add('empty_home');
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const exts = cfg.publishing.extensions.map((e) => (e.startsWith('.') ? e : `.${e}`).toLowerCase());
const fontQuery = (f, w) => `family=${encodeURIComponent(f).replace(/%20/g, '+')}:wght@${w}`;

// Token values land inside TSX string literals, JSX text and CSS, so quote-ish characters are normalised rather than escaped:
// "Bean's" becomes "Bean’s" (a typographic apostrophe), and characters that mean something to JSX or template strings are dropped.
const safe = (v) => String(v).replace(/'/g, '’').replace(/"/g, '”').replace(/[`\\{}<>]/g, '').replace(/\$/g, 'S');
const tokens = {
  BRAND: brandName, BRAND_SLUG: slug, BRAND_JSON: JSON.stringify(brandName), COOKIE: cookie, ISSUER: brandName,
  AREA: cfg.vocab.area, AREA_LOWER: cfg.vocab.area.toLowerCase(),
  ARTIFACT: cfg.vocab.artifact, DEVICE: cfg.vocab.device,
  RECORD: cfg.vocab.record, RECORDS: cfg.vocab.records, RECORD_CAP: cap(cfg.vocab.record), RECORDS_CAP: cap(cfg.vocab.records),
  LANG: cfg.brand.lang, DESCRIPTION_JSON: JSON.stringify(cfg.brand.description),
  TITLE_JSON: JSON.stringify(`${brandName} · ${cfg.brand.tagline}`),
  FONT_BODY: cfg.brand.font.body, FONT_DISPLAY: cfg.brand.font.display, FONT_MONO: cfg.brand.font.mono,
  FONTS_URL: `https://fonts.googleapis.com/css2?${[...new Set([cfg.brand.font.body, cfg.brand.font.display])].map((f) => fontQuery(f, '400;500;600;700;800')).join('&')}&${fontQuery(cfg.brand.font.mono, '400;500;600')}&display=swap`,
  DESIGN_ATTR: theme === 'studio' ? ' data-design="studio"' : '',
  THEME_CSS: theme === 'studio' ? fs.readFileSync(path.join(TEMPLATES, 'design', 'studio.css'), 'utf8') : '',
  LOGIN_REDIRECT: loginRedirect,
  PACKAGE_NAME: cfg.publishing.packageName || '',
  EXTENSIONS_JSON: JSON.stringify(exts), ACCEPT_ATTR: exts.join(','),
  PALETTE_CSS: paletteCss(palette),
  SCHEMA_SQL: modules.map((m) => MODULES[m].schema).filter(Boolean).join('\n'),
  OPEN_PATHS_JSON: JSON.stringify([...new Set(modules.flatMap((m) => MODULES[m].open ?? []))]),
  LIGHT_PRIMARY: palette.light.primary, LIGHT_SURFACE: palette.light.surface, DARK_SURFACE: palette.dark.surface,
  PUBLISHING_NOUN: `${cfg.vocab.artifact} version`,
  SIGN_OUT: has('signin') ? '/api/logout' : has('mfa') ? '/api/admin/logout' : '',
  AREA_LOWER_NAV: cfg.nav.suffix || 'dashboard',
  ADMIN_NAV_ID: has('publishing') ? 'publishing' : 'team',
  NAV_CONNECT: cfg.nav.connect,
};
const PLAIN = ['BRAND', 'ISSUER', 'AREA', 'AREA_LOWER', 'ARTIFACT', 'DEVICE', 'RECORD', 'RECORDS', 'RECORD_CAP', 'RECORDS_CAP', 'AREA_LOWER_NAV', 'PACKAGE_NAME', 'NAV_CONNECT'];
for (const k of PLAIN) tokens[k] = safe(tokens[k]);
tokens.FX_HTML_ATTRS = fxGallery ? '' : fxHtmlAttrs(fx);
tokens.FX_BTN = BUTTON_SELECTOR;
tokens.FX_CARD = CARD_SELECTOR;

// ---- copy -----------------------------------------------------------------------------------------------------------------
const written = new Map();
function put(rel, content) { written.set(rel.replace(/\\/g, '/'), content); }

for (const id of modules) {
  const root = id === 'base' ? path.join(TEMPLATES, 'base') : path.join(TEMPLATES, 'modules', id);
  for (const rel of walk(root)) {
    const src = path.join(root, rel);
    let dest = rel === '_gitignore' ? '.gitignore' : rel;
    if (!TEXT.test(path.basename(rel)) && !TEXT.test(rel)) { put(dest, fs.readFileSync(src)); continue; }
    let text = fs.readFileSync(src, 'utf8').replace(/\r\n/g, '\n');
    try { text = fill(applyDirectives(text, flags), tokens, `${id}/${rel}`); } catch (e) { fail(e.message); }
    put(dest, text);
  }
}

// files that exist only with a feature flag (see fileFlags in modules.mjs)
for (const id of modules) for (const [rel, flag] of Object.entries(MODULES[id].fileFlags ?? {})) if (!flags.has(flag)) written.delete(rel);

// ---- generated files ------------------------------------------------------------------------------------------------------
put('src/components/brand/Logo.tsx', logoComponent({ style: cfg.brand.logo.style, letter, name: brandName.replace(/[`$\\]/g, '') }));
put('src/app/icon.svg', faviconSvg({ style: cfg.brand.logo.style, letter }, palette.light.primary, palette.light.signal, palette.light['on-primary']));

// ---- effects layer ---------------------------------------------------------------------------------------------------------
generateFx({ fx, landing: has('landing'), all: fxGallery, templates: TEMPLATES, tokens, put, fill });

const nav = [];
if (has('dashboard')) nav.push({ id: 'dashboard', label: cfg.nav.dashboard, href: '/dashboard' });
if (has('connect')) nav.push({ id: 'connect', label: cfg.nav.connect, href: '/connect' });
if (has('publishing')) nav.push({ id: 'publishing', label: cfg.nav.publishing, href: '/admin' });
else if (has('mfa')) nav.push({ id: 'team', label: cfg.nav.team, href: '/admin' });
if (has('landing')) nav.push({ id: 'home', label: cfg.nav.home, href: '/' });
for (const it of nav) { const ic = cfg.nav.icons?.[it.id]; if (ic) it.icon = ic; }
put('src/content/nav.json', JSON.stringify({ items: nav, homeAfterLogin: loginRedirect }, null, 2) + '\n');
put('src/components/icons/icons.data.json', iconResult.data);
put('src/components/icons/icons.sets.json', iconResult.sets);
put('src/components/icons/NOTICE.md', iconResult.notice);
// the project keeps its own copy of the icon sync (and the small pack it uses), so it needs nothing from this skill afterwards
for (const f of ['icons.mjs', 'scan.mjs', 'figures.mjs', 'figures-slots.mjs']) put(`scripts/lib/${f}`, fs.readFileSync(path.join(HERE, 'lib', f), 'utf8'));
put('scripts/lib/pack/lucide.json', fs.readFileSync(path.join(TEMPLATES, 'icons', 'lucide.json'), 'utf8'));
// ...and the figure library, so <Figure name="..."> can bring in any of the 22 figures later (it is not part of the site until a figure is used)
for (const rel of walk(path.join(TEMPLATES, 'fx', 'figures'))) put(`scripts/lib/figures/${rel}`, fs.readFileSync(path.join(TEMPLATES, 'fx', 'figures', rel), 'utf8'));

// the content file the components read: exactly the resolved config, minus build-only keys
const site = { ...cfg, modules, flags: [...flags], effects: fx };
delete site.storage;
put('src/content/site.json', JSON.stringify(site, null, 2) + '\n');

// package.json
const deps = {}, devDeps = {};
for (const id of modules) Object.assign(deps, MODULES[id].deps ?? {}), Object.assign(devDeps, MODULES[id].devDeps ?? {});
if (flags.has('s3')) Object.assign(deps, { '@aws-sdk/client-s3': '^3.700.0', '@aws-sdk/s3-request-presigner': '^3.700.0' });
const sorted = (o) => Object.fromEntries(Object.entries(o).sort(([x], [y]) => x.localeCompare(y)));
put('package.json', JSON.stringify({
  name: slug, version: '0.1.0', private: true, description: cfg.brand.description, engines: { node: '>=20' },
  scripts: { dev: 'node scripts/dev.mjs', prebuild: 'node scripts/sync-icons.mjs --build && node scripts/sync-figures.mjs --build', build: 'next build', start: 'next start', lint: 'next lint', icons: 'node scripts/sync-icons.mjs', figures: 'node scripts/sync-figures.mjs' },
  dependencies: sorted(deps), devDependencies: sorted(devDeps),
}, null, 2) + '\n');

// env: .env.example (documented) + .env.local (generated dev secrets, gitignored)
const rnd = (n) => crypto.randomBytes(n).toString('hex');
const secrets = { '@secret': rnd(32), '@token': rnd(24), '@setup': `SETUP-${rnd(3).toUpperCase()}`, '@password': a.password || `pw-${rnd(5)}` };
const seen = new Set(); const envDocs = []; const envLocal = [];
for (const id of modules) for (const e of MODULES[id].env ?? []) {
  if (seen.has(e.name)) continue; seen.add(e.name);
  envDocs.push(`# ${e.note}\n${e.name}=`);
  envLocal.push(`${e.name}=${e.dev && e.dev.startsWith('@') ? secrets[e.dev] : (e.dev ?? '')}`);
}
if (flags.has('s3')) envDocs.push('# S3 / Cloudflare R2\nS3_ENDPOINT=\nS3_BUCKET=\nS3_ACCESS_KEY_ID=\nS3_SECRET_ACCESS_KEY=\nS3_REGION=auto');
if (flags.has('azure')) envDocs.push('# Azure Blob\nAZURE_ACCOUNT=\nAZURE_CONTAINER=\nAZURE_KEY=');
put('.env.example', `# ${brandName} - copy to .env.local and fill in. Never commit .env.local.\n\n${envDocs.join('\n\n')}\n`);
put('.env.local', `# Generated by Sitewright for local development. Do not commit.\n${envLocal.join('\n')}\n`);

// README
put('README.md', `# ${brandName}

${cfg.brand.description}

Generated by **Sitewright** from \`src/content/site.json\` with these modules: ${modules.filter((m) => m !== 'base').join(', ')}.

## Run it

\`\`\`bash
npm install
npm run dev        # http://localhost:3000
\`\`\`

\`.env.local\` was generated with development secrets. Production values go in the host's application settings - see \`.env.example\`.

## Where things live

| What | Where |
|---|---|
| All copy, colours and names | \`src/content/site.json\` (edit, then re-run Sitewright or edit the components directly) |
| Colour tokens (light + dark) | the first block of \`src/app/globals.css\` |
| Database schema | \`src/lib/schema.ts\` (idempotent, applied on first request) |
| Private-page gate | \`src/middleware.ts\` |
| Pages | \`src/app\` (App Router) |
| Icons | write \`<Icon name="rocket" />\` (or \`<Icon for="Shipped orders" />\`) anywhere: \`npm run dev\` and \`npm run build\` bring the icon in by themselves, or run \`npm run icons\`. Your own words: \`icons.map\` in \`src/content/site.json\`. Licences: \`src/components/icons/NOTICE.md\` |
| Figures | \`<Figure name="padlock" />\` anywhere (22 to choose from): brought in by \`npm run dev\` / \`npm run build\` / \`npm run figures\` |
| Effects and figures | \`src/components/fx/\` is generated by Sitewright; change it with \`scaffold.mjs --apply-effects\` rather than by hand (see the Sitewright skill's \`reference/effects.md\`) |

Every page is responsive from 320px up and honours \`prefers-reduced-motion\` and the light/dark toggle.
`);

// ---- write ----------------------------------------------------------------------------------------------------------------
let n = 0;
for (const [rel, content] of written) {
  const dest = path.join(out, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, content);
  n++;
}

if (!a.quiet) {
  console.log(`\nsitewright: wrote ${n} files to ${out}`);
  console.log(`  brand    ${brandName} (${slug}), logo ${cfg.brand.logo.style}, primary ${cfg.brand.colors.primary}, signal ${cfg.brand.colors.signal}`);
  console.log(`  modules  ${modules.filter((m) => m !== 'base').join(', ')}${added.length ? `   (added as dependencies: ${added.join(', ')})` : ''}`);
  if (fx.active) console.log(`  effects  hero ${fx.heroBackground}, login ${fx.loginBackground}, headline ${fx.headline}, buttons ${fx.buttons}, cards ${fx.cards}, reveal ${fx.reveal}${fx.extras.length ? `, extras ${fx.extras.join('+')}` : ''}${Object.keys(fx.figures).length ? `, figures ${Object.entries(fx.figures).map(([p, id]) => `${p}=${id}`).join(' ')}` : ''}`);
  if (iconResult.count) console.log(`  icons    ${iconResult.count} (${iconResult.set}${cfg.icons?.auto ? ', auto' : ''})`);
  for (const n of iconResult.notes) console.log(`  note     ${n}`);
  if (has('signin')) console.log(`  sign-in  password ${secrets['@password']}   (development only; stored in .env.local)`);
  if (has('mfa')) console.log(`  admin    setup code ${secrets['@setup']}   (first account at /admin/setup)`);
  if (has('api')) console.log(`  api key  ${secrets['@token']}   (Bearer token for /api/ingest)`);
  console.log(`\n  next:  cd ${a.out} && npm install && npm run dev\n`);
}
