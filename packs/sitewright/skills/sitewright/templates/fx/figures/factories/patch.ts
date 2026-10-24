import { create, type Figure, type HairlineOptions } from "../mount";
import { mount as engine } from "../engines/patch";

/** A patch panel of twenty-four ports: the cable under the pointer lifts, and its neighbours lean away, less the further away. `intensity` spreads the lean over more ports. */
export function patch(el: HTMLElement, options?: HairlineOptions): Figure {
  return create({
    id: "patch",
    label: "A patch panel of twenty-four ports: the cable under the pointer lifts, and its neighbours lean away, less the further away.",
    rest: "rest",
    engine: engine,
  }, el, options);
}
