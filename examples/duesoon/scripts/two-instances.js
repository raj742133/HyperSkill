// Shows what breaks when two instances run side by side on one database file.
// Usage: node scripts/two-instances.js   (starts two servers on :3301 and :3302 sharing one SQLite file)
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "duesoon-two-"));
const env = { ...process.env, NODE_ENV: "development", SESSION_SECRET: "s".repeat(40), DB_PATH: path.join(dir, "shared.db"), BCRYPT_ROUNDS: "4", LOG_LEVEL: "error" };
const start = (port) => spawn("node", ["--disable-warning=ExperimentalWarning", "src/server.js"], { env: { ...env, PORT: String(port) }, stdio: "ignore" });
const procs = [start(3301), start(3302)];
const H = { "content-type": "application/json", "x-requested-by": "duesoon" };
const wait = async (port) => { for (let i = 0; i < 50; i++) { try { if ((await fetch(`http://127.0.0.1:${port}/api/health/live`)).ok) return; } catch {} await new Promise((r) => setTimeout(r, 100)); } throw new Error("server did not start"); };
try {
  await Promise.all([wait(3301), wait(3302)]);
  const a = "http://127.0.0.1:3301", b = "http://127.0.0.1:3302";
  const r = await fetch(a + "/api/auth/signup", { method: "POST", headers: H, body: JSON.stringify({ email: "two@campusmail.in", password: "correct-horse-1" }) });
  const cookie = r.headers.getSetCookie()[0].split(";")[0];
  const onA = await fetch(a + "/api/me", { headers: { ...H, cookie } });
  const onB = await fetch(b + "/api/me", { headers: { ...H, cookie } });
  console.log(`signed up on A: ${r.status}; same cookie on A: ${onA.status}; same cookie on B: ${onB.status}`);
  const loginB = await fetch(b + "/api/auth/login", { method: "POST", headers: H, body: JSON.stringify({ email: "two@campusmail.in", password: "correct-horse-1" }) });
  console.log(`the account itself is shared through the database (login on B: ${loginB.status}), but sessions are per process`);
  console.log(onB.status === 401 ? "RESULT: a user signed in on one instance is signed out on the other. Not multi-instance ready: needs a shared session store." : "RESULT: sessions work across instances");
  process.exitCode = onB.status === 401 ? 2 : 0;
} finally { procs.forEach((p) => p.kill()); fs.rmSync(dir, { recursive: true, force: true }); }
