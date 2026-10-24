import { create, type Figure, type HairlineOptions } from "../mount";
import { mount as engine } from "../engines/router";

/** A wifi router whose antennas lean toward the pointer, the nearest the most and the others less the further away. `intensity` spreads the lean over more antennas. */
export function router(el: HTMLElement, options?: HairlineOptions): Figure {
  return create({
    id: "router",
    label: "A wifi router whose antennas lean toward the pointer, the nearest the most and the others less the further away.",
    rest: "rest",
    engine: engine,
  }, el, options);
}
