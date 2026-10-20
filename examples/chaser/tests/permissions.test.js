import { test } from "node:test";
import assert from "node:assert/strict";
import { loadConfig } from "../src/config.js";
import { createServer } from "../src/server.js";

async function start() {
  const server = createServer(loadConfig({ NODE_ENV: "test" }));
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  return { base: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((r) => server.close(r)) };
}

// The table from docs/permissions.md: [method, path, expected status]. Every caller is anonymous and nothing needs a login.
const MATRIX = [
  ["GET", "/", 200],
  ["GET", "/styles.css", 200],
  ["GET", "/app.js", 200],
  ["GET", "/core/index.js", 200],
  ["GET", "/favicon.svg", 200],
  ["GET", "/api/health", 200],
  ["GET", "/api/health/live", 200],
  // The server takes no input and keeps no data: these routes existed in the measuring version and must stay gone.
  ["POST", "/api/event", 404],
  ["POST", "/api/waitlist", 404],
  ["GET", "/api/stats", 404],
  ["GET", "/api/config", 404],
  ["GET", "/api/admin", 404],
  ["DELETE", "/", 404],
  ["PUT", "/api/health", 404],
];

test("every route answers as docs/permissions.md says", async (t) => {
  const s = await start(); t.after(s.close);
  for (const [method, path, want] of MATRIX) {
    const r = await fetch(s.base + path, { method, headers: { "content-type": "application/json" }, body: method === "GET" ? undefined : "{}" });
    assert.equal(r.status, want, `${method} ${path}`);
  }
});

test("the page makes no calls to the server after it loads: nothing in the front end can send data", async () => {
  const fs = await import("node:fs");
  const code = fs.readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
  assert.ok(!/\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket|EventSource/.test(code), "app.js must not make network calls");
  assert.ok(!/localStorage|sessionStorage|document\.cookie|indexedDB/.test(code), "app.js must not store anything");
});
