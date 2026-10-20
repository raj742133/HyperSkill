import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadConfig } from "../src/config.js";
import { createServer } from "../src/server.js";
import { createEventStore } from "../src/store/events.js";
import { createWaitlistStore } from "../src/store/waitlist.js";

const TOKEN = "p".repeat(32);
const UA = "Mozilla/5.0 (X11; Linux) Chrome/120";
async function start() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "chaser-perm-"));
  const server = createServer(loadConfig({ OPERATOR_TOKEN: TOKEN, NODE_ENV: "test", DATA_DIR: dir, OPERATOR_NAME: "Op", OPERATOR_CONTACT: "op@example.org", TEST_END_DATE: "2026-12-31" }));
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  return { base: `http://127.0.0.1:${server.address().port}`, dir, close: () => new Promise((r) => server.close(r)) };
}

// The matrix from docs/permissions.md: [method, path, body, header needed, expected status for anonymous, expected for operator]
const MATRIX = [
  ["GET", "/", null, false, 200, 200],
  ["GET", "/styles.css", null, false, 200, 200],
  ["GET", "/app.js", null, false, 200, 200],
  ["GET", "/core/index.js", null, false, 200, 200],
  ["GET", "/favicon.svg", null, false, 200, 200],
  ["GET", "/api/health", null, false, 200, 200],
  ["GET", "/api/health/live", null, false, 200, 200],
  ["GET", "/api/config", null, false, 200, 200],
  ["POST", "/api/event", { event: "page_ready" }, true, 200, 200],
  ["POST", "/api/waitlist", { email: "a@example.org" }, true, 202, 202],
  ["GET", "/api/stats", null, false, 401, 200],
  ["GET", "/api/admin", null, false, 404, 404],
  ["GET", "/api/waitlist", null, false, 404, 404],
  ["DELETE", "/api/stats", null, false, 404, 404],
];

test("every route answers as docs/permissions.md says, for anonymous visitors and for the operator", async (t) => {
  const s = await start(); t.after(s.close);
  for (const [method, p, body, needsHeader, anon, op] of MATRIX) {
    for (const [who, want, extra] of [["anonymous", anon, {}], ["operator", op, { authorization: `Bearer ${TOKEN}` }]]) {
      const headers = { "user-agent": UA, ...extra, ...(body ? { "content-type": "application/json" } : {}), ...(needsHeader ? { "x-requested-by": "chaser" } : {}) };
      const r = await fetch(s.base + p, { method, headers, body: body ? JSON.stringify(body) : undefined });
      assert.equal(r.status, want, `${who} ${method} ${p}`);
    }
  }
});

test("no route ever returns an email address from the waitlist", async (t) => {
  const s = await start(); t.after(s.close);
  const H = { "content-type": "application/json", "x-requested-by": "chaser", "user-agent": UA };
  await fetch(s.base + "/api/waitlist", { method: "POST", headers: H, body: JSON.stringify({ email: "secret.person@example.org" }) });
  for (const p of ["/api/stats", "/api/config", "/api/health", "/"]) {
    const r = await fetch(s.base + p, { headers: { authorization: `Bearer ${TOKEN}` } });
    assert.ok(!(await r.text()).includes("secret.person"), p);
  }
});

test("a copy of the data directory restores identical counts and waitlist", () => {
  const a = fs.mkdtempSync(path.join(os.tmpdir(), "chaser-bk-a-"));
  const b = fs.mkdtempSync(path.join(os.tmpdir(), "chaser-bk-b-"));
  const ev = createEventStore({ dir: a }); const wl = createWaitlistStore({ dir: a });
  for (const [e, src] of [["page_ready", "post"], ["generate", "post"], ["pay_intent", "friends"], ["page_ready", "me"]]) ev.record(e, src, Date.UTC(2026, 9, 21, 8));
  wl.add({ email: "x@example.org", src: "post", noticeVersion: "1" }); wl.add({ email: "y@example.org", src: "post", noticeVersion: "1" });
  for (const f of fs.readdirSync(a)) fs.copyFileSync(path.join(a, f), path.join(b, f));
  const ev2 = createEventStore({ dir: b }); const wl2 = createWaitlistStore({ dir: b });
  assert.deepEqual(ev2.snapshot(), ev.snapshot());
  assert.equal(wl2.count(), 2);
  assert.equal(wl2.add({ email: "x@example.org", src: "post", noticeVersion: "1" }), false, "restored addresses are remembered, so no duplicate is written");
});
