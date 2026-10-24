#!/usr/bin/env node
// Keeps src/components/icons/icons.data.json in line with your code: every <Icon name="..." />, <Icon for="..." />, icon: "..." and
// `// icons: a, b` is found, and any icon that is not there yet is brought in (from the pack that ships with the project, an installed
// @iconify-json/<set>, or the Iconify service). Nothing is removed unless you ask (--prune): a name built at run time can't be seen.
//
//   npm run icons               bring in what is missing
//   npm run icons -- --check    change nothing, fail if something is missing        --prune   drop icons the code no longer uses
//   npm run icons -- --offline  never use the network      --allow-license mdi    allow a set whose licence is not for products
// It runs by itself before `npm run build` (and stops the build if an icon cannot be found), and while `npm run dev` runs.
import { syncIcons } from './lib/icons.mjs';

const args = process.argv.slice(2);
const flag = (f) => args.includes(f);
const valueOf = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : undefined; };
const r = await syncIcons({
  root: process.cwd(), offline: flag('--offline'), prune: flag('--prune'), check: flag('--check'),
  allow: valueOf('--allow-license') ? valueOf('--allow-license').split(',') : [],
});
for (const n of r.notes) console.log(`icons: note: ${n}`);
for (const n of r.noIcon) console.log(`icons: nothing fits ${n}; name an icon instead, or add the word to icons.map in src/content/site.json`);
if (r.added.length) console.log(`icons: ${flag('--check') ? 'missing' : 'added'} ${r.added.join(', ')}`);
if (r.removed.length) console.log(`icons: removed ${r.removed.join(', ')}`);
if (r.hints.length || r.problems.length) {
  for (const h of r.hints) console.error(`icons: not found: ${h}`);
  for (const p of r.problems) console.error(`icons: ${p}`);
  if (r.hints.length) console.error('icons: find a name at https://sitewright-skill.vercel.app/icons, with  npx better-icons search <word>,  or ask Claude');
  process.exit(flag('--build') || flag('--check') ? 1 : 0);
}
if (flag('--check') && r.changed) process.exit(1);
if (!r.added.length && !r.removed.length) console.log(`icons: ${r.count} ready`);
