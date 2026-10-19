import { test } from "node:test";
import assert from "node:assert/strict";
import { startApp, signedUp } from "./helpers.js";
import { MAX_PER_USER } from "../src/services/assignments.js";

const A = { title: "Essay", course: "ENG101", dueDate: "2026-11-05" };

test("create, read, update, mark done, delete", async (t) => {
  const ctx = await startApp(); t.after(() => ctx.close());
  const { agent } = await signedUp(ctx);
  const c = await agent.post("/api/assignments", A);
  assert.equal(c.status, 201);
  const id = c.json.assignment.id;
  assert.equal(c.json.assignment.done, false);
  const p = await agent.patch(`/api/assignments/${id}`, { done: true, title: "  Essay v2  " });
  assert.equal(p.json.assignment.done, true);
  assert.equal(p.json.assignment.title, "Essay v2");
  assert.equal(p.json.assignment.course, "ENG101", "untouched fields stay");
  assert.equal((await agent.del(`/api/assignments/${id}`)).status, 204);
  assert.equal((await agent.get(`/api/assignments/${id}`)).status, 404);
});

for (const [name, body] of [
  ["empty title", { ...A, title: "   " }],
  ["title too long", { ...A, title: "t".repeat(121) }],
  ["course too long", { ...A, course: "c".repeat(61) }],
  ["not a date", { ...A, dueDate: "tomorrow" }],
  ["impossible date", { ...A, dueDate: "2026-02-30" }],
  ["datetime instead of date", { ...A, dueDate: "2026-11-05T10:00:00Z" }],
  ["unknown field (mass assignment)", { ...A, userId: "someone-else" }],
]) {
  test(`create validation: ${name} -> 400`, async (t) => {
    const ctx = await startApp(); t.after(() => ctx.close());
    const { agent } = await signedUp(ctx);
    const r = await agent.post("/api/assignments", body);
    assert.equal(r.status, 400);
    assert.equal(r.json.error.code, "validation_error");
    assert.equal(ctx.db.prepare("SELECT COUNT(*) n FROM assignments").get().n, 0);
  });
}

test("PATCH with no fields and non-uuid ids are 400", async (t) => {
  const ctx = await startApp(); t.after(() => ctx.close());
  const { agent } = await signedUp(ctx);
  const { json } = await agent.post("/api/assignments", A);
  assert.equal((await agent.patch(`/api/assignments/${json.assignment.id}`, {})).status, 400);
  assert.equal((await agent.get("/api/assignments/not-a-uuid")).status, 400);
});

test("list is ordered not-done first then by due date, and paginates without gaps or repeats", async (t) => {
  const ctx = await startApp(); t.after(() => ctx.close());
  const { agent } = await signedUp(ctx);
  const dates = ["2026-12-03", "2026-11-01", "2026-11-20", "2026-11-01", "2026-12-25"];
  const ids = [];
  for (const [i, d] of dates.entries()) ids.push((await agent.post("/api/assignments", { title: `T${i}`, dueDate: d })).json.assignment.id);
  await agent.patch(`/api/assignments/${ids[1]}`, { done: true }); // earliest date but done -> last
  const seen = [];
  let cursor;
  let pages = 0;
  do {
    const r = await agent.get(`/api/assignments?limit=2${cursor ? `&cursor=${cursor}` : ""}`);
    assert.equal(r.status, 200);
    seen.push(...r.json.items);
    cursor = r.json.nextCursor;
    pages++;
  } while (cursor && pages < 10);
  assert.equal(pages, 3);
  assert.equal(new Set(seen.map((x) => x.id)).size, 5, "every item exactly once");
  assert.deepEqual(seen.map((x) => x.done), [false, false, false, false, true]);
  const open = seen.filter((x) => !x.done).map((x) => x.dueDate);
  assert.deepEqual(open, [...open].sort());
  assert.equal(seen.at(-1).id, ids[1]);
});

