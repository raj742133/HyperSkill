// Shared by the icon and figure syncs: walking a project's source and reading JSX tags. Plain Node, no dependencies, and copied into every
// generated project next to icons.mjs and figures.mjs.
import fs from 'node:fs';
import path from 'node:path';

const SKIP_DIRS = new Set(['node_modules', '.next', '.git']);
export const SCAN_EXT = /\.(tsx?|jsx?|mjs|cjs|json|mdx?)$/;

/** Every source file under `dir`, skipping node_modules and any folder `skip(fullPath)` says to. */
const KIT_DIR = /[\\/]components[\\/]fx[\\/]ui$/;

export function* walkSrc(dir, skip = () => false) {
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    // the kit's own components (src/components/fx/ui) are not the project's code: they carry names like icon: 'spinner' that mean something else
    if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name) && !KIT_DIR.test(p) && !skip(p)) yield* walkSrc(p, skip); }
    else if (SCAN_EXT.test(e.name)) yield p;
  }
}

/** A file's text, or null when it is unreadable or too big to be hand-written source. */
export function readSource(file) {
  try { if (fs.statSync(file).size > 400_000) return null; return fs.readFileSync(file, 'utf8'); } catch { return null; }
}

/** The text of a JSX tag that starts at `i` (just after "<Name"), up to its closing ">" - braces and quotes respected. */
export function readTag(src, i) {
  let depth = 0, q = null;
  for (let j = i; j < Math.min(src.length, i + 600); j++) {
    const c = src[j];
    if (q) { if (c === q && src[j - 1] !== '\\') q = null; continue; }
    if (c === '"' || c === "'" || c === '`') { q = c; continue; }
    if (c === '{') depth++;
    else if (c === '}') depth--;
    else if (c === '>' && depth === 0) return src.slice(i, j);
  }
  return src.slice(i, i + 600);
}

/** The quoted strings inside a JSX expression such as {ok ? 'check' : 'x'} (template strings with ${} are skipped: they are built at run time). */
export const literals = (expr) => [...expr.matchAll(/["'`]([^"'`$\\]+)["'`]/g)].map((m) => m[1]);

/** The value of a JSX attribute in a tag's text, as every literal it could be: name="a", name='a' or name={cond ? 'a' : 'b'}. */
export function attrValues(tag, attr) {
  const m = new RegExp(`\\b${attr}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|\\{([^{}]*)\\})`).exec(tag);
  if (!m) return [];
  return m[3] !== undefined ? literals(m[3]) : [m[1] ?? m[2]];
}

/** Closest names to a mistyped one (edit distance, or one containing the other). */
export function closest(name, names, limit = 3) {
  const lev = (a, b) => { const d = Array.from({ length: a.length + 1 }, (_, i) => [i]); for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return d[a.length][b.length]; };
  return [...new Set(names)].map((n) => ({ n, d: n.includes(name) || name.includes(n) ? 1 : lev(name, n) })).filter((x) => x.d <= Math.max(2, Math.floor(name.length / 4))).sort((x, y) => x.d - y.d || x.n.localeCompare(y.n)).slice(0, limit).map((x) => x.n);
}
