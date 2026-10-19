import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { loadConfig } from "../src/config.js";
import { createLogger } from "../src/logger.js";
import { openDb, migrate } from "../src/db/connection.js";
import { startApp } from "./helpers.js";

test("config refuses to start without a strong SESSION_SECRET, with a readable message", () => {
  assert.throws(() => loadConfig({}), /SESSION_SECRET/);
  assert.throws(() => loadConfig({ SESSION_SECRET: "short" }), /at least 32/);
  assert.throws(() => loadConfig({ SESSION_SECRET: "x".repeat(40), PORT: "99999" }), /PORT/);
  assert.equal(loadConfig({ SESSION_SECRET: "x".repeat(40) }).PORT, 3000);
});

test("logger redacts sensitive fields and respects levels", () => {
  const lines = [];
  const log = createLogger({ level: "info", write: (l) => lines.push(JSON.parse(l)) });
  log.debug("hidden");
  log.info("login", { password: "hunter2", token: "abc", email: "a@b.co", nested: { authorization: "Bearer z" }, ok: 1 });
  assert.equal(lines.length, 1);
  const s = JSON.stringify(lines[0]);
  for (const secret of ["hunter2", "abc", "a@b.co", "Bearer z"]) assert.ok(!s.includes(secret), secret);
  assert.equal(lines[0].ok, 1);
});

test("a request logs one JSON line with request id, status and user id, and never the password", async (t) => {
  const logs = [];
  const ctx = await startApp({ logs }); t.after(() => ctx.close());
  const a = ctx.agent();
  const r = await a.post("/api/auth/signup", { email: "log@example.com", password: "correct-horse-1" });
  const line = logs.map((l) => JSON.parse(l)).find((l) => l.msg === "request" && l.path === "/api/auth/signup");
  assert.ok(line.requestId);
  assert.equal(line.requestId, r.headers.get("x-request-id"));
  assert.equal(line.status, 201);
  assert.ok(line.userId);
  assert.ok(!logs.join("").includes("correct-horse-1"));
  assert.ok(!logs.join("").includes("log@example.com"));
});

test("migrations are idempotent and recorded", () => {
  const db = openDb(":memory:");
  migrate(db); migrate(db);
  assert.deepEqual(db.prepare("SELECT name FROM schema_migrations").all().map((r) => r.name), ["001_init.sql"]);
  assert.throws(() => db.prepare("INSERT INTO assignments (id,user_id,title,due_date,created_at,updated_at) VALUES ('1','nope','t','2026-01-01','x','x')").run(), /FOREIGN KEY/);
  assert.throws(() => db.prepare("INSERT INTO users (id,email,password_hash,created_at,updated_at) VALUES ('1','UPPER@X.CO','h','x','x')").run(), /CHECK/);
});

test("health: ok with a working database, 503 when it is gone", async (t) => {
  const ctx = await startApp(); t.after(() => ctx.close());
  const ok = await ctx.agent().get("/api/health");
  assert.equal(ok.status, 200);
  assert.deepEqual(ok.json, { status: "ok", checks: { database: "ok" } });
  assert.equal((await ctx.agent().get("/api/health/live")).status, 200);
  ctx.db.close();
  const down = await ctx.agent().get("/api/health");
  assert.equal(down.status, 503);
  assert.equal(down.json.checks.database, "down");
});

test("unknown route gives the standard 404 error", async (t) => {
  const ctx = await startApp(); t.after(() => ctx.close());
  const r = await ctx.agent().get("/api/nope");
  assert.equal(r.status, 404);
  assert.equal(r.json.error.code, "not_found");
});

test("backup then restore into a separate database file keeps the data", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "duesoon-"));
  const live = path.join(dir, "live.db");
  const db = openDb(live);
  db.prepare("INSERT INTO users (id,email,password_hash,created_at,updated_at) VALUES ('u1','keep@example.com','h','x','x')").run();
  const backup = path.join(dir, "backup.db");
  execFileSync("node", ["--disable-warning=ExperimentalWarning", "scripts/backup.js", backup], { env: { ...process.env, DB_PATH: live }, encoding: "utf8" });
  db.prepare("DELETE FROM users").run(); // simulate data loss in the live database
  db.close();
  const restored = path.join(dir, "restored.db");
  fs.copyFileSync(backup, restored);
  const r = openDb(restored);
  assert.equal(r.prepare("SELECT email FROM users").get().email, "keep@example.com");
  r.close();
  assert.throws(() => execFileSync("node", ["--disable-warning=ExperimentalWarning", "scripts/backup.js", backup], { env: { ...process.env, DB_PATH: live }, stdio: "pipe" }), /./, "refuses to overwrite an existing backup");
});
