// Mutation check: break one line of logic at a time in a throwaway copy and confirm the unit tests fail.
// A mutation that SURVIVES means no test distinguishes the broken code from the real code.
// Usage: node scripts/mutation-check.js        (exit 1 if an unexpected mutation survives)
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const MUTATIONS = [
  { name: "other user's row answers 403 instead of 404", file: "src/services/assignments.js", from: 'new HttpError(404, "not_found", "Not found"); } //', to: 'new HttpError(403, "forbidden", "Forbidden"); } //' },
  { name: "login accepts a wrong password", file: "src/services/users.js", from: "if (!row || !ok)", to: "if (!row)" },
  { name: "session id not rotated on login", file: "src/routes/index.js", from: "await regenerate(req); // new session id on login: prevents session fixation", to: "" },
  { name: "minimum password length dropped", file: "src/routes/schemas.js", from: '.min(10, "Password must be at least 10 characters")', to: ".min(1)" },
  { name: "list ignores due-date order", file: "src/services/assignments.js", from: "ORDER BY done, due_date, id LIMIT", to: "ORDER BY id LIMIT" },
  { name: "request log records the stripped router path", file: "src/app.js", from: 'path: req.originalUrl.split("?")[0]', to: "path: req.path" },
  { name: "CSRF header no longer required", file: "src/middleware/security.js", from: 'if (req.get("x-requested-by") !== "duesoon")', to: "if (false)" },
  { name: "per-user assignment cap removed", file: "src/services/assignments.js", from: "if (count >= MAX_PER_USER)", to: "if (count > 1e9)" },
  { name: "account deletion no longer cascades", file: "src/db/migrations/001_init.sql", from: " ON DELETE CASCADE", to: "" },
  { name: "weak SESSION_SECRET accepted", file: "src/config.js", from: "z.string().min(32,", to: "z.string().min(1," },
  { name: "password byte limit removed", file: "src/routes/schemas.js", from: "Buffer.byteLength(s) <= 72", to: "true" },
  { name: "overdue starts a day late (client)", file: "public/due.js", from: "if (d < 0) return { kind: \"overdue\"", to: "if (d < -1) return { kind: \"overdue\"" },
  // Defence in depth: every query is ALSO scoped by user_id, so weakening can() alone changes no behaviour.
  { name: "can() always says yes (queries still scope by user_id)", file: "src/services/can.js", from: "resource != null && resource.user_id === user.id", to: "true", expectSurvive: true },
];

const copy = fs.mkdtempSync(path.join(os.tmpdir(), "duesoon-mut-"));
fs.cpSync(root, copy, { recursive: true, filter: (s) => !/node_modules|\.hyperskill|\.taste-skill|\.git(\/|$)/.test(s) });
fs.symlinkSync(path.join(root, "node_modules"), path.join(copy, "node_modules"));

let bad = 0;
console.log("mutation".padEnd(62), "result");
for (const m of MUTATIONS) {
  const file = path.join(copy, m.file);
  const original = fs.readFileSync(file, "utf8");
  if (!original.includes(m.from)) { console.log(m.name.padEnd(62), "NOT APPLICABLE: source text moved, update this check"); bad++; continue; }
  fs.writeFileSync(file, original.replace(m.from, m.to));
  const r = spawnSync("node", ["--disable-warning=ExperimentalWarning", "--test", ...fs.readdirSync(path.join(copy, "tests")).filter((f) => f.endsWith(".test.js")).map((f) => `tests/${f}`)], { cwd: copy, encoding: "utf8" });
  fs.writeFileSync(file, original);
  const killed = r.status !== 0;
  const ok = killed !== Boolean(m.expectSurvive);
  if (!ok) bad++;
  console.log(m.name.padEnd(62), killed ? "killed by tests" : m.expectSurvive ? "survived (expected, see comment)" : "SURVIVED  <-- no test catches this");
}
fs.rmSync(copy, { recursive: true, force: true });
console.log(bad ? `\n${bad} problem(s)` : `\nall ${MUTATIONS.length} mutations behaved as expected`);
process.exit(bad ? 1 : 0);
