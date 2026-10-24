import { Cam, clamp, facing, fit, poly, prism, proj, ringAt, rings, rrect, type Vec3 } from "../core/iso";
import { spring, stepS } from "../core/motion";
import { disposer, flatDot, mk, place, pointer, put, register, solid, type FigureMount } from "../core/stage";

/**
 * Parcel (a Sitewright figure, in Hairline's style): a shipping box with its
 * lid on. The pointer's height sets how far the box is open: the lid slides
 * back off the box and lifts, and the thing inside rises out of the opening,
 * on springs, the lid always above it. At rest the lid is a little ajar and
 * the top of the thing inside shows; it is the bright stroke. A dot code on
 * the lid says it is a parcel without a word. The slider is how far the lid
 * slides back, in viewBox units.
 *
 * The pattern: Laptop's lid, on a box. The lid is always entirely above the
 * contents, so it can always be painted last: along any line of sight the
 * higher part is the nearer, and no reordering is needed.
 */

const W = 70, D = 56, H = 34, PB = 4, LID_T = 5, LIFT = 36, RISE = 26, REST = 0.32;

export const mount: FigureMount = ({ stage, svg, read }, value) => {
  const bag = disposer();
  const C = Cam(45, 0.5, 1.62);
  let slide = value;
  const reach = 46;
  const corners: Vec3[] = [
    [-2, -2 - reach, H + LIFT + LID_T], [W + 2, -2 - reach, H + LIFT + LID_T], [W + 2, D + 2, -PB], [-2, D + 2, -PB], [W + 2, -2, -PB], [0, 0, H + RISE + 4],
  ];
  fit(C, corners, 200, 164);
  const P = proj(C), front = facing(C);
  const open = spring(REST, { eps: 0.002 });

  const g = mk("g", {}, svg);
  // the box, the mouth of it, then what is inside, then the lid
  const [br, bi] = rings(0, 0, W, D, 6, 1.7);
  put(solid(g), prism(P, front, br, bi, -PB, H));
  mk("path", { d: poly(ringAt(P, rrect(7, 7, W - 7, D - 7, 3, 4), H)), class: "lo nf" }, g);
  const [cr, ci] = rings(16, 14, W - 16, D - 14, 3.5, 1.1);
  const inside = solid(g);
  inside.sil.classList.add("hi");
  const [lr, li] = rings(-2, -2, W + 2, D + 2, 7, 1.5);
  const lid = solid(g);
  const code = [0, 1, 2].map((k) => flatDot(g, C, 0.9, k === 0 ? "dot" : "dot m"));

  let drawn = NaN, slid = NaN;
  function draw() {
    const o = open.x;
    if (o === drawn && slide === slid) return;
    drawn = o; slid = slide;
    const h = RISE * o;
    // the contents stand from the mouth; nothing is drawn until there is something to see
    put(inside, h < 0.6 ? { sil: "", crease: "" } : prism(P, front, cr, ci, H, H + h));
    const dy = -slide * o, z = H + LIFT * o;
    const shift = (r: typeof lr) => r.map((q) => ({ ...q, v: q.v + dy }));
    put(lid, prism(P, front, shift(lr), shift(li), z, z + LID_T));
    code.forEach((el, k) => place(el, P(12 + k * 5, D - 12 + dy, z + LID_T)));
  }

  const B = register(stage, (dt) => {
    const moving = stepS(open, dt);
    draw();
    return moving;
  });
  bag.add(B.unregister);

  function aim(o: number | null) {
    open.t = o === null ? REST : o;
    read.textContent = o === null ? "rest" : "open " + String(Math.round(o * 100)).padStart(2, "0") + "%";
    B.wake();
  }

  // The pointer's height on the stage is the input, so there is no geometry to hit: nothing moves out from under it.
  bag.add(pointer(stage, {
    move: (p) => aim(clamp((0.9 - p[1] / 320) / 0.62, 0, 1)),
    leave: () => aim(null),
  }));
  bag.add(() => svg.replaceChildren());

  return {
    set: (v) => { slide = v; draw(); },
    destroy: bag.dispose,
  };
};
