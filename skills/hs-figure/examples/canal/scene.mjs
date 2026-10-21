// The geometry of the canal: one lock chamber per phase, stepping up and away from the viewer.
// Static parts are built once; the parts that move (water, gate leaves, lamps, the boat) are built from the current state.
import { solid, cylinder, renderParts, faceText, follow, clamp, viewBoxOf } from "../../kit/iso.mjs";

export const L = { W: 50, CL: 64, P: 72, GAP: 8, WALL: 6, FLOOR: 36, STEP: 12, WALL_H: 34, CURB_H: 10, WATER_H: 26, LEAF_H: 30 };
export const COLORS = { stone: "#b9ae98", curb: "#cfc4ad", base: "#8f8574", post: "#6b6255", ink: "#14110f", water: "#6fb0d6", hull: "#d93a1c", cabin: "#f3eee4", go: "#4caf68", wait: "#e0a21b" };

export const yb = (i) => -i * L.P;                     // the near edge of chamber i (larger y is nearer the viewer)
export const floorTop = (i) => L.FLOOR + i * L.STEP;

/** Everything that never moves. */
export function staticParts(phases) {
  const { W, CL, GAP, WALL, WALL_H, CURB_H, LEAF_H } = L, out = [];
  phases.forEach((p, i) => {
    const y = yb(i), z = floorTop(i), n = String(i + 1).padStart(2, "0");
    out.push(solid(`floor-${i}`, -WALL, y, 0, W + 2 * WALL, CL, z, COLORS.base));
    out.push(solid(`wall-${i}`, -WALL, y, z, WALL, CL, WALL_H, COLORS.stone));
    out.push(solid(`curb-${i}`, W, y, z, WALL, CL, CURB_H, COLORS.curb));
    const sign = solid(`sign-${i}`, W + 1, y + CL / 2 - 22, z + CURB_H, 2, 44, 15, COLORS.ink);
    sign.overlay = (cam) => faceText(cam, { id: `label-${i}`, text: `${n} ${p.id}`, origin: [W + 3.05, y + CL / 2 + 20.5, z + CURB_H + 10], u: [0, -1, 0], v: [0, 0, -1], size: 5.5, fill: "#f3eee4" });
    out.push(sign);
    out.push(cylinder(`bollard-${i}a`, W + WALL / 2, y + 5, z + CURB_H, 2.6, 7, COLORS.ink));
    out.push(cylinder(`bollard-${i}b`, W + WALL / 2, y + CL - 5, z + CURB_H, 2.6, 7, COLORS.ink));
    // the gate at the far end of the chamber
    out.push(solid(`sill-${i}`, -WALL, y - GAP, 0, W + 2 * WALL, GAP, z, COLORS.base));
    out.push(solid(`postL-${i}`, -WALL, y - GAP, z, WALL, GAP, LEAF_H + 8, COLORS.post));
    out.push(solid(`postR-${i}`, W, y - GAP, z, WALL, GAP, LEAF_H + 8, COLORS.post));
    out.push(solid(`beam-${i}`, -WALL, y - GAP, z + LEAF_H + 8, W + 2 * WALL, GAP, 5, COLORS.ink));
  });
  return out;
}

/** The parts that depend on the state. `anim` holds the smoothed values: { level[], open[], boat: { y, z } }. */
export function dynamicParts(phases, anim) {
  const { W, CL, GAP, LEAF_H, WATER_H } = L, out = [];
  phases.forEach((p, i) => {
    const y = yb(i), z = floorTop(i), lv = clamp(anim.level[i], 0, 1), open = clamp(anim.open[i], 0, 1);
    if (lv > 0.01) out.push(solid(`water-${i}`, 0, y, z, W, CL, lv * WATER_H, COLORS.water, { soft: true, opacity: 0.6, line: 0.3 }));
    out.push(solid(`leaf-${i}`, 0, y - GAP + 1.5, z - open * LEAF_H, W, GAP - 3, LEAF_H, "#3b3a37"));
    out.push(cylinder(`lamp-${i}`, W / 2, y - GAP / 2, z + LEAF_H + 13, 2.4, 3, open > 0.5 ? COLORS.go : COLORS.wait));
  });
  const b = anim.boat;
  out.push(solid("hull", W / 2 - 10, b.y - 16, b.z, 20, 32, 7, COLORS.hull));
  out.push(solid("cabin", W / 2 - 7, b.y - 6, b.z + 7, 14, 14, 9, COLORS.cabin));
  out.push(cylinder("funnel", W / 2, b.y + 1, b.z + 16, 2.4, 7, COLORS.ink)); // stands on the cabin roof
  return out;
}

/** Where the smoothed values should end up for a machine snapshot. */
export function targets(phases, snap) {
  const here = Math.min(snap.phase, phases.length - 1);
  const level = snap.fill.map((f, i) => (snap.gatesOpen[i] && i < here ? 1 : f)); // a chamber behind the boat stays full
  return { level, open: snap.gatesOpen.map((o) => (o ? 1 : 0)), boatY: yb(here) + L.CL / 2, boatLevel: level[here] };
}

export function startAnim(phases, snap) {
  const t = targets(phases, snap);
  return { level: [...t.level], open: [...t.open], boat: { y: t.boatY, z: floorTop(snap.phase) + t.boatLevel * L.WATER_H } };
}

/** Move the smoothed values toward their targets. Returns true while anything is still moving. */
export function stepAnim(phases, snap, anim, dt, instant = false) {
  const t = targets(phases, snap), r = (cur, tar, rate) => (instant ? tar : follow(cur, tar, dt, rate));
  let moving = false;
  const set = (arr, i, v) => { if (Math.abs(v - arr[i]) > 0.002) moving = true; arr[i] = v; };
  t.level.forEach((tar, i) => set(anim.level, i, r(anim.level[i], tar, 2.6)));
  t.open.forEach((tar, i) => set(anim.open, i, r(anim.open[i], tar, 4)));
  const here = Math.min(snap.phase, phases.length - 1);
  const by = r(anim.boat.y, t.boatY, 2.2), bz = r(anim.boat.z, floorTop(here) + (anim.level[here] ?? 0) * L.WATER_H, 3);
  if (Math.abs(by - anim.boat.y) > 0.02 || Math.abs(bz - anim.boat.z) > 0.02) moving = true;
  anim.boat.y = by; anim.boat.z = bz;
  return moving;
}

/** The whole picture as SVG markup, back to front. */
export const renderScene = renderParts;

/** A view box that fits the figure in every state (empty and finished, boat at both ends). */
export function fitBox(cam, phases, pad = 22) {
  const last = phases.length - 1;
  const empty = startAnim(phases, { phase: 0, fill: phases.map(() => 0), gatesOpen: phases.map(() => false) });
  const done = { level: phases.map(() => 1), open: phases.map(() => 1), boat: { y: yb(last) + L.CL / 2, z: floorTop(last) + L.WATER_H } };
  return viewBoxOf(cam, [...staticParts(phases), ...dynamicParts(phases, empty), ...dynamicParts(phases, done)], pad);
}
