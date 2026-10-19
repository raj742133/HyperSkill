// Break one promise at a time and confirm a test notices. Usage: CHROME_PATH=... node scripts/mutation-check.js
// Each mutant is a one-line change to a source file; the check fails if the named test command still passes.
import fs from "node:fs";
import { spawnSync } from "node:child_process";

const UNIT = "node --test tests/*.test.js";
const E2E = "node --test --test-concurrency=1 e2e/*.e2e.js";
const mutants = [
  { name: "the form's client name is sent to the server with the counter", file: "public/app.js", from: "api(\"/api/event\", { event, kind, src, token })", to: "api(\"/api/event\", { event, kind, src, token, client: document.getElementById(\"client\").value })", cmd: E2E },
  { name: "the final message threatens legal action", file: "src/core/messages.js", from: "I will have to pause further work until this is settled.", to: "I will take legal action.", cmd: UNIT },
  { name: "a past pay-by date is accepted", file: "src/core/validate.js", from: "daysBetween(today, raw.deadline) < 0", to: "daysBetween(today, raw.deadline) < -100000", cmd: UNIT },
  { name: "bots are counted", file: "src/http/routes.js", from: "if (BOT_UA.test(req.headers[\"user-agent\"] ?? \"\")) return ignored(\"bot\");", to: "", cmd: UNIT },
  { name: "duplicate events are counted again", file: "src/http/routes.js", from: "if (t.seen.has(key)) return ignored(\"duplicate\");", to: "", cmd: UNIT },
  { name: "the owner's and friends' visits count toward the decision", file: "src/http/routes.js", from: "const DECISION_EXCLUDED = [\"me\", \"friends\"];", to: "const DECISION_EXCLUDED = [];", cmd: UNIT },
  { name: "stats answers without the operator token", file: "src/http/routes.js", from: "if (!m || !sameSecret(m[1], config.OPERATOR_TOKEN)) {", to: "if (false) {", cmd: UNIT },
  { name: "unknown traffic sources are stored as typed", file: "src/http/routes.js", from: "config.ALLOWED_SRC.includes(v) ? v : \"none\"", to: "true ? v : \"none\"", cmd: UNIT },
  { name: "the waitlist opens without operator details", file: "src/config.js", from: "Boolean(cfg.OPERATOR_NAME && cfg.OPERATOR_CONTACT && cfg.TEST_END_DATE)", to: "true", cmd: UNIT },
  { name: "the honeypot is ignored", file: "src/http/routes.js", from: "if (typeof body.website === \"string\" && body.website !== \"\") return json(res, 202, { ok: true });", to: "", cmd: UNIT },
  { name: "static files can be read outside public/", file: "src/http/static.js", from: "if (file !== root && !file.startsWith(root + path.sep)) return false;", to: "", cmd: UNIT },
  { name: "the CSP allows other sites to be contacted", file: "src/http/headers.js", from: "connect-src 'self'", to: "connect-src *", cmd: UNIT },
  { name: "a trusted-proxy header is believed when no proxy is configured", file: "src/http/limits.js", from: "if (trustProxy > 0) {", to: "if (true) {", cmd: UNIT },
  { name: "amounts above Rs 100 crore are accepted", file: "src/core/format.js", from: "paise > MAX_RUPEES * 100", to: "false", cmd: UNIT },
  { name: "a not-yet-due invoice is called overdue", file: "src/core/messages.js", from: "const overdue = days > 0;", to: "const overdue = true;", cmd: UNIT },
  { name: "the UPI ID is not previewed or checked", file: "src/core/validate.js", from: "!UPI_ID.test(value.pay) && !HTTPS_LINK.test(value.pay)", to: "false", cmd: UNIT },
];

let bad = 0;
for (const m of mutants) {
  const original = fs.readFileSync(m.file, "utf8");
  if (!original.includes(m.from)) { console.log(`MISSING  ${m.name} (pattern not found in ${m.file})`); bad++; continue; }
  fs.writeFileSync(m.file, original.replace(m.from, m.to));
  const r = spawnSync("sh", ["-c", m.cmd], { encoding: "utf8", env: process.env });
  fs.writeFileSync(m.file, original);
  const killed = r.status !== 0;
  console.log(`${killed ? "killed  " : "SURVIVED"}  ${m.name}`);
  if (!killed) bad++;
}
console.log(bad ? `\n${bad} problem(s)` : "\nall mutants killed");
process.exit(bad ? 1 : 0);
