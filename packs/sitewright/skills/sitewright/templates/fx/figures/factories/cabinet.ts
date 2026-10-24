import { create, type Figure, type HairlineOptions } from "../mount";
import { mount as engine } from "../engines/cabinet";

/** A rack of twelve blades: the pointer's height pulls the nearest ones out on their rails, the farther the less. `intensity` pulls out more blades. */
export function cabinet(el: HTMLElement, options?: HairlineOptions): Figure {
  return create({
    id: "cabinet",
    label: "A rack of twelve blades: the pointer's height pulls the nearest ones out on their rails, the farther the less.",
    rest: "rest",
    engine: engine,
  }, el, options);
}
