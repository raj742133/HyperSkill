import { create, type Figure, type HairlineOptions } from "../mount";
import { mount as engine } from "../engines/bars";

/** A bar chart on a plinth: the bar under the pointer climbs to the top gridline and its neighbours follow it up. `intensity` lets more bars follow. */
export function bars(el: HTMLElement, options?: HairlineOptions): Figure {
  return create({
    id: "bars",
    label: "A bar chart of seven bars on a plinth. The bar under the pointer climbs to the top gridline and its neighbours follow it up.",
    rest: "rest",
    engine: engine,
  }, el, options);
}
