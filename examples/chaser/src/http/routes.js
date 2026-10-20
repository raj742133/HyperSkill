import { serveStatic } from "./static.js";

class HttpError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}

/**
 * Request routing only. The product logic lives in src/core and runs in the browser.
 * The server serves the page and answers health checks: it stores nothing, counts nothing and accepts no input.
 */
export function createHandler({ publicDir, coreDir }) {
  const json = (res, status, body) => {
    const payload = JSON.stringify(body);
    res.writeHead(status, { "content-type": "application/json; charset=utf-8", "content-length": Buffer.byteLength(payload) });
    res.end(payload);
  };

  function handle(req, res) {
    const url = new URL(req.url, "http://localhost");
    const route = `${req.method} ${url.pathname}`;
    if (route === "GET /api/health/live") return json(res, 200, { status: "ok" });
    if (route === "GET /api/health") return json(res, 200, { status: "ok", checks: { config: "ok" } });
    if (req.method === "GET" && url.pathname.startsWith("/core/") && serveStatic(coreDir, url.pathname.slice("/core".length), res)) return;
    if (req.method === "GET" && serveStatic(publicDir, url.pathname, res)) return;
    throw new HttpError(404, "not_found", "Not found");
  }

  return (req, res) => {
    try { handle(req, res); } catch (err) {
      if (res.headersSent) return res.end();
      if (err instanceof HttpError) return json(res, err.status, { error: { code: err.code, message: err.message } });
      console.error(JSON.stringify({ level: "error", msg: "unhandled_error", error: err.message }));
      json(res, 500, { error: { code: "internal_error", message: "Something went wrong" } });
    }
  };
}
