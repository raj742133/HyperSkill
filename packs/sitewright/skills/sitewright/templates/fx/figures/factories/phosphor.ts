import { create, type Figure, type HairlineOptions } from "../mount";
import { mount as engine } from "../engines/phosphor";

/** A seven by seven dot matrix that plays a loop, and fades like phosphor where the pointer paints it. `intensity` makes the trail linger longer. */
export function phosphor(el: HTMLElement, options?: HairlineOptions): Figure {
  return create({
    id: "phosphor",
    label: "A seven by seven dot matrix on a floating tile that plays a loop, and fades like phosphor where you paint it.",
    rest: "loop",
    engine: engine,
  }, el, options);
}
