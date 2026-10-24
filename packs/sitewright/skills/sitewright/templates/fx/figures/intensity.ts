/**
 * One option, `intensity`, for every figure. Each figure turns it into the
 * one number its engine takes: two straight lines that meet at 0.5, where the
 * number is the figure's default, with the figure's limits at 0 and 1.
 *
 * Sitewright's copy of Hairline's file, with three figures of its own added
 * (bars, scanner, parcel).
 */

export type FigureId = "riffle" | "terrain" | "exploded" | "phosphor" | "slow" | "turntable" | "keyboard" | "elevator" | "phone" | "laptop" | "terminal" | "cabinet" | "branches" | "vault" | "lockers" | "padlock" | "patch" | "dish" | "router" | "bars" | "scanner" | "parcel";

/** Each figure's number at intensity 0, 0.5 and 1. Slow's falls: a slower clock is a stronger answer. */
export const TABLE: Record<FigureId, readonly [number, number, number]> = {
  riffle: [0, 40, 90], // stagger, ms
  terrain: [1.5, 3, 5], // radius, cells
  exploded: [12, 28, 40], // gap, viewBox units
  phosphor: [150, 520, 1500], // afterglow, ms
  slow: [0.6, 0.2, 0.05], // rate, × normal speed
  turntable: [200, 650, 1500], // coast, ms
  keyboard: [1, 2, 3.5], // radius, keys
  elevator: [40, 100, 220], // stiffness, spring units
  phone: [16, 28, 40], // gap, viewBox units
  laptop: [100, 125, 150], // lid, degrees
  terminal: [1, 2, 3.5], // spread, lines
  cabinet: [1.5, 3, 5], // reach, blades
  branches: [1, 3, 6], // reach, commits
  vault: [250, 600, 1500], // coast, ms
  lockers: [55, 90, 120], // opening, degrees
  padlock: [45, 90, 100], // swing, degrees
  patch: [1, 2.5, 5], // radius, ports
  dish: [30, 50, 70], // reach, degrees
  router: [0.5, 1.5, 3], // spread, antennas
  bars: [0.8, 1.6, 3], // reach, bars
  scanner: [1, 2, 3.5], // reach, rows
  parcel: [20, 34, 46], // how far the lid slides back, viewBox units
};

export const DEFAULT = 0.5;

/** An intensity from anything: numeric strings are read, what is not a finite number is the default, the rest is clamped to 0…1. */
export function intensity(value: unknown): number {
  const n = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  if (typeof n !== "number" || !Number.isFinite(n)) return DEFAULT;
  return Math.min(1, Math.max(0, n));
}

/** The figure's own number for an intensity, rounded to three decimals so 0.7 gives Riffle 60 and not 59.99999999999999. */
export function parameter(figure: FigureId, value: unknown): number {
  const [lo, mid, hi] = TABLE[figure];
  const i = intensity(value);
  const v = i <= 0.5 ? lo + (i / 0.5) * (mid - lo) : mid + ((i - 0.5) / 0.5) * (hi - mid);
  return Math.round(v * 1000) / 1000;
}
