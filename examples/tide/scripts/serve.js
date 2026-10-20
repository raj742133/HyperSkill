// Tiny static server for trying Tide locally and for the browser tests. Serves this folder only.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".svg": "image/svg+xml" };
const PUBLIC = new Set(["index.html", "styles.css", "app.js", "timer.js", "liquid.js", "favicon.svg"]);

export function createServer() {
  return http.createServer((req, res) => {
    const name = req.url.split("?")[0] === "/" ? "index.html" : req.url.split("?")[0].slice(1);
    if (req.method !== "GET" || !PUBLIC.has(name)) { res.writeHead(404, { "content-type": "text/plain" }); return res.end("not found"); }
    const body = fs.readFileSync(path.join(ROOT, name));
    res.writeHead(200, { "content-type": TYPES[path.extname(name)], "cache-control": "no-store", "x-content-type-options": "nosniff" });
    res.end(body);
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT ?? 4173);
  createServer().listen(port, "127.0.0.1", () => console.log(`Tide: http://127.0.0.1:${port}/`));
}
