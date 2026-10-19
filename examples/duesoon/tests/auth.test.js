import { test } from "node:test";
import assert from "node:assert/strict";
import { startApp, signedUp } from "./helpers.js";

const good = { email: "Sam@Example.com", password: "correct-horse-1" };

test("signup creates an account, lower-cases the email and sets a secure-by-default cookie", async (t) => {
  const ctx = await startApp(); t.after(() => ctx.close());
  const r = await ctx.agent().post("/api/auth/signup", good);
  assert.equal(r.status, 201);
  assert.equal(r.json.user.email, "sam@example.com");
  assert.match(r.setCookie[0], /HttpOnly/i);
  assert.match(r.setCookie[0], /SameSite=Lax/i);
  assert.ok(!JSON.stringify(r.json).includes("password"));
  const row = ctx.db.prepare("SELECT password_hash FROM users").get();
  assert.match(row.password_hash, /^\$2[aby]\$/, "stored as a bcrypt hash, never plain text");
});

test("cookie is Secure in production (behind a proxy)", async (t) => {
  const ctx = await startApp({ env: { NODE_ENV: "production", TRUST_PROXY: "1" } }); t.after(() => ctx.close());
  const r = await ctx.agent().post("/api/auth/signup", good, { headers: { "x-forwarded-proto": "https" } });
  assert.equal(r.status, 201);
  assert.match(r.setCookie[0], /Secure/i);
});

test("duplicate email is rejected with 409 in the standard error format", async (t) => {
  const ctx = await startApp(); t.after(() => ctx.close());
  await ctx.agent().post("/api/auth/signup", good);
  const r = await ctx.agent().post("/api/auth/signup", { ...good, email: "SAM@example.com" });
  assert.equal(r.status, 409);
  assert.equal(r.json.error.code, "email_taken");
});

for (const [name, body] of [
  ["short password", { email: "a@b.co", password: "short" }],
  ["73-byte password", { email: "a@b.co", password: "p".repeat(73) }],
  ["bad email", { email: "not-an-email", password: "correct-horse-1" }],
  ["unknown field", { email: "a@b.co", password: "correct-horse-1", role: "admin" }],
  ["missing fields", {}],
]) {
  test(`signup validation: ${name} -> 400 with details`, async (t) => {
    const ctx = await startApp(); t.after(() => ctx.close());
    const r = await ctx.agent().post("/api/auth/signup", body);
    assert.equal(r.status, 400);
    assert.equal(r.json.error.code, "validation_error");
    assert.ok(Array.isArray(r.json.error.details));
    assert.equal(ctx.db.prepare("SELECT COUNT(*) n FROM users").get().n, 0);
  });
}

test("wrong password and unknown email give the same status and message", async (t) => {
  const ctx = await startApp(); t.after(() => ctx.close());
  await ctx.agent().post("/api/auth/signup", good);
  const a = await ctx.agent().post("/api/auth/login", { email: good.email, password: "wrong-password-1" });
  const b = await ctx.agent().post("/api/auth/login", { email: "nobody@example.com", password: "wrong-password-1" });
  assert.equal(a.status, 401);
  assert.deepEqual(a.json, b.json);
  assert.equal(b.status, 401);
});

test("login works, rotates the session id, and logout ends the session", async (t) => {
  const ctx = await startApp(); t.after(() => ctx.close());
  const a = ctx.agent();
  await a.post("/api/auth/signup", good);
  const before = a.cookie;
  const l = await a.post("/api/auth/login", good);
  assert.equal(l.status, 200);
  assert.notEqual(a.cookie, before, "session id must change on login (session fixation)");
  assert.equal((await a.get("/api/me")).status, 200);
  assert.equal((await a.post("/api/auth/logout")).status, 204);
  assert.equal((await a.get("/api/me")).status, 401);
});

