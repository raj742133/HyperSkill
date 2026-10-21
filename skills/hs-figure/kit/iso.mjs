// A small isometric drawing kit. Zero dependencies, pure functions, SVG strings out.
// World: x and y lie on the floor, z is up. The camera looks down at `el` degrees, turned `az` degrees around z.
// Everything here is plain JavaScript with no imports, so build.mjs can also inline it into a page (the `export` keywords are stripped).

const rad = (d) => (d * Math.PI) / 180;
const round = (n) => Math.round(n * 100) / 100;
const pt = (p) => `${round(p[0])},${round(p[1])}`;

// ---------------------------------------------------------------- colour
export function hexToRgb(hex) {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
}
export const rgbToHex = (rgb) => "#" + rgb.map((c) => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, "0")).join("");
/** Mix colour `a` toward colour `b` by t (0 = a, 1 = b). */
export function mix(a, b, t) {
  const A = hexToRgb(a), B = hexToRgb(b);
  return rgbToHex(A.map((c, i) => c + (B[i] - c) * t));
}
/** The four tones of a solid: lit top, the two sides, and the edge line. */
export function tones(base) {
  return { top: mix(base, "#ffffff", 0.22), right: base, left: mix(base, "#000000", 0.2), edge: mix(base, "#000000", 0.45) };
}

// ---------------------------------------------------------------- camera
export function camera({ az = 45, el = 30, scale = 1, ox = 0, oy = 0 } = {}) {
  const a = rad(az), e = rad(el);
  const ca = Math.cos(a), sa = Math.sin(a), se = Math.sin(e), ce = Math.cos(e);
  const view = (x, y, z) => {
    const xr = x * ca - y * sa, yr = x * sa + y * ca;
    return { sx: ox + xr * scale, sy: oy + (yr * se - z * ce) * scale, depth: yr };
  };
  return {
    az, el, scale, se, ce,
    project: (x, y, z) => { const v = view(x, y, z); return [v.sx, v.sy]; },
    /** Larger depth is nearer the viewer. */
    depth: (x, y, z) => view(x, y, z).depth,
    /** How much a floor-plane normal (nx, ny) faces the viewer. Above 0 it is visible. */
    facing: (nx, ny) => nx * sa + ny * ca,
    toward: [sa, ca],
  };
}

// ---------------------------------------------------------------- solids
/** An axis-aligned box. `id` and `kind` are for the audit and for debugging. */
export const solid = (id, x, y, z, w, d, h, base, extra = {}) => ({ id, x, y, z, w, d, h, base, ...extra });
export const bounds = (s) => ({ x0: s.x, x1: s.x + s.w, y0: s.y, y1: s.y + s.d, z0: s.z, z1: s.z + s.h });

const SIDES = [
  { n: [1, 0], tone: "right", corners: (b) => [[b.x1, b.y0, b.z0], [b.x1, b.y1, b.z0], [b.x1, b.y1, b.z1], [b.x1, b.y0, b.z1]] },
  { n: [0, 1], tone: "left", corners: (b) => [[b.x0, b.y1, b.z0], [b.x1, b.y1, b.z0], [b.x1, b.y1, b.z1], [b.x0, b.y1, b.z1]] },
  { n: [-1, 0], tone: "left", corners: (b) => [[b.x0, b.y0, b.z0], [b.x0, b.y1, b.z0], [b.x0, b.y1, b.z1], [b.x0, b.y0, b.z1]] },
  { n: [0, -1], tone: "right", corners: (b) => [[b.x0, b.y0, b.z0], [b.x1, b.y0, b.z0], [b.x1, b.y0, b.z1], [b.x0, b.y0, b.z1]] },
];

/** SVG for one box: the faces that point at the camera (the top and up to two sides), with a thin edge line. */
export function drawSolid(cam, s) {
  const b = bounds(s), t = tones(s.base), op = s.opacity ?? 1;
  const poly = (corners, fill) => `<polygon points="${corners.map((c) => pt(cam.project(...c))).join(" ")}" fill="${fill}" stroke="${t.edge}" stroke-width="${s.line ?? 0.6}" stroke-linejoin="round"/>`;
  let out = "";
  for (const side of SIDES) if (cam.facing(...side.n) > 1e-6) out += poly(side.corners(b), t[side.tone]);
  if (cam.el > 0) out += poly([[b.x0, b.y0, b.z1], [b.x1, b.y0, b.z1], [b.x1, b.y1, b.z1], [b.x0, b.y1, b.z1]], t.top);
  return `<g data-id="${s.id}"${op < 1 ? ` opacity="${op}"` : ""}>${out}</g>`;
}

