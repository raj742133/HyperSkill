// Break one promise at a time and confirm a test notices. Usage: CHROME_PATH=... node scripts/mutation-check.js
// Each mutant is a small change to one source file; the check fails if the named test command still passes.
// Every edit must match exactly once, so a pattern that also appears in a comment cannot silently mutate the wrong text.
import fs from "node:fs";
import { spawnSync } from "node:child_process";

const UNIT = "node --test tests/*.test.js";
const E2E = "node --test --test-concurrency=1 e2e/*.e2e.js";
const mutants = [
  { name: "the final message threatens legal action", file: "src/core/messages.js", from: "I will have to pause further work until this is settled.", to: "I will take legal action.", cmd: UNIT },
  { name: "a past pay-by date is accepted", file: "src/core/validate.js", from: "daysBetween(today, raw.deadline) < 0", to: "daysBetween(today, raw.deadline) < -100000", cmd: UNIT },
  { name: "static files can be read outside public/", file: "src/http/static.js", from: "if (file !== root && !file.startsWith(root + path.sep)) return false;", to: "", cmd: UNIT },
  { name: "the CSP allows other sites to be contacted", file: "src/http/headers.js", from: "img-src 'self'; connect-src 'none'", to: "img-src 'self'; connect-src *", cmd: UNIT },
  { name: "amounts above Rs 100 crore are accepted", file: "src/core/format.js", from: "paise > MAX_RUPEES * 100", to: "false", cmd: UNIT },
  { name: "a not-yet-due invoice is called overdue", file: "src/core/messages.js", from: "const overdue = days > 0;", to: "const overdue = true;", cmd: UNIT },
  { name: "the UPI ID is not previewed or checked", file: "src/core/validate.js", from: "!UPI_ID.test(value.pay) && !HTTPS_LINK.test(value.pay)", to: "false", cmd: UNIT },
  { name: "the page starts sending the form to the server", file: "public/app.js", from: "$(\"deadline\").min = todayLocal();", to: "$(\"deadline\").min = todayLocal(); fetch(\"/api/x\", { method: \"POST\", body: JSON.stringify({ c: $(\"client\").value }) });", cmd: E2E },
  { name: "the server accepts a POST to a removed measuring route", file: "src/http/routes.js", from: "if (route === \"GET /api/health/live\")", to: "if (req.method === \"POST\") return json(res, 202, { ok: true });\n    if (route === \"GET /api/health/live\")", cmd: UNIT },
  { name: "a phone number alone is accepted as a UPI ID", file: "src/core/validate.js", from: "/^\\+?(91)?[\\s-]?\\d{10}$/.test(value.pay)", to: "false", cmd: UNIT },
  { name: "the greeting ignores what you call them", file: "src/core/messages.js", from: "v.call || v.client", to: "v.client", cmd: UNIT },
];

let bad = 0;
for (const m of mutants) {
  const original = fs.readFileSync(m.file, "utf8");
  const edits = m.edits ?? [[m.from, m.to]];
  const counts = edits.map(([from]) => original.split(from).length - 1);
  if (counts.some((n) => n !== 1)) { console.log(`MISSING   ${m.name} (each pattern must match exactly once in ${m.file}; matches: ${counts})`); bad++; continue; }
  let mutated = original;
  for (const [from, to] of edits) mutated = mutated.replace(from, () => to);
  fs.writeFileSync(m.file, mutated);
  const r = spawnSync("sh", ["-c", m.cmd], { encoding: "utf8", env: process.env });
  fs.writeFileSync(m.file, original);
  const killed = r.status !== 0;
  console.log(`${killed ? "killed  " : "SURVIVED"}  ${m.name}`);
  if (!killed) bad++;
}
console.log(bad ? `\n${bad} problem(s)` : "\nall mutants killed");
process.exit(bad ? 1 : 0);
