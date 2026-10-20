import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readPort } from "../scripts/serve.js";

test("PORT defaults to 4173 and a bad value is refused with a clear message", () => {
  assert.equal(readPort({}), 4173);
  assert.equal(readPort({ PORT: "8080" }), 8080);
  for (const bad of ["abc", "0", "70000", "-1", "80.5", ""]) assert.throws(() => readPort({ PORT: bad }), /PORT must be a whole number from 1 to 65535/, bad);
});

test("the server itself refuses to start on a bad PORT: exit code 1 and the message on stderr", () => {
  const r = spawnSync("node", ["scripts/serve.js"], { env: { ...process.env, PORT: "banana" }, encoding: "utf8", timeout: 5000 });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /PORT must be a whole number from 1 to 65535 \(got "banana"\)/);
});

test("the dev server answers health, the page, and a 404 for anything else", async (t) => {
  const { createServer } = await import("../scripts/serve.js");
  const server = createServer();
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  t.after(() => new Promise((r) => server.close(r)));
  const base = `http://127.0.0.1:${server.address().port}`;
  assert.deepEqual(await (await fetch(base + "/api/health")).json(), { status: "ok", files: 8 });
  assert.deepEqual(await (await fetch(base + "/api/health/live")).json(), { status: "ok" });
  const page = await fetch(base + "/");
  assert.equal(page.status, 200);
  assert.match(page.headers.get("content-security-policy"), /connect-src 'none'/);
  assert.equal((await fetch(base + "/../package.json")).status, 404);
  assert.equal((await fetch(base + "/nope.js")).status, 404);
});

test("every request gets an id, one JSON log line carries it, and nothing from the visitor is logged", async (t) => {
  const { createServer } = await import("../scripts/serve.js");
  const lines = [];
  const original = console.log;
  console.log = (line) => lines.push(line);
  const server = createServer();
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  t.after(() => new Promise((r) => server.close(r)));
  const base = `http://127.0.0.1:${server.address().port}`;
  let a, b;
  try {
    a = await fetch(base + "/?token=SECRET-TOKEN-VALUE&password=hunter2");
    b = await fetch(base + "/nope");
    await new Promise((r) => setTimeout(r, 50));
  } finally { console.log = original; }
  const idA = a.headers.get("x-request-id"), idB = b.headers.get("x-request-id");
  assert.match(idA, /^[0-9a-f-]{36}$/);
  assert.notEqual(idA, idB);
  const entries = lines.map((l) => JSON.parse(l));
  const ea = entries.find((e) => e.id === idA), eb = entries.find((e) => e.id === idB);
  assert.deepEqual([ea.method, ea.path, ea.status, eb.status], ["GET", "/", 200, 404]);
  assert.equal(typeof ea.ms, "number");
  const text = lines.join("\n");
  assert.ok(!/SECRET-TOKEN-VALUE|hunter2|password|token/i.test(text), "query strings and secrets are never logged");
});

test("health says degraded with the missing file names when the page's files are not all there", async () => {
  const { health } = await import("../scripts/serve.js");
  assert.deepEqual(health().body, { status: "ok", files: 8 });
  const fs = await import("node:fs"), os = await import("node:os"), path = await import("node:path");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tide-health-"));
  for (const f of ["index.html", "styles.css", "app.js", "timer.js", "favicon.svg", "privacy.html", "legal.css"]) fs.writeFileSync(path.join(dir, f), "x");
  const h = health(dir);
  assert.equal(h.code, 503);
  assert.deepEqual(h.body, { status: "degraded", missing: ["liquid.js"] });
});
