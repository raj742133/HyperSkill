import { test } from "node:test";
import assert from "node:assert/strict";
import { camera, solid, cylinder, drawSolid, drawCylinder, drawPart, renderParts, faceText, viewBoxOf, paintOrder, auditOverlaps, mix, tones, hexToRgb, follow, clamp, ticks } from "./iso.mjs";

const near = (a, b, e = 1e-3) => assert.ok(Math.abs(a - b) < e, `${a} is not ${b}`);

test("projection: at 45 degrees and 30 degrees up, one unit of x goes right and down, one of z goes straight up", () => {
  const c = camera({ az: 45, el: 30 });
  const [x, y] = c.project(1, 0, 0); near(x, Math.SQRT1_2); near(y, Math.SQRT1_2 * 0.5);
  const [x2, y2] = c.project(0, 1, 0); near(x2, -Math.SQRT1_2); near(y2, Math.SQRT1_2 * 0.5);
  const [x3, y3] = c.project(0, 0, 1); near(x3, 0); near(y3, -Math.cos((30 * Math.PI) / 180));
  assert.ok(c.depth(1, 1, 0) > c.depth(0, 0, 0), "a point nearer the +x +y corner is nearer the viewer");
  const s = camera({ scale: 2, ox: 10, oy: 20 }).project(0, 0, 0); assert.deepEqual(s, [10, 20]);
});

test("facing: the +x and +y sides are visible at 45 degrees, the -x and -y sides are not", () => {
  const c = camera({ az: 45 });
  assert.ok(c.facing(1, 0) > 0 && c.facing(0, 1) > 0 && c.facing(-1, 0) < 0 && c.facing(0, -1) < 0);
  const back = camera({ az: 225 });
  assert.ok(back.facing(-1, 0) > 0 && back.facing(0, -1) > 0, "turned half way round, the other two sides show");
});

test("a box draws its top and two sides: three polygons, with the id on the group", () => {
  const svg = drawSolid(camera(), solid("plinth", 0, 0, 0, 10, 10, 5, "#8899aa"));
  assert.equal((svg.match(/<polygon/g) || []).length, 3);
  assert.match(svg, /data-id="plinth"/);
  const flat = drawSolid(camera({ el: 0 }), solid("s", 0, 0, 0, 10, 10, 5, "#8899aa"));
  assert.equal((flat.match(/<polygon/g) || []).length, 2, "seen exactly from the side there is no top");
  const glass = drawSolid(camera(), solid("g", 0, 0, 0, 1, 1, 1, "#88aacc", { opacity: 0.4 }));
  assert.match(glass, /opacity="0.4"/);
});

test("a cylinder is a body, a shade strip and a top ellipse whose height is r times sin(elevation)", () => {
  const svg = drawCylinder(camera({ el: 30 }), { id: "post", x: 0, y: 0, z: 0, r: 10, h: 20, base: "#aa8844" });
  assert.match(svg, /<ellipse[^>]*rx="10"[^>]*ry="5"/);
  assert.match(svg, / A10,5 /);
});

test("painter's order: far boxes are drawn before near ones, and a box below is drawn before the one on it", () => {
  const c = camera({ az: 45, el: 30 });
  const far = solid("far", 0, 0, 0, 10, 10, 10, "#999"), near_ = solid("near", 20, 0, 0, 10, 10, 10, "#999");
  assert.deepEqual(paintOrder([near_, far], c).map((s) => s.id), ["far", "near"]);
  const left = solid("left", 0, 0, 0, 10, 10, 10, "#999"), front = solid("front", 0, 20, 0, 10, 10, 10, "#999");
  assert.deepEqual(paintOrder([front, left], c).map((s) => s.id), ["left", "front"]);
  const floor = solid("floor", 0, 0, 0, 40, 40, 2, "#999"), cup = solid("cup", 5, 5, 2, 10, 10, 10, "#999");
  assert.deepEqual(paintOrder([cup, floor], c).map((s) => s.id), ["floor", "cup"]);
  const turned = camera({ az: 225 });
  assert.deepEqual(paintOrder([far, near_], turned).map((s) => s.id), ["near", "far"], "from the other side the order flips");
});

