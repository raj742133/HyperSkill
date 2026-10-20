// Runs two copies of the dev server side by side and checks they behave the same, since a visitor could reach either.
// Usage: node scripts/two-instances.js   (ports 4211 and 4212). Exit 1 if anything differs.
import { spawn } from "node:child_process";
import crypto from "node:crypto";

const ports = [4211, 4212];
const procs = ports.map((port) => spawn("node", ["scripts/serve.js"], { env: { ...process.env, PORT: String(port) }, stdio: "ignore" }));
const wait = async (port) => { for (let i = 0; i < 50; i++) { try { if ((await fetch(`http://127.0.0.1:${port}/api/health/live`)).ok) return; } catch {} await new Promise((r) => setTimeout(r, 100)); } throw new Error(`no answer on ${port}`); };
const sha = (buf) => crypto.createHash("sha256").update(Buffer.from(buf)).digest("hex").slice(0, 12);
let bad = 0;
try {
  await Promise.all(ports.map(wait));
  for (const f of ["/", "/styles.css", "/app.js", "/timer.js", "/liquid.js", "/favicon.svg", "/api/health"]) {
    const [a, b] = await Promise.all(ports.map(async (p) => { const r = await fetch(`http://127.0.0.1:${p}${f}`); return { status: r.status, hash: sha(await r.arrayBuffer()) }; }));
    const same = a.status === b.status && a.hash === b.hash;
    if (!same) bad++;
    console.log(f.padEnd(14), same ? `same (${a.status}, ${a.hash})` : `DIFFERENT ${JSON.stringify(a)} vs ${JSON.stringify(b)}`);
  }
  // Interleave requests across both, as a load balancer would, and expect no error.
  const mixed = await Promise.all(Array.from({ length: 200 }, (_, i) => fetch(`http://127.0.0.1:${ports[i % 2]}/`).then((r) => r.status)));
  const errors = mixed.filter((s) => s !== 200).length;
  if (errors) bad++;
  console.log(`200 interleaved requests: ${errors} errors`);
  console.log("state: none (Tide keeps nothing on the server, so there is nothing to share, sync or conflict)");
} finally { procs.forEach((p) => p.kill()); }
console.log(bad ? `\n${bad} problem(s)` : "\ntwo instances behave identically");
process.exit(bad ? 1 : 0);
