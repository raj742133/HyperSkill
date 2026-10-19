// Regression tests for the independent security review (docs/security/audit.md). One test per finding.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import bcrypt from "bcryptjs";
import { startApp, signedUp } from "./helpers.js";
import { loadConfig } from "../src/config.js";
import { createLimiter } from "../src/middleware/security.js";
import * as users from "../src/services/users.js";
import { SECRET } from "./helpers.js";

const wrong = { password: "wrong-password-1" };

test("M1: padding or re-casing the email does not give a fresh login budget", async (t) => {
  const ctx = await startApp({ limits: { login: { windowMs: 60000, max: 3 }, loginIp: { windowMs: 60000, max: 1e6 }, signup: { windowMs: 60000, max: 100 } } });
  t.after(() => ctx.close());
  const a = ctx.agent();
  const variants = ["v@x.co", " v@x.co", "v@x.co\t", "V@X.CO", "v@x.co ", " v@x.co"];
  const codes = [];
  for (const email of variants) codes.push((await a.post("/api/auth/login", { email, ...wrong })).status);
  assert.deepEqual(codes.slice(0, 3), [401, 401, 401]);
  assert.ok(codes.slice(3).every((c) => c === 429 || c === 400), `variants after the budget: ${codes}`);
  assert.equal(codes.filter((c) => c === 401).length, 3, "no more than the budget reached the password check");
});

test("M1: a per-IP limit applies whatever email is used", async (t) => {
  const ctx = await startApp({ limits: { login: { windowMs: 60000, max: 100 }, loginIp: { windowMs: 60000, max: 4 }, signup: { windowMs: 60000, max: 100 } } });
  t.after(() => ctx.close());
  const a = ctx.agent();
  const codes = [];
  for (let i = 0; i < 6; i++) codes.push((await a.post("/api/auth/login", { email: `n${i}@x.co`, ...wrong })).status);
  assert.deepEqual(codes, [401, 401, 401, 401, 429, 429]);
});

test("M2: the limiter store is capped and expired keys are dropped", async () => {
  const lim = createLimiter({ windowMs: 60000, max: 1, key: (req) => req.k, maxKeys: 50 });
  const res = { setHeader() {}, status() { return this; }, json() {} };
  for (let i = 0; i < 500; i++) lim({ k: `k${i}` + "x".repeat(5000) }, res, () => {});
  // The oldest keys were evicted, so the first key starts a fresh window instead of being limited.
  const outcome = [];
  lim({ k: "k0" + "x".repeat(5000) }, res, (e) => outcome.push(e ? "limited" : "pass"));
  assert.deepEqual(outcome, ["pass"], "evicted key is treated as new, so the store really is bounded");
  const recent = [];
  lim({ k: "k499" + "x".repeat(5000) }, res, (e) => recent.push(e ? "limited" : "pass"));
  assert.deepEqual(recent, ["limited"], "a recent key is still remembered");
});

test("M2: very long keys are truncated, so memory per key is bounded", async () => {
  const lim = createLimiter({ windowMs: 60000, max: 1, key: (req) => req.k });
  const res = { setHeader() {}, status() { return this; }, json() {} };
  const outcome = [];
  lim({ k: "a".repeat(10000) + "1" }, res, (e) => outcome.push(e ? "limited" : "pass"));
  lim({ k: "a".repeat(10000) + "2" }, res, (e) => outcome.push(e ? "limited" : "pass")); // same first 200 chars => same bucket
  assert.deepEqual(outcome, ["pass", "limited"]);
});

test("M3: X-Forwarded-For is ignored unless TRUST_PROXY says a proxy is in front", async (t) => {
  const limits = { login: { windowMs: 60000, max: 2 }, loginIp: { windowMs: 60000, max: 1e6 }, signup: { windowMs: 60000, max: 100 } };
  const run = async (env) => {
    const ctx = await startApp({ env, limits });
    try {
      const a = ctx.agent();
      const codes = [];
      for (let i = 0; i < 4; i++) codes.push((await a.post("/api/auth/login", { email: "z@x.co", ...wrong }, { headers: { "x-forwarded-for": `203.0.113.${i + 1}` } })).status);
      return codes;
    } finally { await ctx.close(); }
  };
  assert.deepEqual(await run({}), [401, 401, 429, 429], "spoofed header must not rotate the bucket");
  assert.deepEqual(await run({ TRUST_PROXY: "1" }), [401, 401, 401, 401], "with one trusted hop the header is the client address");
});

