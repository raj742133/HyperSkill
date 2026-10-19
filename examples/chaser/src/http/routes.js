import { serveStatic } from "./static.js";

/** Request routing only. Product logic lives in src/core, disk access in src/store. */
export function createHandler({ config, publicDir }) {
  return (req, res) => {
    const url = new URL(req.url, "http://localhost");
    const json = (status, body) => {
      const payload = JSON.stringify(body);
      res.writeHead(status, { "content-type": "application/json; charset=utf-8", "content-length": Buffer.byteLength(payload) });
      res.end(payload);
    };
    if (req.method === "GET" && url.pathname === "/api/health/live") return json(200, { status: "ok" });
    if (req.method === "GET" && url.pathname === "/api/health") return json(200, { status: "ok", checks: { config: "ok" } });
    if (req.method === "GET" && serveStatic(publicDir, url.pathname, res)) return;
    json(404, { error: { code: "not_found", message: "Not found" } });
  };
}
