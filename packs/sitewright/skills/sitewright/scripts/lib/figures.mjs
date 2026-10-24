// Keeps a project's figures in line with its code. `<Figure name="padlock" />` anywhere in src is found, and the figure's files are copied
// into src/components/fx/figures from the library that ships with the project (scripts/lib/figures) - nothing to register, nothing to run.
// Nothing is removed unless asked (prune). The same code runs in the skill, where the library is templates/fx/figures.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { walkSrc, readSource, readTag, attrValues, closest } from './scan.mjs';
import { slotsSource } from './figures-slots.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const LIBS = [path.join(HERE, 'figures'), path.join(HERE, '..', '..', 'templates', 'fx', 'figures')];
const COMMON = ['core/iso.ts', 'core/motion.ts', 'core/stage.ts', 'core/styles.ts', 'mount.ts', 'intensity.ts', 'LICENSE-hairline.txt'];
const readJson = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };
const library = () => LIBS.find((d) => fs.existsSync(path.join(d, 'factories')));

/** Every figure the library has. */
export function libraryFigures() {
  const lib = library();
  return lib ? fs.readdirSync(path.join(lib, 'factories')).filter((f) => f.endsWith('.ts')).map((f) => f.replace(/\.ts$/, '')).sort() : [];
}

/** The library files one figure needs: its factory, its engine, and any geometry module the engine imports. */
export function figureFiles(id) {
  const lib = library();
  const files = [`factories/${id}.ts`, `engines/${id}.ts`];
  const engine = fs.readFileSync(path.join(lib, 'engines', `${id}.ts`), 'utf8');
  for (const m of engine.matchAll(/from\s+["']\.\/([\w-]+)["']/g)) files.push(`engines/${m[1]}.ts`);
  return files;
}

/** Figure names used in code: <Figure name="padlock" /> or name={ok ? 'lock' : 'padlock'}. */
export function scanFigures(root) {
  const names = new Map();
  for (const file of walkSrc(path.join(root, 'src'), (d) => d.endsWith(path.join('components', 'fx', 'figures')))) {
    const src = readSource(file);
    if (src === null) continue;
    for (const m of src.matchAll(/<Figure\b/g)) for (const v of attrValues(readTag(src, m.index + 7), 'name')) {
      if (!v) continue;
      if (!names.has(v)) names.set(v, new Set());
      names.get(v).add(path.relative(root, file).replace(/\\/g, '/'));
    }
  }
  return names;
}

const dirs = (root) => { const dir = path.join(root, 'src', 'components', 'fx', 'figures'); return { dir, cfg: path.join(dir, 'config.json'), slots: path.join(dir, 'Slots.tsx') }; };

export function syncFigures({ root = process.cwd(), check = false, prune = false } = {}) {
  const P = dirs(root);
  const cfg = readJson(P.cfg);
  const none = { added: [], removed: [], changed: false, missing: [], hints: [], problems: [], count: 0, skipped: null };
  if (!cfg) return { ...none, skipped: 'This project was generated before <Figure name="..."> worked anywhere. Regenerate it once with the current Sitewright (or run scaffold.mjs --apply-effects ./project --figures none), and it will.' };
  if (!library()) return { ...none, skipped: 'The figure library is missing (scripts/lib/figures).' };
  const all = libraryFigures();
  const found = scanFigures(root);
  const problems = [], hints = [], missing = [];
  for (const [name, files] of found) if (!all.includes(name)) {
    missing.push(name);
    const alt = closest(name, all);
    hints.push(`${name} (used in ${[...files][0]})${alt.length ? `  did you mean ${alt.join(', ')}?` : `  the figures are: ${all.join(', ')}`}`);
  }
  const good = [...found.keys()].filter((n) => all.includes(n));
  const named = [...new Set(prune ? good : [...(cfg.named ?? []), ...good])].filter((n) => all.includes(n)).sort();
  // ids and places from the config file go into paths and generated source, so only real library figures and plain place names are accepted
  const chosen = Object.fromEntries(Object.entries(cfg.chosen ?? {}).filter(([place, id]) => /^[a-z][a-z0-9]*$/.test(place) && all.includes(id)));
  const needed = [...new Set([...Object.values(chosen), ...named])].sort();
  const lib = library();
  const added = [], removed = [];
  const copy = (rel) => {
    const to = path.join(P.dir, rel);
    if (fs.existsSync(to)) return false;
    if (!check) { fs.mkdirSync(path.dirname(to), { recursive: true }); fs.copyFileSync(path.join(lib, rel), to); }
    return true;
  };
  let changed = false;
  if (needed.length) for (const rel of COMMON) if (copy(rel)) changed = true;
  for (const id of needed) {
    let any = false;
    for (const rel of figureFiles(id)) if (copy(rel)) any = true;
    if (any) { added.push(id); changed = true; }
  }
  if (prune && !check) {
    const have = fs.existsSync(path.join(P.dir, 'factories')) ? fs.readdirSync(path.join(P.dir, 'factories')).map((f) => f.replace(/\.ts$/, '')) : [];
    for (const id of have) if (!needed.includes(id)) { for (const rel of figureFiles(id)) fs.rmSync(path.join(P.dir, rel), { force: true }); removed.push(id); changed = true; }
  }
  const slots = slotsSource({ places: (cfg.places ?? []).filter((p) => /^[a-z][a-z0-9]*$/.test(p)), chosen, named, intensity: Number.isFinite(Number(cfg.intensity)) ? Math.min(1, Math.max(0, Number(cfg.intensity))) : 0.5 });
  if (!fs.existsSync(P.slots) || fs.readFileSync(P.slots, 'utf8') !== slots) { if (!check) fs.writeFileSync(P.slots, slots); changed = true; }
  if (JSON.stringify(cfg.named ?? []) !== JSON.stringify(named)) { if (!check) fs.writeFileSync(P.cfg, JSON.stringify({ ...cfg, named }, null, 2) + '\n'); changed = true; }
  return { added, removed, changed, missing, hints, problems, count: needed.length, skipped: null };
}

/** Watches a project's source and keeps its figures in line while the dev server runs. Returns a function that stops it. */
export function watchFigures(root = process.cwd(), opts = {}, log = console.log) {
  let timer = null, busy = false, told = false;
  const run = () => {
    if (busy) return; busy = true;
    try {
      const r = syncFigures({ root, ...opts });
      if (r.skipped) { if (!told) log(`figures: ${r.skipped}`); told = true; }
      else {
        if (r.added.length) log(`figures: added ${r.added.join(', ')}`);
        for (const h of r.hints) log(`figures: not found: ${h}`);
      }
    } catch (e) { log(`figures: ${e.message}`); } finally { busy = false; }
  };
  run();
  let watcher = null, poll = null;
  const onChange = (_t, f) => { if (f && /(^|[\\/])components[\\/]fx[\\/]figures[\\/]/.test(String(f))) return; clearTimeout(timer); timer = setTimeout(run, 250); };
  try { watcher = fs.watch(path.join(root, 'src'), { recursive: true }, onChange); } catch { poll = setInterval(run, 3000); }
  return () => { watcher?.close(); if (poll) clearInterval(poll); clearTimeout(timer); };
}