test("L1: the environment defaults to production, so the secure cookie and HSTS are on unless relaxed on purpose", () => {
  const c = loadConfig({ SESSION_SECRET: SECRET });
  assert.equal(c.NODE_ENV, "production");
  assert.equal(c.TRUST_PROXY, 0);
  assert.equal(c.HOST, "127.0.0.1");
});

test("L2: the dummy hash for unknown emails uses the configured cost", async () => {
  const db = (await startApp({ env: { BCRYPT_ROUNDS: "5" } }));
  try {
    const spy = [];
    const orig = bcrypt.compare;
    bcrypt.compare = async (pw, hash) => { spy.push(hash); return orig(pw, hash); };
    try { await users.authenticate(db.db, { email: "nobody@x.co", password: "whatever-1234" }, 5).catch(() => {}); } finally { bcrypt.compare = orig; }
    assert.equal(spy.length, 1);
    assert.equal(bcrypt.getRounds(spy[0]), 5);
  } finally { await db.close(); }
});

test("L4: deleting the account needs the password; a wrong or missing password keeps the account", async (t) => {
  const ctx = await startApp(); t.after(() => ctx.close());
  const { agent } = await signedUp(ctx);
  assert.equal((await agent.del("/api/me")).status, 400, "no password");
  assert.equal((await agent.del("/api/me", { password: "not-my-password" })).status, 401);
  assert.equal(ctx.db.prepare("SELECT COUNT(*) n FROM users").get().n, 1);
  assert.equal((await agent.get("/api/me")).status, 200, "session survives a failed attempt");
  assert.equal((await agent.del("/api/me", { password: "correct-horse-1", extra: 1 })).status, 400, "strict schema");
  assert.equal((await agent.del("/api/me", { password: "correct-horse-1" })).status, 204);
});

test("L6: client errors raised by body-parser become a quiet 4xx, not a logged 500", async (t) => {
  const logs = [];
  const ctx = await startApp({ logs }); t.after(() => ctx.close());
  const post = (headers) => fetch(ctx.base + "/api/auth/login", { method: "POST", headers: { "x-requested-by": "duesoon", ...headers }, body: "{}" });
  const encoding = await post({ "content-type": "application/json", "content-encoding": "x-unknown" });
  assert.equal(encoding.status, 415); // was 500 + a logged stack before the fix
  assert.equal((await encoding.json()).error.code, "bad_request");
  assert.ok(!logs.some((l) => JSON.parse(l).msg === "unhandled_error"), "no error log with a stack");
});

test("L7: a backup file is readable by its owner only", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "duesoon-bk-"));
  const dbFile = path.join(dir, "d.sqlite"); const out = path.join(dir, "copy.sqlite");
  execFileSync(process.execPath, ["-e", `const {openDb}=await import("${path.resolve("src/db/connection.js")}");openDb(${JSON.stringify(dbFile)}).close()`, "--input-type=module"], { stdio: "pipe" });
  execFileSync(process.execPath, [path.resolve("scripts/backup.js"), out], { env: { ...process.env, DB_PATH: dbFile }, stdio: "pipe" });
  assert.equal(fs.statSync(out).mode & 0o077, 0, "no group/other permission bits");
  fs.rmSync(dir, { recursive: true });
});

test("L5: the secret scanner exempts only this project's fixture paths, not any path containing tests/", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "duesoon-scan-"));
  fs.mkdirSync(path.join(dir, "tests"));
  const f = path.join(dir, "tests", "leak.js");
  fs.writeFileSync(f, 'const token = "abcdefghijklmnop1234567890";\n');
  let code = 0;
  try { execFileSync("bash", [path.resolve("scripts/secret-scan.sh"), f], { stdio: "pipe" }); } catch (e) { code = e.status; }
  assert.equal(code, 1);
  fs.rmSync(dir, { recursive: true });
});