/** A vertical cylinder (a post, a bollard, a funnel). Its footprint circle becomes an ellipse of height r*sin(el). */
export function drawCylinder(cam, c) {
  const t = tones(c.base), r = c.r * cam.scale, ry = r * cam.se;
  const [cx, topY] = cam.project(c.x, c.y, c.z + c.h), [, botY] = cam.project(c.x, c.y, c.z);
  const body = `M${round(cx - r)},${round(topY)} L${round(cx - r)},${round(botY)} A${round(r)},${round(ry)} 0 0 0 ${round(cx + r)},${round(botY)} L${round(cx + r)},${round(topY)} Z`;
  return `<g data-id="${c.id}"><path d="${body}" fill="${t.right}" stroke="${t.edge}" stroke-width="0.6"/>`
    + `<path d="M${round(cx - r * 0.1)},${round(topY)} L${round(cx - r * 0.1)},${round(botY + ry)} L${round(cx - r)},${round(botY)} L${round(cx - r)},${round(topY)} Z" fill="${t.left}" opacity="0.55"/>`
    + `<ellipse cx="${round(cx)}" cy="${round(topY)}" rx="${round(r)}" ry="${round(ry)}" fill="${t.top}" stroke="${t.edge}" stroke-width="0.6"/></g>`;
}

/** Tick marks along a straight edge on the floor plane: `n` ticks from (x, y, z) in direction `dir` ("x" or "y"). */
export function ticks(cam, { id, x, y, z, length, n, dir = "x", size = 4, color = "#555" }) {
  let d = "";
  for (let i = 0; i <= n; i++) {
    const f = (length * i) / n, long = i % 5 === 0 ? size * 1.6 : size;
    const a = dir === "x" ? [x + f, y, z] : [x, y + f, z];
    const b = dir === "x" ? [x + f, y + long, z] : [x + long, y, z];
    d += `M${pt(cam.project(...a))} L${pt(cam.project(...b))} `;
  }
  return `<path data-id="${id}" d="${d.trim()}" stroke="${color}" stroke-width="0.7" fill="none"/>`;
}

// ---------------------------------------------------------------- painter's order
/**
 * Order boxes back to front. For axis-aligned boxes the rule is exact: if one box lies entirely on the far side of
 * another along x, along y or below it, it must be drawn first. Cycles (rare, and a sign a part should be split in two)
 * fall back to plain depth order. Returns a new array.
 */
export function paintOrder(solids, cam) {
  const [vx, vy] = cam.toward, n = solids.length;
  const bs = solids.map(bounds);
  const behind = (A, B) => (vx > 1e-6 ? A.x1 <= B.x0 : vx < -1e-6 ? B.x1 <= A.x0 : false)
    || (vy > 1e-6 ? A.y1 <= B.y0 : vy < -1e-6 ? B.y1 <= A.y0 : false)
    || (cam.el > 0 ? A.z1 <= B.z0 : B.z1 <= A.z0);
  const after = Array.from({ length: n }, () => []), indeg = new Array(n).fill(0);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (i !== j && behind(bs[i], bs[j]) && !behind(bs[j], bs[i])) { after[i].push(j); indeg[j]++; }
  const key = (i) => cam.depth((bs[i].x0 + bs[i].x1) / 2, (bs[i].y0 + bs[i].y1) / 2, 0) * 1000 + bs[i].z0;
  const ready = [], out = [], done = new Array(n).fill(false);
  for (let i = 0; i < n; i++) if (indeg[i] === 0) ready.push(i);
  while (out.length < n) {
    if (!ready.length) { // a cycle: take the farthest box that is left
      let best = -1;
      for (let i = 0; i < n; i++) if (!done[i] && (best < 0 || key(i) < key(best))) best = i;
      indeg[best] = 0; ready.push(best);
    }
    ready.sort((a, b) => key(a) - key(b));
    const i = ready.shift();
    if (done[i]) continue;
    done[i] = true; out.push(solids[i]);
    for (const j of after[i]) if (--indeg[j] === 0 && !done[j]) ready.push(j);
  }
  return out;
}