test("state-changing requests without the CSRF header are refused", async (t) => {
  const ctx = await startApp(); t.after(() => ctx.close());
  const r = await ctx.agent().post("/api/auth/signup", good, { csrf: false });
  assert.equal(r.status, 403);
  assert.equal(r.json.error.code, "csrf");
  assert.equal(ctx.db.prepare("SELECT COUNT(*) n FROM users").get().n, 0);
});

test("garbage JSON gives a clean 400, not a stack trace", async (t) => {
  const ctx = await startApp(); t.after(() => ctx.close());
  const r = await ctx.agent().req("POST", "/api/auth/login", undefined, { raw: "{not json" });
  assert.equal(r.status, 400);
  assert.equal(r.json.error.code, "invalid_json");
  assert.ok(!/at .*\.js/.test(r.text), "no stack trace in the body");
});

test("oversized body gives 413", async (t) => {
  const ctx = await startApp(); t.after(() => ctx.close());
  const r = await ctx.agent().post("/api/auth/login", { email: "a@b.co", password: "x".repeat(20000) });
  assert.equal(r.status, 413);
  assert.equal(r.json.error.code, "too_large");
});

test("login is rate limited per ip+email and returns 429 with Retry-After", async (t) => {
  const ctx = await startApp({ limits: { login: { windowMs: 60000, max: 3 }, loginIp: { windowMs: 60000, max: 1e6 }, signup: { windowMs: 60000, max: 100 } } });
  t.after(() => ctx.close());
  const a = ctx.agent();
  const codes = [];
  let last;
  for (let i = 0; i < 5; i++) { last = await a.post("/api/auth/login", { email: "x@y.co", password: "wrong-password-1" }); codes.push(last.status); }
  assert.deepEqual(codes, [401, 401, 401, 429, 429]);
  assert.ok(Number(last.headers.get("retry-after")) > 0);
  assert.equal(last.json.error.code, "rate_limited");
  const other = await a.post("/api/auth/login", { email: "different@y.co", password: "wrong-password-1" });
  assert.equal(other.status, 401, "another email is a different bucket");
});

test("signup is rate limited", async (t) => {
  const ctx = await startApp({ limits: { login: { windowMs: 60000, max: 100 }, loginIp: { windowMs: 60000, max: 1e6 }, signup: { windowMs: 60000, max: 2 } } });
  t.after(() => ctx.close());
  const codes = [];
  for (let i = 0; i < 3; i++) codes.push((await ctx.agent().post("/api/auth/signup", { email: `u${i}@e.co`, password: "correct-horse-1" })).status);
  assert.deepEqual(codes, [201, 201, 429]);
});

test("session probe: null when signed out, the user when signed in, and /api/me still needs a login", async (t) => {
  const ctx = await startApp(); t.after(() => ctx.close());
  const a = ctx.agent();
  const out = await a.get("/api/session");
  assert.equal(out.status, 200);
  assert.deepEqual(out.json, { user: null });
  assert.equal((await a.get("/api/me")).status, 401);
  await a.post("/api/auth/signup", good);
  assert.equal((await a.get("/api/session")).json.user.email, "sam@example.com");
});

test("deleting the account removes the user and every assignment they owned", async (t) => {
  const ctx = await startApp(); t.after(() => ctx.close());
  const { agent } = await signedUp(ctx);
  const { agent: keep } = await signedUp(ctx);
  await agent.post("/api/assignments", { title: "mine", dueDate: "2026-11-01" });
  await keep.post("/api/assignments", { title: "theirs", dueDate: "2026-11-01" });
  assert.equal((await agent.del("/api/me", { password: "correct-horse-1" })).status, 204);
  assert.equal(ctx.db.prepare("SELECT COUNT(*) n FROM users").get().n, 1);
  assert.equal(ctx.db.prepare("SELECT COUNT(*) n FROM assignments").get().n, 1);
  assert.equal((await agent.get("/api/me")).status, 401);
  assert.equal((await keep.get("/api/assignments")).json.items.length, 1);
});