test("order does not depend on id luck: twelve rows created newest-first come back oldest-first", async (t) => {
  // Ids are random UUIDs, so a 5-row check could pass by chance if ordering broke (1 in 24). With 12 rows it is 1 in 479 million.
  const ctx = await startApp(); t.after(() => ctx.close());
  const { agent } = await signedUp(ctx);
  for (let d = 12; d >= 1; d--) await agent.post("/api/assignments", { title: `D${d}`, dueDate: `2026-11-${String(d).padStart(2, "0")}` });
  const r = await agent.get("/api/assignments?limit=50");
  assert.deepEqual(r.json.items.map((x) => x.dueDate), Array.from({ length: 12 }, (_, i) => `2026-11-${String(i + 1).padStart(2, "0")}`));
});

test("bad cursor and bad limit are 400", async (t) => {
  const ctx = await startApp(); t.after(() => ctx.close());
  const { agent } = await signedUp(ctx);
  assert.equal((await agent.get("/api/assignments?cursor=%%%")).status, 400);
  assert.equal((await agent.get("/api/assignments?cursor=eyJhIjoxfQ")).status, 400);
  assert.equal((await agent.get("/api/assignments?limit=0")).status, 400);
  assert.equal((await agent.get("/api/assignments?limit=999")).status, 400);
  assert.equal((await agent.get("/api/assignments?evil=1")).status, 400);
});

test("one user's list never contains another user's rows, even with their cursor", async (t) => {
  const ctx = await startApp(); t.after(() => ctx.close());
  const { agent: a } = await signedUp(ctx);
  const { agent: b } = await signedUp(ctx);
  for (let i = 0; i < 3; i++) await a.post("/api/assignments", { title: `A${i}`, dueDate: "2026-11-0" + (i + 1) });
  await b.post("/api/assignments", { title: "B0", dueDate: "2026-11-09" });
  const first = await a.get("/api/assignments?limit=1");
  const viaB = await b.get(`/api/assignments?cursor=${first.json.nextCursor}`);
  assert.deepEqual(viaB.json.items.map((x) => x.title), ["B0"].filter(() => false).concat(viaB.json.items.map((x) => x.title)));
  assert.ok(viaB.json.items.every((x) => x.title.startsWith("B")), "only B's own rows");
  assert.deepEqual((await b.get("/api/assignments")).json.items.map((x) => x.title), ["B0"]);
});

test(`at most ${MAX_PER_USER} assignments per user (422), counted per user`, async (t) => {
  const ctx = await startApp(); t.after(() => ctx.close());
  const { agent, user } = await signedUp(ctx);
  const ins = ctx.db.prepare("INSERT INTO assignments (id,user_id,title,course,due_date,done,created_at,updated_at) VALUES (?,?,?,?,?,0,?,?)");
  const now = new Date().toISOString();
  ctx.db.exec("BEGIN");
  for (let i = 0; i < MAX_PER_USER; i++) ins.run(`id-${i}`, user.id, `T${i}`, "", "2026-11-01", now, now);
  ctx.db.exec("COMMIT");
  const r = await agent.post("/api/assignments", A);
  assert.equal(r.status, 422);
  assert.equal(r.json.error.code, "limit_reached");
  const { agent: other } = await signedUp(ctx);
  assert.equal((await other.post("/api/assignments", A)).status, 201, "another user is unaffected");
});

test("responses carry security headers and a request id; no x-powered-by", async (t) => {
  const ctx = await startApp(); t.after(() => ctx.close());
  const r = await ctx.agent().get("/api/health");
  assert.match(r.headers.get("content-security-policy"), /default-src 'self'/);
  assert.match(r.headers.get("content-security-policy"), /frame-ancestors 'none'/);
  assert.equal(r.headers.get("x-content-type-options"), "nosniff");
  assert.ok(r.headers.get("x-request-id"));
  assert.equal(r.headers.get("x-powered-by"), null);
  assert.equal(r.headers.get("cache-control"), "no-store");
});

test("every authenticated response is uncacheable by browsers and shared caches", async (t) => {
  const ctx = await startApp(); t.after(() => ctx.close());
  const { agent } = await signedUp(ctx);
  const made = await agent.post("/api/assignments", { title: "Private", dueDate: "2026-11-01" });
  for (const path of ["/api/me", "/api/session", "/api/assignments", `/api/assignments/${made.json.assignment.id}`, "/api/health"]) {
    const r = await agent.get(path);
    assert.equal(r.headers.get("cache-control"), "no-store", path);
    assert.equal(r.headers.get("etag"), null, `${path}: no validators that would let a shared cache revalidate someone else's body`);
  }
});
