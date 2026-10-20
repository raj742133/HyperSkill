// Mutation check: break one line of logic at a time in a throwaway copy and confirm the unit tests fail.
// A mutation that SURVIVES means no test tells the broken code from the real code.
// Usage: node scripts/mutation-check.js        (exit 1 if any mutation survives)
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const MUTATIONS = [
  { name: "time counted by ticks instead of read from the deadline", file: "timer.js", from: "remaining = Math.min(cap, Math.max(0, endsAt - now()));", to: "remaining = Math.max(0, remaining - 1000);" },
  { name: "a clock set back lets the timer run past its full length", file: "timer.js", from: "Math.min(cap, Math.max(0, endsAt - now()))", to: "Math.max(0, endsAt - now())" },
  { name: "display rounds down, so 00:00 shows a second early", file: "timer.js", from: "Math.ceil(ms / 1000)", to: "Math.floor(ms / 1000)" },
  { name: "long break after every third focus session, not fourth", file: "timer.js", from: "focusDone % 4 === 0", to: "focusDone % 3 === 0" },
  { name: "a break counts as a finished focus session", file: "timer.js", from: 'if (mode === "focus") focusDone += 1;', to: "focusDone += 1;" },
  { name: "changing a length cuts a running session short", file: "timer.js", from: 'which === mode && status !== "running" && status !== "paused"', to: "which === mode" },
  { name: "starting after a finish does not restart the full length", file: "timer.js", from: 'if (status === "done") { remaining = total(); }', to: "" },
  { name: "focus length above 120 minutes accepted", file: "timer.js", from: "focus: [1, 120]", to: "focus: [1, 1200]" },
  { name: "unknown mode accepted", file: "timer.js", from: "if (!MODES[next]) throw", to: "if (false) throw" },
  { name: "short-break liquid too pale for white digits", file: "styles.css", from: "#a82a18", to: "#ffb0a0" },
];

const copy = fs.mkdtempSync(path.join(os.tmpdir(), "tide-mut-"));
fs.cpSync(root, copy, { recursive: true, filter: (s) => !/node_modules|\.hyperskill|\.git(\/|$)/.test(s) });
let bad = 0;
console.log("mutation".padEnd(66), "result");
for (const m of MUTATIONS) {
  const file = path.join(copy, m.file);
  const original = fs.readFileSync(file, "utf8");
  const n = original.split(m.from).length - 1;
  if (n !== 1) { console.log(m.name.padEnd(66), `NOT APPLICABLE: pattern matches ${n} times in ${m.file}, update this check`); bad++; continue; }
  fs.writeFileSync(file, original.replace(m.from, () => m.to));
  const r = spawnSync("node", ["--test", ...fs.readdirSync(path.join(copy, "tests")).filter((f) => f.endsWith(".test.js")).map((f) => `tests/${f}`)], { cwd: copy, encoding: "utf8" });
  fs.writeFileSync(file, original);
  const killed = r.status !== 0;
  if (!killed) bad++;
  console.log(m.name.padEnd(66), killed ? "killed by tests" : "SURVIVED  <-- no test catches this");
}
fs.rmSync(copy, { recursive: true, force: true });
console.log(bad ? `\n${bad} problem(s)` : `\nall ${MUTATIONS.length} mutations were caught`);
process.exit(bad ? 1 : 0);
