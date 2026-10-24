// The component library: small interactive React components (buttons, inputs, cards, loaders, charts) that a page can import from
// '@/components/fx/ui'. Like the rest of the effects layer they are original, dependency-free code (React + CSS + SVG only), respect
// prefers-reduced-motion, work with touch and keyboard, and are only copied into a project when chosen.
//
// The entries live in scripts/ui/*.json, one file per group, so a group can be added without touching this file:
//   { "id": "hold-to-confirm", "label": "Hold to confirm", "desc": "…", "source": "Kitchen", "files": ["HoldToConfirm.tsx"], "css": ["ui-hold-to-confirm"],
//     "use": "Destructive actions: delete a record, revoke an invite." }
// `files` are relative to templates/fx/ui/ and `css` to templates/fx/css/. Every component file default-exports the component (its name is the
// file name) and also exports `Demo`, a self-contained example the /effects gallery renders.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.join(HERE, 'ui');

export const UI = {};
for (const f of fs.existsSync(DIR) ? fs.readdirSync(DIR).filter((x) => x.endsWith('.json')).sort() : []) {
  const group = f.replace(/\.json$/, '');
  for (const e of JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'))) {
    if (UI[e.id]) throw new Error(`ui: duplicate component id "${e.id}" (${f})`);
    UI[e.id] = { css: [], use: '', group, ...e, component: e.files[0].replace(/\.tsx?$/, '') };
  }
}

export const UI_GROUPS = [...new Set(Object.values(UI).map((e) => e.group))];

/** `components: "all" | "none" | ["id", …]` -> a validated list of ids. */
export function resolveComponents(input) {
  if (input === undefined || input === null || input === '' || input === 'none' || input === false) return [];
  const ids = input === 'all' ? Object.keys(UI) : Array.isArray(input) ? input : String(input).split(',').map((s) => s.trim()).filter(Boolean);
  for (const id of ids) if (!UI[id]) throw new Error(`effects.components: "${id}" is not a component. Components: ${Object.keys(UI).join(', ')}`);
  return [...new Set(ids)];
}

export function uiMenu() {
  const lines = ['Components: small interactive pieces you import from \'@/components/fx/ui\'.   --components all | id,id,...', ''];
  for (const g of UI_GROUPS) {
    lines.push(`  ${g}`);
    for (const [id, e] of Object.entries(UI)) if (e.group === g) lines.push(`    ${id.padEnd(22)} ${e.desc}${e.use ? ` Use: ${e.use}` : ''}`);
  }
  return lines.join('\n');
}
