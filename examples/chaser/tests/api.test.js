import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadConfig } from "../src/config.js";
import { createServer } from "../src/server.js";
import { createRateLimiter } from "../src/http/limits.js";
import { createEventStore } from "../src/store/events.js";
import { summarise } from "../src/http/routes.js";

const TOKEN = "o".repeat(32);
const H = { "content-type": "application/json", "x-requested-by": "chaser", "user-agent": "Mozilla/5.0 (Linux; Android 14) Chrome/120 Mobile Safari/537.36" };
const OPERATOR = { OPERATOR_NAME: "Test Operator", OPERATOR_CONTACT: "ops@example.org", TEST_END_DATE: "2026-12-31" };

async function start(env = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "chaser-api-"));
  const config = loadConfig({ OPERATOR_TOKEN: TOKEN, NODE_ENV: "test", DATA_DIR: dir, ...env });
  const server = createServer(config);
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (p, body, headers = {}) => fetch(base + p, { method: "POST", headers: { ...H, ...headers }, body: typeof body === "string" ? body : JSON.stringify(body) });
  const stats = async () => (await fetch(base + "/api/stats", { headers: { authorization: `Bearer ${TOKEN}` } })).json();
  const ready = async (src = "post") => (await (await post("/api/event", { event: "page_ready", src })).json()).token;
  return { dir, base, post, stats, ready, close: () => new Promise((r) => server.close(r)) };
}
const files = (dir) => fs.readdirSync(dir).map((f) => fs.readFileSync(path.join(dir, f), "utf8")).join("\n");

test("a page load gets a token and is counted; later events with that token are counted once each", async (t) => {
  const s = await start(); t.after(s.close);
  const token = await s.ready();
  assert.match(token, /^[0-9a-f]{32}$/);
  for (const event of ["generate", "copy", "open_whatsapp", "sent_yes", "pay_intent"]) {
    const r = await s.post("/api/event", { event, src: "post", token, kind: event === "generate" || event === "pay_intent" ? undefined : "polite" });
    assert.deepEqual(await r.json(), { counted: true }, event);
  }
  const dup = await s.post("/api/event", { event: "copy", src: "post", token, kind: "polite" });
  assert.deepEqual(await dup.json(), { counted: false, reason: "duplicate" });
  const other = await s.post("/api/event", { event: "copy", src: "post", token, kind: "firm" });
  assert.deepEqual(await other.json(), { counted: true }, "a different message kind counts separately");
  const st = await s.stats();
  assert.equal(st.decisionCounts.page_ready, 1);
  assert.equal(st.decisionCounts.copy, 2);
});

test("events are refused or ignored when they should be: unknown name, no token, bot, bad kind", async (t) => {
  const s = await start(); t.after(s.close);
  assert.equal((await s.post("/api/event", { event: "steal_data" })).status, 400);
  assert.equal((await s.post("/api/event", { event: "copy", kind: "angry" })).status, 400);
  assert.deepEqual(await (await s.post("/api/event", { event: "copy", token: "f".repeat(32), kind: "polite" })).json(), { counted: false, reason: "no_page_ready" });
  assert.deepEqual(await (await s.post("/api/event", { event: "copy", kind: "polite" })).json(), { counted: false, reason: "no_page_ready" });
  for (const ua of ["Googlebot/2.1", "HeadlessChrome/120", "curl/8.0", "python-requests/2.31", "Mozilla/5.0 (compatible; Lighthouse)"]) {
    const r = await s.post("/api/event", { event: "page_ready" }, { "user-agent": ua });
    assert.deepEqual(await r.json(), { counted: false, reason: "bot" }, ua);
  }
  assert.deepEqual((await s.stats()).decisionCounts, {});
});

test("the traffic source must be on the allowlist, otherwise it is recorded as 'none'", async (t) => {
  const s = await start({ ALLOWED_SRC: "post,friends" }); t.after(s.close);
  await s.ready("post"); await s.ready("friends"); await s.ready("<script>alert(1)</script>"); await s.ready(null);
  const st = await s.stats();
  assert.deepEqual(Object.keys(st.bySource).sort(), ["friends", "none", "post"]);
  assert.equal(st.bySource.none.page_ready, 2);
});

test("request hygiene: header required, JSON only, size limit, valid JSON object", async (t) => {
  const s = await start(); t.after(s.close);
  const noHeader = await fetch(s.base + "/api/event", { method: "POST", headers: { "content-type": "application/json", "user-agent": H["user-agent"] }, body: "{}" });
  assert.equal(noHeader.status, 403);
  assert.equal((await s.post("/api/event", "{}", { "content-type": "text/plain" })).status, 415);
  assert.equal((await s.post("/api/event", "not json")).status, 400);
  assert.equal((await s.post("/api/event", "[1,2]")).status, 400);
  assert.equal((await s.post("/api/event", "null")).status, 400);
  const big = await s.post("/api/event", { event: "page_ready", pad: "x".repeat(5000) });
  assert.equal(big.status, 413);
  for (const r of [await s.post("/api/event", "not json"), await s.post("/api/event", { event: "nope" })]) {
    const body = await r.json();
    assert.deepEqual(Object.keys(body), ["error"]);
    assert.deepEqual(Object.keys(body.error).sort(), ["code", "message"]);
  }
});

