import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadConfig } from "../src/config.js";
import { createServer } from "../src/server.js";

const TOKEN = "t".repeat(32);
const start = async (env = {}) => {
  const config = loadConfig({ OPERATOR_TOKEN: TOKEN, NODE_ENV: "test", DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), "chaser-")), ...env });
  const server = createServer(config);
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  return { base: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((r) => server.close(r)) };
};

test("config refuses to start without a strong OPERATOR_TOKEN and rejects bad values", () => {
  assert.throws(() => loadConfig({}), /OPERATOR_TOKEN/);
  assert.throws(() => loadConfig({ OPERATOR_TOKEN: "short" }), /at least 24/);
  assert.throws(() => loadConfig({ OPERATOR_TOKEN: TOKEN, PORT: "99999" }), /PORT/);
  assert.throws(() => loadConfig({ OPERATOR_TOKEN: TOKEN, ALLOWED_SRC: "ok,BAD SRC" }), /ALLOWED_SRC/);
  assert.equal(loadConfig({ OPERATOR_TOKEN: TOKEN }).NODE_ENV, "production");
});

test("health endpoints answer, the page is served, unknown paths are 404", async (t) => {
  const s = await start(); t.after(s.close);
  assert.equal((await fetch(s.base + "/api/health/live")).status, 200);
  const health = await fetch(s.base + "/api/health");
  assert.deepEqual(await health.json(), { status: "ok", checks: { config: "ok" } });
  const page = await fetch(s.base + "/");
  assert.equal(page.status, 200);
  assert.match(await page.text(), /<h1>Chaser<\/h1>/);
  assert.equal((await fetch(s.base + "/nope")).status, 404);
});

test("every response carries a CSP that only allows the page's own origin", async (t) => {
  const s = await start(); t.after(s.close);
  for (const p of ["/", "/api/health", "/nope"]) {
    const csp = (await fetch(s.base + p)).headers.get("content-security-policy");
    assert.match(csp, /connect-src 'self'/, p);
    assert.match(csp, /default-src 'self'/, p);
    assert.ok(!/https?:\/\//.test(csp), "no third-party origin in the CSP");
  }
});

test("HSTS only in production", async (t) => {
  const dev = await start({ NODE_ENV: "development" }); t.after(dev.close);
  assert.equal((await fetch(dev.base + "/")).headers.get("strict-transport-security"), null);
  const prod = await start({ NODE_ENV: "production" }); t.after(prod.close);
  assert.ok((await fetch(prod.base + "/")).headers.get("strict-transport-security"));
});

test("static serving cannot escape the public directory", async (t) => {
  const s = await start(); t.after(s.close);
  for (const p of ["/../package.json", "/%2e%2e/package.json", "/..%2fpackage.json", "/%00", "/%E0%A4%A"]) {
    const r = await fetch(s.base + p);
    assert.equal(r.status, 404, p);
    assert.ok(!(await r.text()).includes('"name": "chaser"'), p);
  }
});

// Matches imports of I/O or server code and uses of browser or process APIs, not ordinary words inside message text.
const IMPURE = /(from\s+["']node:(fs|http|https|net|child_process|path|os)["'])|(from\s+["']\.\.\/(http|store))|\b(fetch|XMLHttpRequest|require)\s*\(|\b(localStorage|sessionStorage|document|window|process|globalThis)\./;

test("the purity check itself catches each kind of violation", () => {
  for (const bad of ['import fs from "node:fs";', 'const x = await fetch("/a");', "process.env.X", "document.title", "localStorage.setItem(1)", 'import s from "../store/events.js";']) {
    assert.ok(IMPURE.test(bad), bad);
  }
  assert.ok(!IMPURE.test("Please let me know if you need anything from me to process it."), "ordinary words are fine");
});

test("src/core stays pure: no I/O, HTTP or DOM access", () => {
  const dir = new URL("../src/core/", import.meta.url).pathname;
  for (const f of fs.readdirSync(dir).filter((n) => n.endsWith(".js"))) {
    const code = fs.readFileSync(path.join(dir, f), "utf8").split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
    assert.ok(!IMPURE.test(code), `${f} must not import I/O, HTTP or DOM code`);
  }
});
