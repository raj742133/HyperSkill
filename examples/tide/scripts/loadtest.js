// Dependency-free load test of the Tide dev server: N virtual visitors each load the page and its five files, repeatedly.
// Usage: BASE=http://127.0.0.1:4173 USERS=50 SECONDS=10 node scripts/loadtest.js
// This measures scripts/serve.js on this computer. It says nothing about the deployed host, which is not load tested here.
const base = process.env.BASE ?? "http://127.0.0.1:4173";
const USERS = Number(process.env.USERS ?? 50), SECONDS = Number(process.env.SECONDS ?? 10);
const FILES = ["/", "/styles.css", "/app.js", "/timer.js", "/liquid.js", "/favicon.svg"];
const lat = [];
let errors = 0, requests = 0, bytes = 0;
const pct = (a, p) => (a.length ? [...a].sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor((p / 100) * a.length))] : NaN);
const deadline = Date.now() + SECONDS * 1000;
async function visitor() {
  while (Date.now() < deadline) {
    for (const f of FILES) {
      const t = performance.now();
      try { const r = await fetch(base + f); const b = await r.arrayBuffer(); bytes += b.byteLength; if (r.status !== 200) errors++; } catch { errors++; }
      lat.push(performance.now() - t); requests++;
    }
  }
}
const started = performance.now();
await Promise.all(Array.from({ length: USERS }, visitor));
const secs = (performance.now() - started) / 1000;
const out = { base, users: USERS, seconds: Number(secs.toFixed(1)), requests, requestsPerSecond: Math.round(requests / secs), errorRate: Number((errors / requests).toFixed(4)), p50ms: Number(pct(lat, 50).toFixed(2)), p95ms: Number(pct(lat, 95).toFixed(2)), p99ms: Number(pct(lat, 99).toFixed(2)), megabytes: Number((bytes / 1e6).toFixed(1)) };
console.log(JSON.stringify(out));
process.exit(errors ? 1 : 0);