test("the form inputs never reach the server: extra fields in a request are dropped, nothing is stored", async (t) => {
  const s = await start(OPERATOR); t.after(s.close);
  const token = await s.ready();
  await s.post("/api/event", { event: "generate", token, client: "Ravi Traders SECRET-NAME", amount: "123456789", pay: "secret@upi", src: "post" });
  await s.post("/api/waitlist", { email: "me@example.org", token, client: "Ravi Traders SECRET-NAME", amount: "123456789" });
  const all = files(s.dir);
  for (const secret of ["SECRET-NAME", "123456789", "secret@upi"]) assert.ok(!all.includes(secret), secret);
  assert.ok(!all.includes("127.0.0.1") && !all.includes("::1"), "no IP address is written to disk");
});

test("the waitlist stays closed until operator, contact and end date are set", async (t) => {
  const s = await start(); t.after(s.close);
  const r = await s.post("/api/waitlist", { email: "a@example.org" });
  assert.equal(r.status, 503);
  assert.equal((await r.json()).error.code, "waitlist_unavailable");
  const cfg = await (await fetch(s.base + "/api/config")).json();
  assert.equal(cfg.waitlistEnabled, false);
  assert.equal(cfg.operatorName, null);
  assert.equal(cfg.priceInr, 149);
  assert.throws(() => loadConfig({ OPERATOR_TOKEN: TOKEN, TEST_END_DATE: "soon" }), /TEST_END_DATE/);
  assert.throws(() => loadConfig({ OPERATOR_TOKEN: TOKEN, OPERATOR_CONTACT: "not a contact" }), /OPERATOR_CONTACT/);
});

