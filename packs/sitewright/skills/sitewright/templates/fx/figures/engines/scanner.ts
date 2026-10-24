import { Cam, clamp, facing, fit, prism, proj, rings, unproj } from "../core/iso";
import { spring, stepS, type Spring } from "../core/motion";
import { disposer, flatDot, mk, place, pointer, put, register, solid, type FigureMount, type Solid } from "../core/stage";

/**
 * Scanner (a Sitewright figure, in Hairline's style): a nine by nine code on a
 * rounded plinth, like the code a phone scans. Three corner marks, rings of
 * modules around a hollow, stand a little taller; the rest of the dark modules stand on a fixed,
 * hand-made pattern, and the light ones are flat dots. The pointer is put on
 * the ground, which never moves, and the row under it is the scan line: every
 * dark module in that row stands tall and the rows either side follow, the
 * farther the less, each module on its own spring. At rest the top-left mark
 * is the bright one; under the pointer the bright goes to the scanned row.
 * The slider is the reach, in rows.
 *
 * The pattern: Terrain's grid, with the falloff taken along one axis, over
 * modules that are either there or not.
 */

const N = 9, CELL = 13, FOOT = 10.2, LOW = 2.6, MARK = 11, HIGH = 32, EXT = N * CELL, PB = 5;
/** `1` is a dark module. Marks at three corners, a short timing pattern and a scatter between them. */
const CODE = [
  "111010111",
  "101001101",
  "111110111",
  "000101000",
  "110011011",
  "001100100",
  "111010101",
  "101111011",
  "111001100",
];
const MARKS: ReadonlyArray<readonly [number, number]> = [[0, 0], [6, 0], [0, 6]];
const inMark = (i: number, j: number) => MARKS.some(([a, b]) => i >= a && i < a + 3 && j >= b && j < b + 3);

/** The share of a module's climb, u rows from the scan line to the reach: all of it on the line, none past the reach. */
const falloff = (u: number) => (u >= 1 ? 0 : (1 - u) * (1 - u));

/** A module's height at rest: the three corner marks stand a little taller than the data. */
const rest = (mark: boolean) => (mark ? MARK : LOW);

type Mod = { i: number; j: number; mark: boolean; sp: Spring; el: Solid; ring: ReturnType<typeof rings>; drawn: number };

export const mount: FigureMount = ({ stage, svg, read }, value) => {
  const bag = disposer();
  const C = Cam(45, 0.5, 1.6);
  fit(C, [[-7, -7, -PB], [EXT + 7, EXT + 7, -PB], [EXT + 7, -7, -PB], [-7, EXT + 7, -PB], [0, 0, HIGH + 4]], 200, 168);
  const P = proj(C), front = facing(C);
  let R = value, row: number | null = null;

  const g = mk("g", {}, svg);
  const [pr, pi] = rings(-7, -7, EXT + 7, EXT + 7, 8, 2.2);
  put(solid(g), prism(P, front, pr, pi, -PB, 0));

  // Light modules: flat dots on the plinth, under everything that stands.
  const dots: SVGEllipseElement[] = [];
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) if (CODE[j]![i] === "0") dots.push(flatDot(g, C, 0.5, "dot off"));
  let k = 0;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) if (CODE[j]![i] === "0") place(dots[k++]!, P((i + 0.5) * CELL, (j + 0.5) * CELL, 0));

  // Dark modules, diagonal by diagonal from the far corner, so appending is painting back to front.
  const mods: Mod[] = [];
  const rowMods: Mod[][] = Array.from({ length: N }, () => []);
  for (let s = 0; s <= 2 * (N - 1); s++) for (let i = 0; i < N; i++) {
    const j = s - i;
    if (j < 0 || j >= N || CODE[j]![i] !== "1") continue;
    const x0 = i * CELL + (CELL - FOOT) / 2, y0 = j * CELL + (CELL - FOOT) / 2;
    const m: Mod = { i, j, mark: inMark(i, j), sp: spring(rest(inMark(i, j)), { eps: 0.04 }), el: solid(g), ring: rings(x0, y0, x0 + FOOT, y0 + FOOT, 2.4, 0.9), drawn: NaN };
    mods.push(m); rowMods[j]!.push(m);
  }

  function draw(m: Mod) {
    const h = Math.max(0.6, m.sp.x);
    if (h === m.drawn) return;
    m.drawn = h;
    put(m.el, prism(P, front, m.ring[0], m.ring[1], 0, h));
  }
  /** The bright stroke: the first mark at rest, the scanned row under the pointer. */
  function light() {
    for (const m of mods) m.el.sil.classList.toggle("hi", row === null ? m.i < 3 && m.j < 3 : m.j === row);
  }
  light();

  const B = register(stage, (dt) => {
    let moving = false;
    for (const m of mods) { if (stepS(m.sp, dt)) moving = true; draw(m); }
    return moving;
  });
  bag.add(B.unregister);

  function retarget() {
    for (const m of mods) { const b = rest(m.mark); m.sp.t = row === null ? b : b + (HIGH - b) * falloff(Math.abs(m.j - row) / (R + 0.5)); }
    light();
    read.textContent = row === null ? "rest" : "row " + String(row + 1).padStart(2, "0");
    B.wake();
  }

  // The hit test: the pointer is put on the ground, which never moves, and the row is the one it stands in.
  bag.add(pointer(stage, {
    move: (p) => {
      const [x, y] = unproj(C, p[0], p[1], 0);
      row = x < -9 || x > EXT + 9 || y < -9 || y > EXT + 9 ? null : clamp(Math.floor(y / CELL), 0, N - 1);
      retarget();
    },
    leave: () => { row = null; retarget(); },
  }));
  bag.add(() => svg.replaceChildren());

  return {
    set: (v) => { R = v; if (row !== null) retarget(); },
    destroy: bag.dispose,
  };
};
