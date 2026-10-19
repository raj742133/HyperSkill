// Dependency-free load test: N virtual students, each signs in once, then keeps listing assignments and occasionally adds one.
// Usage: BASE=http://127.0.0.1:3200 USERS=50 SECONDS=20 node scripts/loadtest.js
// Reports p50/p95/p99 per request kind. Sign-in cost (bcrypt) is reported separately from the steady-state list requests.
const base = process.env.BASE ?? "http://127.0.0.1:3000";
const USERS = Number(process.env.USERS ?? 50);
const SECONDS = Number(process.env.SECONDS ?? 20);
const RAMP = Number(process.env.RAMP_SECONDS ?? 5);
const SEED_ROWS = Number(process.env.SEED_ROWS ?? 30);
const H = { "content-type": "application/json", "x-requested-by": "duesoon" };
const lat = { signup: [], list: [], add: [] };
let errors = 0, requests = 0;

async function timed(kind, f) {
  const t = performance.now();
  try {
    const res = await f();
    lat[kind].push(performance.now() - t);
    requests++;
    if (res.status >= 400) errors++;
    return res;
  } catch { errors++; requests++; return null; }
}
const pct = (a, p) => (a.length ? [...a].sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor((p / 100) * a.length))] : NaN);

async function student(i, deadline) {
  const email = `load${i}-${Date.now()}@campusmail.in`;
  const s = await timed("signup", () => fetch(base + "/api/auth/signup", { method: "POST", headers: H, body: JSON.stringify({ email, password: "load-test-password-1" }) }));
  if (!s || s.status !== 201) return;
  const cookie = s.headers.getSetCookie()[0].split(";")[0];
  const h = { ...H, cookie };
  for (let k = 0; k < SEED_ROWS; k++) await fetch(base + "/api/assignments", { method: "POST", headers: h, body: JSON.stringify({ title: `Task ${k}`, course: "CS101", dueDate: `2026-12-${String(1 + (k % 28)).padStart(2, "0")}` }) });
  while (performance.now() < deadline) {
    await timed("list", () => fetch(base + "/api/assignments?limit=50", { headers: h }));
    if (Math.random() < 0.1) await timed("add", () => fetch(base + "/api/assignments", { method: "POST", headers: h, body: JSON.stringify({ title: "Extra", dueDate: "2026-12-15" }) }));
    await new Promise((r) => setTimeout(r, 50 + Math.random() * 100)); // think time
  }
}

const start = performance.now();
const deadline = start + (RAMP + SECONDS) * 1000;
const jobs = [];
for (let i = 0; i < USERS; i++) { jobs.push(new Promise((r) => setTimeout(r, (i / USERS) * RAMP * 1000)).then(() => student(i, deadline))); }
await Promise.all(jobs);
const secs = (performance.now() - start) / 1000;
console.log(`${USERS} users, ${SECONDS}s steady after ${RAMP}s ramp, ${SEED_ROWS} rows each: ${requests} requests in ${secs.toFixed(1)}s (${(requests / secs).toFixed(0)}/s), errors ${errors}`);
for (const [k, v] of Object.entries(lat)) console.log(k.padEnd(7), `n=${String(v.length).padStart(6)}  p50 ${pct(v, 50).toFixed(1)} ms  p95 ${pct(v, 95).toFixed(1)} ms  p99 ${pct(v, 99).toFixed(1)} ms`);
process.exit(errors ? 1 : 0);
