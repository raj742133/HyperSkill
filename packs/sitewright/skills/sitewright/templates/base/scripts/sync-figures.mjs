#!/usr/bin/env node
// Keeps src/components/fx/figures in line with your code: every <Figure name="padlock" /> is found, and the figure's files are copied in from
// the library that ships with the project (scripts/lib/figures). Nothing is removed unless you ask (--prune).
//
//   npm run figures               bring in what is missing
//   npm run figures -- --check    change nothing, fail if something is missing        --prune   drop figures the code no longer uses
// It runs by itself before `npm run build` (and stops the build if a figure name does not exist), and while `npm run dev` runs.
import { syncFigures, libraryFigures } from './lib/figures.mjs';

const args = process.argv.slice(2);
const flag = (f) => args.includes(f);
const r = syncFigures({ root: process.cwd(), check: flag('--check'), prune: flag('--prune') });
if (r.skipped) { console.log(`figures: ${r.skipped}`); process.exit(0); }
if (r.added.length) console.log(`figures: ${flag('--check') ? 'missing' : 'added'} ${r.added.join(', ')}`);
if (r.removed.length) console.log(`figures: removed ${r.removed.join(', ')}`);
if (r.hints.length) {
  for (const h of r.hints) console.error(`figures: not found: ${h}`);
  console.error(`figures: the ${libraryFigures().length} figures are listed at https://sitewright-skill.vercel.app/demo/effects/ (or ask Claude)`);
  process.exit(flag('--build') || flag('--check') ? 1 : 0);
}
if (flag('--check') && r.changed) process.exit(1);
if (!r.added.length && !r.removed.length) console.log(`figures: ${r.count} ready`);
