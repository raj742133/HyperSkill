import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { camera, auditOverlaps, bounds } from "../../kit/iso.mjs";
import { loadPhases, createMachine } from "./model.mjs";
import { staticParts, dynamicParts, startAnim, stepAnim, renderScene, fitBox, L, floorTop, yb } from "./scene.mjs";

const gates = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../hyperskill/gates.json");
const phases = loadPhases(gates);
const cam = camera({ az: 45, el: 30, scale: 1 });
// each gate leaf slides down into a slot in its sill, so that pair is allowed to share space
const allow = phases.map((_, i) => `leaf-${i}|sill-${i}`);

const settle = (m) => { const anim = startAnim(phases, m.snapshot()); for (let i = 0; i < 400; i++) stepAnim(phases, m.snapshot(), anim, 1 / 60); return anim; };

test("the canal is a dense machine: more than a hundred parts, every id unique", () => {
  const parts = [...staticParts(phases), ...dynamicParts(phases, settle(createMachine(phases)))];
  assert.ok(parts.length > 100, `only ${parts.length} parts`);
  assert.equal(new Set(parts.map((p) => p.id)).size, parts.length, "ids are unique");
  for (let i = 0; i < phases.length; i++) for (const k of ["floor", "wall", "curb", "sign", "sill", "postL", "postR", "beam", "leaf", "lamp"]) assert.ok(parts.some((p) => p.id === `${k}-${i}`), `${k}-${i}`);
});

test("audit: no part passes through another, at the start, half way and finished", () => {
  const m = createMachine(phases);
  for (const stage of ["start", "half", "done"]) {
    if (stage === "half") for (let i = 0; i < 40; i++) m.step();
    if (stage === "done") while (!m.snapshot().done) m.step();
    const parts = [...staticParts(phases), ...dynamicParts(phases, settle(m))];
    assert.deepEqual(auditOverlaps(parts, { allow }), [], stage);
  }
});

test("the chambers step up and away from the viewer, and each gate sits between two chambers", () => {
  for (let i = 1; i < phases.length; i++) {
    assert.equal(floorTop(i) - floorTop(i - 1), L.STEP);
    assert.ok(yb(i) < yb(i - 1), "the next chamber is further from the viewer");
    assert.equal(yb(i) + L.CL, yb(i - 1) - L.GAP, "a gap of one gate thickness between chambers");
  }
  const parts = staticParts(phases), sill = parts.find((p) => p.id === "sill-2"), a = bounds(parts.find((p) => p.id === "floor-2")), b = bounds(parts.find((p) => p.id === "floor-3"));
  assert.equal(bounds(sill).y1, a.y0); assert.equal(bounds(sill).y0, b.y1);
});

test("the water follows the checks passed, the gate leaf drops when its chamber is full, the boat floats on the water", () => {
  const m = createMachine(phases);
  for (let i = 0; i < phases[0].checks - 1; i++) m.step();
  let anim = settle(m);
  assert.ok(anim.level[0] > 0.7 && anim.level[0] < 1, "nearly full");
  assert.equal(anim.open[0], 0, "gate 0 still shut");
  assert.ok(Math.abs(anim.boat.z - (floorTop(0) + anim.level[0] * L.WATER_H)) < 0.05, "the boat rides the surface");
  m.step();
  anim = settle(m);
  assert.equal(anim.open[0], 1, "gate 0 open once the last check passes");
  assert.equal(anim.boat.y, yb(1) + L.CL / 2, "the boat is in chamber two");
  const parts = dynamicParts(phases, anim);
  assert.ok(Math.abs(bounds(parts.find((p) => p.id === "leaf-0")).z0 - (floorTop(0) - L.LEAF_H)) < 0.01, "the leaf is down in its slot");
  assert.equal(parts.find((p) => p.id === "lamp-0").base, "#4caf68", "green lamp when open");
  assert.equal(parts.find((p) => p.id === "lamp-1").base, "#e0a21b", "amber lamp when shut");
});

test("reduced motion: with instant set, the state is reached in one step", () => {
  const m = createMachine(phases); m.passPhase();
  const anim = startAnim(phases, { phase: 0, fill: phases.map(() => 0), gatesOpen: phases.map(() => false) });
  stepAnim(phases, m.snapshot(), anim, 0, true);
  assert.equal(anim.open[0], 1); assert.equal(anim.boat.y, yb(1) + L.CL / 2);
});

test("rendering gives SVG for every part, the labels lie on the signs, and the view box holds the whole machine", () => {
  const m = createMachine(phases), anim = settle(m);
  const svg = renderScene(cam, [...staticParts(phases), ...dynamicParts(phases, anim)]);
  assert.ok((svg.match(/<g data-id=/g) || []).length > 100);
  for (const p of phases) assert.match(svg, new RegExp(`>${String(phases.indexOf(p) + 1).padStart(2, "0")} ${p.id}</text>`));
  assert.match(svg, /matrix\(/);
  const box = fitBox(cam, phases);
  assert.ok(box.w > 300 && box.h > 200 && box.w < 1500);
  const done = createMachine(phases); while (!done.snapshot().done) done.step();
  for (const part of [...staticParts(phases), ...dynamicParts(phases, settle(done))]) {
    const b = bounds(part);
    for (const x of [b.x0, b.x1]) for (const y of [b.y0, b.y1]) for (const z of [b.z0, b.z1]) {
      const [sx, sy] = cam.project(x, y, z);
      assert.ok(sx >= box.x && sx <= box.x + box.w && sy >= box.y && sy <= box.y + box.h, `${part.id} is outside the view box`);
    }
  }
});