test("waitlist: stores the address with time and notice version, normalised, once; the answer never reveals duplicates", async (t) => {
  const s = await start({ ...OPERATOR, NOTICE_VERSION: "3" }); t.after(s.close);
  const cfg = await (await fetch(s.base + "/api/config")).json();
  assert.deepEqual([cfg.waitlistEnabled, cfg.operatorName, cfg.operatorContact, cfg.endDate, cfg.noticeVersion], [true, "Test Operator", "ops@example.org", "2026-12-31", "3"]);
  const token = await s.ready();
  const a = await s.post("/api/waitlist", { email: "  Asha@Example.ORG ", token, src: "post" });
  const b = await s.post("/api/waitlist", { email: "asha@example.org", token });
  assert.equal(a.status, 202); assert.equal(b.status, 202);
  assert.deepEqual(await a.json(), await b.json());
  const rows = fs.readFileSync(path.join(s.dir, "waitlist.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].email, "asha@example.org");
  assert.equal(rows[0].noticeVersion, "3");
  assert.equal(rows[0].confirmed, false);
  assert.ok(!Number.isNaN(Date.parse(rows[0].at)));
  assert.equal(fs.statSync(path.join(s.dir, "waitlist.jsonl")).mode & 0o077, 0, "owner-only file");
  const st = await s.stats();
  assert.equal(st.waitlistEntries, 1);
  assert.equal(st.decisionCounts.waitlist_submit, 1, "counted once");
});

test("waitlist: bad addresses refused, honeypot silently ignored, a client cannot count waitlist events directly", async (t) => {
  const s = await start({ ...OPERATOR, TRUST_PROXY: "1" }); t.after(s.close); // trusted proxy so each request below has its own rate-limit budget
  let n = 0;
  for (const email of ["", "nope", "a@b", "a b@c.org", "x".repeat(300) + "@a.org", 5, null]) {
    assert.equal((await s.post("/api/waitlist", { email }, { "x-forwarded-for": `198.51.100.${++n}` })).status, 400, String(email).slice(0, 20));
  }
  const bot = await s.post("/api/waitlist", { email: "spam@example.org", website: "http://spam" });
  assert.equal(bot.status, 202);
  assert.ok(!fs.existsSync(path.join(s.dir, "waitlist.jsonl")) || !files(s.dir).includes("spam@example.org"));
  const token = await s.ready();
  const direct = await s.post("/api/event", { event: "waitlist_submit", token });
  assert.deepEqual(await direct.json(), { counted: false, reason: "use_waitlist_endpoint" });
});

test("waitlist: at most 5 attempts an hour per client, and a spoofed X-Forwarded-For does not help unless a proxy is trusted", async (t) => {
  const run = async (env) => {
    const s = await start({ ...OPERATOR, ...env });
    try {
      const codes = [];
      for (let i = 0; i < 7; i++) codes.push((await s.post("/api/waitlist", { email: `u${i}@example.org` }, { "x-forwarded-for": `203.0.113.${i + 1}` })).status);
      return codes;
    } finally { await s.close(); }
  };
  assert.deepEqual(await run({}), [202, 202, 202, 202, 202, 429, 429]);
  assert.deepEqual(await run({ TRUST_PROXY: "1" }), [202, 202, 202, 202, 202, 202, 202], "with one trusted hop each forwarded address has its own budget");
});

test("stats needs the operator token and answers 401 otherwise", async (t) => {
  const s = await start(); t.after(s.close);
  for (const h of [{}, { authorization: "Bearer wrong" }, { authorization: "Basic abc" }, { authorization: "Bearer " }, { authorization: TOKEN }]) {
    const r = await fetch(s.base + "/api/stats", { headers: h });
    assert.equal(r.status, 401, JSON.stringify(h));
    assert.equal(r.headers.get("www-authenticate"), "Bearer");
    assert.equal((await r.json()).error.code, "unauthenticated");
  }
  assert.equal((await fetch(s.base + "/api/stats", { headers: { authorization: `Bearer ${TOKEN}` } })).status, 200);
});

test("stats ratios follow the design exactly and exclude 'me' and 'friends' from decisions", () => {
  const snap = { "2026-10-20": {
    post: { page_ready: 200, generate: 100, pay_intent: 8, waitlist_submit: 4, open_whatsapp: 50, open_email: 10, sent_yes: 30 },
    me: { page_ready: 50, generate: 50, pay_intent: 50, waitlist_submit: 50, open_whatsapp: 50, sent_yes: 50 },
    friends: { page_ready: 10, generate: 10, pay_intent: 10 },
  } };
  const s = summarise(snap, { waitlistCount: 4 });
  assert.deepEqual(s.decisionCounts, { page_ready: 200, generate: 100, pay_intent: 8, waitlist_submit: 4, open_whatsapp: 50, open_email: 10, sent_yes: 30 });
  assert.equal(s.rates.generateRate, 0.5);
  assert.equal(s.rates.payIntentRate, 0.08);
  assert.equal(s.rates.waitlistRate, 0.5);
  assert.equal(s.rates.useRate, 0.5);
  assert.deepEqual(s.passChecks, { enoughTraffic: true, payIntentAtLeast5pct: true, waitlistAtLeast20: false, useRateAtLeast40pct: true });
  assert.equal(s.bySource.me.generate, 50, "per-source numbers still show the excluded sources");
  const empty = summarise({}, { waitlistCount: 0 });
  assert.deepEqual(empty.rates, { generateRate: null, payIntentRate: null, waitlistRate: null, useRate: null });
  assert.equal(empty.passChecks.enoughTraffic, false);
});

test("counts survive a restart, and a torn last line does not lose the rest", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "chaser-ev-"));
  const a = createEventStore({ dir });
  a.record("page_ready", "post", Date.UTC(2026, 9, 20, 5)); a.record("generate", "post", Date.UTC(2026, 9, 20, 6));
  fs.appendFileSync(path.join(dir, "events.jsonl"), '{"t":"2026-10-2');
  const b = createEventStore({ dir });
  assert.deepEqual(b.snapshot(), { "2026-10-20": { post: { page_ready: 1, generate: 1 } } });
  assert.equal(fs.statSync(path.join(dir, "events.jsonl")).mode & 0o077, 0);
});

test("days are IST dates: 20:00 UTC is already the next day in India", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "chaser-ev-"));
  const e = createEventStore({ dir });
  e.record("page_ready", "post", Date.UTC(2026, 9, 20, 20, 0));
  assert.deepEqual(Object.keys(e.snapshot()), ["2026-10-21"]);
});

test("the rate limiter is bounded and counts per key", () => {
  const l = createRateLimiter({ windowMs: 60_000, max: 2, maxKeys: 50 });
  assert.deepEqual([l.take("a", 0), l.take("a", 1), l.take("a", 2), l.take("b", 3)], [true, true, false, true]);
  assert.equal(l.take("a", 61_000), true, "a new window starts");
  for (let i = 0; i < 500; i++) l.take("k" + i + "x".repeat(2000), 10);
  assert.ok(l.size() <= 50, "store is capped at " + l.size());
});

test("health, config and unknown routes use the standard error format", async (t) => {
  const s = await start(); t.after(s.close);
  assert.equal((await fetch(s.base + "/api/health")).status, 200);
  const nf = await fetch(s.base + "/api/nope");
  assert.equal(nf.status, 404);
  assert.deepEqual(await nf.json(), { error: { code: "not_found", message: "Not found" } });
  const core = await fetch(s.base + "/core/messages.js");
  assert.equal(core.status, 200);
  assert.match(core.headers.get("content-type"), /javascript/);
  assert.equal((await fetch(s.base + "/core/../config.js")).status, 404, "only src/core is served under /core");
  assert.equal((await fetch(s.base + "/src/config.js")).status, 404);
});
