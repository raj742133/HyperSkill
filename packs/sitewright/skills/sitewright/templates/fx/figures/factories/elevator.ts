import { create, type Figure, type HairlineOptions } from "../mount";
import { mount as engine } from "../engines/elevator";

/** Four floors beside an open shaft. The pointer's height picks a floor, and the car travels there through the ones between. `intensity` makes the car travel faster. */
export function elevator(el: HTMLElement, options?: HairlineOptions): Figure {
  return create({
    id: "elevator",
    label: "Four floors beside an open shaft. The pointer's height picks a floor, and the car travels there through the ones between.",
    rest: "rest",
    engine: engine,
  }, el, options);
}
