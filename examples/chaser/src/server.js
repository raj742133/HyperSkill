import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "./config.js";
import { securityHeaders } from "./http/headers.js";
import { createHandler } from "./http/routes.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(HERE, "..", "public");
const CORE_DIR = path.join(HERE, "core");

export function createServer(config) {
  const handler = createHandler({ publicDir: PUBLIC_DIR, coreDir: CORE_DIR });
  const headers = securityHeaders(config);
  return http.createServer((req, res) => {
    for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
    try { handler(req, res); } catch (err) {
      console.error(JSON.stringify({ level: "error", msg: "unhandled_error", error: err.message }));
      if (!res.headersSent) res.writeHead(500, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: { code: "internal_error", message: "Something went wrong" } }));
    }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let config;
  try { config = loadConfig(); } catch (e) { console.error(e.message); process.exit(1); }
  const server = createServer(config);
  server.listen(config.PORT, config.HOST, () => console.log(JSON.stringify({ level: "info", msg: "listening", host: config.HOST, port: config.PORT })));
  for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => server.close(() => process.exit(0)));
}
