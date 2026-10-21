import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { loadPhases, createMachine } from "./model.mjs";

const gates = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../hyperskill/gates.json");

test("the phases and check counts come from gates.json, not from the figure", () => {
  const phases = loadPhases(gates);
  assert.deepEqual(phases.map((p) => p.id), ["research", "plan", "foundation", "product", "ship", "harden", "operate", "launch", "scale"]);
  const raw = JSON.parse(fs.readFileSync(gates, "utf8"));
  const expected = raw.phases.map((p) => p.gate.filter((g) => !g.tenancy || g.tenancy.includes("organization")).length);
  assert.deepEqual(phases.map((p) => p.checks), expected);
  assert.equal(phases[2].title, "Foundation", "the bracketed part of a title is dropped");
  const none = loadPhases(gates, "none");
  assert.ok(none.reduce((n, p) => n + p.checks, 0) < phases.reduce((n, p) => n + p.checks, 0), "some checks do not apply when there is no tenancy");
});

test("passing checks fills the chamber, opens its gate only when full, then moves to the next phase", () => {
  const m = createMachine([{ id: "a", title: "A", checks: 2 }, { id: "b", title: "B", checks: 1 }]);
  let s = m.snapshot();
  assert.deepEqual([s.phase, s.passedTotal, s.total, s.gatesOpen], [0, 0, 3, [false, false]]);
  s = m.step();
  assert.deepEqual([s.phase, s.fill[0], s.gatesOpen[0]], [0, 0.5, false], "half full: the gate stays shut");
  s = m.step();
  assert.deepEqual([s.phase, s.gatesOpen[0], s.done], [1, true, false], "full: the gate opens and the boat is in chamber two");
  s = m.step();
  assert.ok(s.done && s.gatesOpen.every(Boolean) && s.passedTotal === 3);
  assert.equal(m.step().passedTotal, 3, "nothing more to pass once done");
  assert.match(s.readout, /All 2 phases clear, 3 of 3 checks passed/);
});

test("passPhase finishes the current phase only; reset starts over; the readout is plain words with true numbers", () => {
  const m = createMachine(loadPhases(gates));
  const s = m.passPhase();
  const phases = loadPhases(gates);
  assert.equal(s.phase, 1); assert.equal(s.passedTotal, phases[0].checks);
  assert.match(s.readout, new RegExp(`^Phase 2 of 9: Plan, 0 of ${phases[1].checks} checks, ${phases[0].checks} of ${s.total} overall$`));
  assert.deepEqual([m.reset().phase, m.snapshot().passedTotal, m.snapshot().done], [0, 0, false]);
});
