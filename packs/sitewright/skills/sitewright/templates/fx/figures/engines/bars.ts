import { Cam, facing, fit, prism, proj, rings, seg, type Ring } from "../core/iso";
import { spring, stepS, type Spring } from "../core/motion";
import { disposer, mk, pointer, put, register, solid, type FigureMount, type Solid } from "../core/stage";

/**
 * Bars (a Sitewright figure, in Hairline's style): seven bars on a plinth in
 * front of a back wall with three dashed gridlines, a bar chart as a thing
 * on a desk. The pointer picks the nearest bar by its rest column; that
 * bar climbs to the top gridline and its neighbours follow it up, the farther
 * the less, each on its own spring. At rest the chart is a designed trend
 * (a climb with one dip) and its tallest bar is the bright one. The slider is
 * the reach, in bars.
 *
 * The pattern: Terrain's, in one dimension: a spring per column, a falloff by
 * distance, and a hit test on the rest pose, which never moves.
 */

const N = 7, PITCH = 17, W = 11, D = 13, EXT = N * PITCH, HMAX = 60, PB = 5, WALL = 4, WALL_D = 6;
/** Where the chart rests: a climb with one dip, the last bar the tallest. */
const REST = [14, 22, 17, 31, 27, 38, 46];
const TOP = REST.indexOf(Math.max(...REST));

/** The share of the climb a bar takes, u reaches from the pointer: all of it under the pointer, none past the reach. */
const falloff = (u: number) => (u >= 1 ? 0 : (1 - u) * (1 - u));

type Bar = { i: number; ring: Ring; inner: Ring; sp: Spring; el: Solid; drawn: number };

export const mount: FigureMount = ({ stage, svg, read }, value) => {
  const bag = disposer();
  const C = Cam(45, 0.5, 1.7);
  fit(C, [[-8, -WALL_D, -PB], [EXT + 8, -WALL_D, -PB], [EXT + 8, D + 8, -PB], [-8, D + 8, -PB], [0, 0, HMAX + 6]], 200, 168);
  const P = proj(C), front = facing(C);
  let R = value, over: number | null = null, lit: Bar | null = null;

  const g = mk("g", {}, svg);
  // the plinth, then the wall behind the bars with its gridlines painted on it
  const [pr, pi] = rings(-8, -WALL_D, EXT + 8, D + 8, 7, 2.2);
  put(solid(g), prism(P, front, pr, pi, -PB, 0));
  const [wr, wi] = rings(-4, -WALL_D, EXT + 4, -WALL_D + WALL, 1.6, 0.8);
  put(solid(g), prism(P, front, wr, wi, 0, HMAX + 4));
  let guide = "";
  for (const z of [HMAX * 0.34, HMAX * 0.67, HMAX]) guide += seg(P(0, -WALL_D + WALL, z), P(EXT, -WALL_D + WALL, z));
  mk("path", { d: guide, class: "lo dash nf" }, g);

  // Ascending x is towards the viewer, so appending in order is painting back to front.
  const bars: Bar[] = [];
  for (let i = 0; i < N; i++) {
    const x0 = i * PITCH + (PITCH - W) / 2;
    const [ring, inner] = rings(x0, 1, x0 + W, 1 + D, 2.4, 0.9);
    bars.push({ i, ring, inner, sp: spring(REST[i], { eps: 0.04 }), el: solid(g), drawn: NaN });
  }

  function drawBar(b: Bar) {
    const h = Math.max(0.6, b.sp.x);
    if (h === b.drawn) return;
    b.drawn = h;
    put(b.el, prism(P, front, b.ring, b.inner, 0, h));
  }
  function light(b: Bar) {
    if (b === lit) return;
    lit?.el.sil.classList.remove("hi");
    lit = b;
    lit.el.sil.classList.add("hi");
  }
  light(bars[TOP]);

  const B = register(stage, (dt) => {
    let m = false;
    for (const b of bars) { if (stepS(b.sp, dt)) m = true; drawBar(b); }
    return m;
  });
  bag.add(B.unregister);

  function retarget() {
    if (over === null) {
      for (const b of bars) b.sp.t = REST[b.i];
      light(bars[TOP]); read.textContent = "rest";
    } else {
      for (const b of bars) b.sp.t = REST[b.i] + (HMAX - REST[b.i]) * falloff(Math.abs(b.i - over) / (R + 0.5));
      light(bars[over]); read.textContent = "bar " + (over + 1);
    }
    B.wake();
  }

  // The hit test: each bar's rest position on screen never moves, so the pointer takes the bar whose rest column is nearest in x,
  // anywhere over the chart, wall and tops included.
  const cx = bars.map((b) => P(b.i * PITCH + PITCH / 2, 1 + D / 2, 0)[0]);
  const corners = [[-8, -WALL_D, -PB], [EXT + 8, -WALL_D, -PB], [EXT + 8, D + 8, -PB], [-8, D + 8, -PB], [0, 0, HMAX + 6], [EXT, 0, HMAX + 6]] as const;
  const box = corners.map(([x, y, z]) => P(x, y, z));
  const [bx0, bx1, by0, by1] = [Math.min(...box.map((q) => q[0])), Math.max(...box.map((q) => q[0])), Math.min(...box.map((q) => q[1])), Math.max(...box.map((q) => q[1]))];
  bag.add(pointer(stage, {
    move: (p) => {
      if (p[0] < bx0 || p[0] > bx1 || p[1] < by0 || p[1] > by1) over = null;
      else over = cx.reduce((best, x, i) => (Math.abs(x - p[0]) < Math.abs(cx[best]! - p[0]) ? i : best), 0);
      retarget();
    },
    leave: () => { over = null; retarget(); },
  }));
  bag.add(() => svg.replaceChildren());

  return {
    set: (v) => { R = v; if (over !== null) retarget(); },
    destroy: bag.dispose,
  };
};
