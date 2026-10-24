import { create, type Figure, type HairlineOptions } from "../mount";
import { mount as engine } from "../engines/lockers";

/** A bank of twelve lockers, one ajar at rest: the locker under the pointer opens, and the one open before it swings shut. `intensity` opens the door wider. */
export function lockers(el: HTMLElement, options?: HairlineOptions): Figure {
  return create({
    id: "lockers",
    label: "A bank of twelve lockers, one ajar at rest: the locker under the pointer opens, and the one open before it swings shut.",
    rest: "rest",
    engine: engine,
  }, el, options);
}
