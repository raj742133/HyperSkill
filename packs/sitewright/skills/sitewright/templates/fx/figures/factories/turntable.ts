import { create, type Figure, type HairlineOptions } from "../mount";
import { mount as engine } from "../engines/turntable";

/** Blocks on a turntable. A flick across it spins it; it settles on the nearest quarter turn. `intensity` makes the spin coast longer. */
export function turntable(el: HTMLElement, options?: HairlineOptions): Figure {
  return create({
    id: "turntable",
    label: "Blocks on a turntable. Flick across it to spin it; it settles on the nearest quarter turn.",
    rest: "az 045° · el 30°",
    engine: engine,
  }, el, options);
}
