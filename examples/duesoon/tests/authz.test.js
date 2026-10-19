// Authorisation tests GENERATED from docs/permissions.md: one row -> three requests (anonymous, owner, other user).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { startApp, signedUp } from "./helpers.js";

const md = fs.readFileSync(new URL("../docs/permissions.md", import.meta.url), "utf8");
const rows = md.split("\n").filter((l) => /^\| (GET|POST|PATCH|DELETE) /.test(l)).map((l) => {
  const c = l.split("|").slice(1, -1).map((s) => s.trim());
  return { method: c[0], path: c[1], body: c[2] ? JSON.parse(c[2]) : undefined, anon: +c[3], owner: +c[4], other: +c[5] };
});

test("permissions matrix is not empty", () => assert.ok(rows.length >= 6));

for (const row of rows) {
  test(`${row.method} ${row.path}: anonymous ${row.anon}, owner ${row.owner}, other ${row.other}`, async (t) => {
    const ctx = await startApp();
    t.after(() => ctx.close());
    const { agent: owner } = await signedUp(ctx);
    const { agent: other } = await signedUp(ctx);
    const made = await owner.post("/api/assignments", { title: "Fixture", dueDate: "2026-11-30" });
    const path = row.path.replace(":id", made.json.assignment.id);

    const anon = await ctx.agent().req(row.method, path, row.body);
    assert.equal(anon.status, row.anon, "anonymous");
    if (row.anon === 401) assert.equal(anon.json?.error?.code, "unauthenticated");

    const o2 = await other.req(row.method, path, row.body);
    assert.equal(o2.status, row.other, "other user");
    if (row.other === 404) {
      assert.equal(o2.json.error.code, "not_found");
      const still = await owner.get(`/api/assignments/${made.json.assignment.id}`);
      assert.equal(still.status, 200, "the other user's request must not have changed or deleted the row");
      assert.equal(still.json.assignment.done, false);
    }
    const o1 = await owner.req(row.method, path, row.body);
    assert.equal(o1.status, row.owner, "owner");
  });
}
