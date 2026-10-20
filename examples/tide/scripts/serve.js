// Tiny static server for trying Tide locally and for the browser tests. Serves this folder only.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".svg": "image/svg+xml" };
// The same policy the deployed site sends: the page needs nothing but its own files and makes no requests of its own.
const CSP = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
const PUBLIC = new Set(["index.html", "styles.css", "app.js", "timer.js", "liquid.js", "favicon.svg"]);

/** One JSON line per request: id, method, path (the query string is dropped), status, milliseconds. Nothing from the visitor is logged. */
const log = (entry) => console.log(JSON.stringify({ level: "info", time: new Date().toISOString(), ...entry }));

/** Health that checks something: every file the page needs can be read. */
export function health(root = ROOT) {
  const missing = [...PUBLIC].filter((name) => { try { fs.accessSync(path.join(root, name), fs.constants.R_OK); return false; } catch { return true; } });
  return missing.length ? { code: 503, body: { status: "degraded", missing } } : { code: 200, body: { status: "ok", files: PUBLIC.size } };
}

export function createServer({ quiet = false } = {}) {
  return http.createServer((req, res) => {
    const started = performance.now(), id = crypto.randomUUID();
    const urlPath = req.url.split("?")[0];
    res.setHeader("x-request-id", id);
    res.on("finish", () => { if (!quiet) log({ id, method: req.method, path: urlPath, status: res.statusCode, ms: Math.round(performance.now() - started) }); });
    if (req.method === "GET" && urlPath === "/api/health/live") { res.writeHead(200, { "content-type": "application/json" }); return res.end(JSON.stringify({ status: "ok" })); }
    if (req.method === "GET" && urlPath === "/api/health") { const h = health(); res.writeHead(h.code, { "content-type": "application/json" }); return res.end(JSON.stringify(h.body)); }
    const name = urlPath === "/" ? "index.html" : urlPath.slice(1);
    if (req.method !== "GET" || !PUBLIC.has(name)) { res.writeHead(404, { "content-type": "text/plain" }); return res.end("not found"); }
    let body;
    try { body = fs.readFileSync(path.join(ROOT, name)); } catch { res.writeHead(404, { "content-type": "text/plain" }); return res.end("not found"); }
    res.writeHead(200, { "content-type": TYPES[path.extname(name)], "cache-control": "no-store", "x-content-type-options": "nosniff", "content-security-policy": CSP });
    res.end(body);
  });
}

/** PORT from the environment, or 4173. A bad value stops the server with a message that says what to fix. */
export function readPort(env = process.env) {
  const raw = env.PORT ?? "4173";
  const port = Number(raw);
  if (!/^\d+$/.test(raw) || port < 1 || port > 65535) throw new Error(`PORT must be a whole number from 1 to 65535 (got "${raw}")`);
  return port;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let port;
  try { port = readPort(); } catch (err) { console.error(err.message); process.exit(1); }
  createServer().listen(port, "127.0.0.1", () => console.log(`Tide: http://127.0.0.1:${port}/`));
}