// ---------------------------------------------------------------- audit
/**
 * Find boxes that pass through each other. Touching faces are fine; sharing volume is not, unless the pair is listed
 * in `allow` (as "idA|idB") or either box is marked `soft` (water, glass, light).
 */
export function auditOverlaps(solids, { allow = [], eps = 0.01 } = {}) {
  const ok = new Set(allow.flatMap((p) => [p, p.split("|").reverse().join("|")]));
  const found = [];
  for (let i = 0; i < solids.length; i++) for (let j = i + 1; j < solids.length; j++) {
    const A = solids[i], B = solids[j];
    if (A.soft || B.soft || ok.has(`${A.id}|${B.id}`)) continue;
    const a = bounds(A), b = bounds(B);
    const dx = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0), dy = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0), dz = Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0);
    if (dx > eps && dy > eps && dz > eps) found.push({ a: A.id, b: B.id, volume: round(dx * dy * dz) });
  }
  return found;
}


// ---------------------------------------------------------------- more parts, framing, text on a face
/** A vertical cylinder as a part: it has a bounding box (for painter's order and the audit) and a centre and radius (for drawing). */
export const cylinder = (id, cx, cy, z, r, h, base, extra = {}) => ({ id, shape: "cyl", cx, cy, r, x: cx - r, y: cy - r, z, w: 2 * r, d: 2 * r, h, base, ...extra });
/** Draw any part: boxes and cylinders. */
export const drawPart = (cam, s) => (s.shape === "cyl" ? drawCylinder(cam, { id: s.id, x: s.cx, y: s.cy, z: s.z, r: s.r, h: s.h, base: s.base }) : drawSolid(cam, s));

/** The whole picture as SVG markup: parts in painter's order, each followed by its `overlay(cam)` markup if it has one. */
export const renderParts = (cam, parts) => paintOrder(parts, cam).map((s) => drawPart(cam, s) + (s.overlay ? s.overlay(cam) : "")).join("");

/** The view box that fits every part with a margin: { x, y, w, h }. */
export function viewBoxOf(cam, solids, pad = 24) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const s of solids) {
    const b = bounds(s);
    for (const x of [b.x0, b.x1]) for (const y of [b.y0, b.y1]) for (const z of [b.z0, b.z1]) {
      const [sx, sy] = cam.project(x, y, z);
      x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy);
    }
  }
  return { x: round(x0 - pad), y: round(y0 - pad), w: round(x1 - x0 + 2 * pad), h: round(y1 - y0 + 2 * pad) };
}

/**
 * Text lying on a flat face, in perspective of the drawing. `origin` is where the baseline starts, `u` the direction the
 * text reads along and `v` the direction "down the letters" runs, both unit vectors in world space.
 * On the +x face of a box seen from the front, the text reads along -y and goes down along -z.
 */
export function faceText(cam, { id, text, origin, u, v, size = 8, fill = "#222", family = "ui-monospace, Menlo, monospace", weight = 600 }) {
  const o = cam.project(...origin);
  const pu = cam.project(origin[0] + u[0], origin[1] + u[1], origin[2] + u[2]);
  const pv = cam.project(origin[0] + v[0], origin[1] + v[1], origin[2] + v[2]);
  const m = [pu[0] - o[0], pu[1] - o[1], pv[0] - o[0], pv[1] - o[1], o[0], o[1]].map(round).join(" ");
  return `<text data-id="${id}" transform="matrix(${m})" font-size="${size}" font-family="${family}" font-weight="${weight}" fill="${fill}">${text}</text>`;
}

// ---------------------------------------------------------------- motion helpers
/** Exponential follow: move `current` toward `target`, frame-rate independent. `rate` is per second. */
export const follow = (current, target, dt, rate = 8) => current + (target - current) * (1 - Math.exp(-rate * dt));
export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