test("painter's order keeps every box even when the relations form a cycle", () => {
  const c = camera();
  const a = solid("a", 0, 10, 0, 20, 10, 10, "#999"), b = solid("b", 10, 0, 0, 10, 20, 10, "#999"), d = solid("d", 0, 0, 5, 30, 30, 2, "#999");
  const out = paintOrder([a, b, d], c);
  assert.equal(out.length, 3); assert.deepEqual(out.map((s) => s.id).sort(), ["a", "b", "d"]);
});

test("audit: boxes that share volume are reported, touching ones are not, soft and allowed pairs are skipped", () => {
  const a = solid("a", 0, 0, 0, 10, 10, 10, "#999"), touching = solid("t", 10, 0, 0, 10, 10, 10, "#999"), inside = solid("i", 5, 5, 5, 10, 10, 10, "#999");
  assert.deepEqual(auditOverlaps([a, touching]), []);
  assert.deepEqual(auditOverlaps([a, inside]), [{ a: "a", b: "i", volume: 125 }]);
  assert.deepEqual(auditOverlaps([a, { ...inside, soft: true }]), [], "water may fill a tank");
  assert.deepEqual(auditOverlaps([a, inside], { allow: ["i|a"] }), [], "a listed pair is allowed in either order");
  assert.deepEqual(auditOverlaps([a, solid("sliver", 9.995, 0, 0, 10, 10, 10, "#999")]), [], "a sliver below the tolerance is a touch");
});

test("colour helpers: mixing, the four tones, and following a target", () => {
  assert.equal(mix("#000000", "#ffffff", 0.5), "#808080");
  assert.deepEqual(hexToRgb("#fa0"), [255, 170, 0]);
  const t = tones("#808080"), sum = (h) => hexToRgb(h).reduce((x, y) => x + y, 0);
  assert.ok(sum(t.top) > sum(t.right) && sum(t.right) > sum(t.left) && sum(t.left) > sum(t.edge), "lit top is lightest, edge is darkest");
  near(follow(0, 10, 1 / 60, 8), 10 * (1 - Math.exp(-8 / 60)));
  assert.equal(follow(5, 5, 0.1), 5); assert.equal(clamp(7, 0, 5), 5);
  assert.match(ticks(camera(), { id: "r", x: 0, y: 0, z: 0, length: 50, n: 10 }), /^<path data-id="r"/);
});

test("renderParts draws parts back to front and puts each overlay straight after its part", () => {
  const c = camera();
  const far = solid("far", 0, 0, 0, 10, 10, 10, "#999", { overlay: () => "<!--far-label-->" }), nearer = solid("near", 20, 0, 0, 10, 10, 10, "#999");
  const svg = renderParts(c, [nearer, far]);
  assert.ok(svg.indexOf('data-id="far"') < svg.indexOf('data-id="near"'), "far first");
  assert.ok(svg.indexOf("<!--far-label-->") > svg.indexOf('data-id="far"') && svg.indexOf("<!--far-label-->") < svg.indexOf('data-id="near"'), "its label comes straight after it");
  assert.match(drawPart(c, cylinder("c", 5, 5, 0, 2, 4, "#aaa")), /<ellipse/);
  assert.match(drawPart(c, nearer), /<polygon/);
});

test("faceText lies on the face: along -y on the +x face it runs to the right and down the screen, and the view box holds the parts", () => {
  const c = camera({ az: 45, el: 30 });
  const t = faceText(c, { id: "t", text: "hi", origin: [0, 0, 0], u: [0, -1, 0], v: [0, 0, -1] });
  const m = t.match(/matrix\(([^)]+)\)/)[1].split(" ").map(Number);
  assert.ok(m[0] > 0 && m[1] < 0, "reading direction goes right and up the screen (away along -y)");
  assert.ok(m[3] > 0, "down the letters goes down the screen");
  const box = viewBoxOf(c, [solid("a", 0, 0, 0, 10, 10, 10, "#999")], 5);
  assert.ok(box.w > 10 && box.h > 10);
});
