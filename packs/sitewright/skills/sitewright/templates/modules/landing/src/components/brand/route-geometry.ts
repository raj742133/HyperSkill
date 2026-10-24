/**
 * The brand mark - a honeycomb cell with a lens in it -
 * and the home page's road that comes out of it: the cyan lane beams out of the lens through the
 * cell's bottom corner, the blue lane peels off the cell's lower-right corner, and both run down
 * the page as the story's two lanes.
 */

export type Pt = [number, number];

const S60 = Math.sin(Math.PI / 3);


/** The cell's six corners, pointy side up, clockwise from the top. */
export function hexPoints(cx: number, cy: number, r: number): Pt[] {
  return [[cx, cy - r], [cx + r * S60, cy - r / 2], [cx + r * S60, cy + r / 2], [cx, cy + r], [cx - r * S60, cy + r / 2], [cx - r * S60, cy - r / 2]];
}

/**
 * The cell and its road. The cell's left side is cyan and its right side blue; when it opens, the
 * bottom edges fold away and the two sides carry straight on down (a pointy-top cell's sides are
 * vertical, so there is no seam), bend in to the lane column at `laneX` - `half` either side - and
 * run down to `endY`.
 */
export function hexRoad(cx: number, cy: number, r: number, laneX: number, half: number, endY: number, drop = 60) {
  const [top, tr, br, bottom, bl, tl] = hexPoints(cx, cy, r);
  const lane = (from: Pt, x1: number): Pt[] => {
    const y1 = from[1] + drop;
    const dx = x1 - from[0];
    const pts: Pt[] = [from, [from[0], y1]];
    if (Math.abs(dx) > 1) pts.push([x1, y1 + Math.abs(dx)]);
    pts.push([x1, Math.max(endY, y1 + Math.abs(dx) + 1)]);
    return roundFrom(pts, 0, 80);
  };
  return {
    leftSide: [top, tl, bl] as Pt[], rightSide: [top, tr, br] as Pt[],
    leftFloor: [bottom, bl] as Pt[], rightFloor: [bottom, br] as Pt[],
    cyan: lane(bl, laneX - half), blue: lane(br, laneX + half),
  };
}

/** Replaces the corners from index `from` on with smooth arcs of radius `rad` (the tail's bends). */
export function roundFrom(pts: Pt[], from: number, rad: number, steps = 10): Pt[] {
  const out: Pt[] = pts.slice(0, from + 1);
  for (let i = from + 1; i < pts.length - 1; i++) {
    const [a, b, c] = [pts[i - 1], pts[i], pts[i + 1]];
    const la = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const lc = Math.hypot(c[0] - b[0], c[1] - b[1]);
    const k = Math.min(rad, la / 2, lc / 2);
    const p0: Pt = [b[0] + ((a[0] - b[0]) * k) / la, b[1] + ((a[1] - b[1]) * k) / la];
    const p2: Pt = [b[0] + ((c[0] - b[0]) * k) / lc, b[1] + ((c[1] - b[1]) * k) / lc];
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      out.push([
        (1 - t) * (1 - t) * p0[0] + 2 * (1 - t) * t * b[0] + t * t * p2[0],
        (1 - t) * (1 - t) * p0[1] + 2 * (1 - t) * t * b[1] + t * t * p2[1],
      ]);
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

export function toPath(pts: Pt[]): string {
  return pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join('');
}

/** Cumulative length at every point. */
export function lengths(pts: Pt[]): number[] {
  const out = [0];
  for (let i = 1; i < pts.length; i++) out.push(out[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return out;
}

/** How far along the line (from point `from` on, where it only goes down) it has reached height `y`. */
export function lengthAtY(pts: Pt[], cum: number[], from: number, y: number): number {
  if (y <= pts[from][1]) return cum[from];
  for (let i = from + 1; i < pts.length; i++) {
    if (pts[i][1] >= y) {
      const [a, b] = [pts[i - 1], pts[i]];
      const t = b[1] === a[1] ? 1 : (y - a[1]) / (b[1] - a[1]);
      return cum[i - 1] + t * (cum[i] - cum[i - 1]);
    }
  }
  return cum[cum.length - 1];
}

/** The point at length `l` along the line. */
export function pointAt(pts: Pt[], cum: number[], l: number): Pt {
  for (let i = 1; i < pts.length; i++) {
    if (cum[i] >= l) {
      const t = (l - cum[i - 1]) / (cum[i] - cum[i - 1] || 1);
      return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t];
    }
  }
  return pts[pts.length - 1];
}

