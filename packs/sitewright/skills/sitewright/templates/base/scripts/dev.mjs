#!/usr/bin/env node
// `npm run dev`: the Next.js dev server, plus a watcher that keeps your icons and figures in line with your code, so an <Icon name="rocket" />
// or <Figure name="padlock" /> you just typed shows up as soon as you save. Everything else is plain `next dev` (extra arguments are passed on).
// The server starts first; the first look at your icons and figures happens beside it, so a slow network never delays it.
import { spawn } from 'node:child_process';
import { watchProject } from './lib/icons.mjs';
import { watchFigures } from './lib/figures.mjs';

const win = process.platform === 'win32';
const child = spawn(win ? 'npx.cmd' : 'npx', ['next', 'dev', ...process.argv.slice(2)], { stdio: 'inherit', shell: win });
let stopIcons = () => {}, stopFigures = () => {};
watchProject(process.cwd(), {}, (m) => console.log(m)).then((stop) => { stopIcons = stop; }).catch((e) => console.log(`icons: watcher off (${e.message})`));
try { stopFigures = watchFigures(process.cwd(), {}, (m) => console.log(m)); } catch (e) { console.log(`figures: watcher off (${e.message})`); }
child.on('exit', (code) => { stopIcons(); stopFigures(); process.exit(code ?? 0); });
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => child.kill(sig));
