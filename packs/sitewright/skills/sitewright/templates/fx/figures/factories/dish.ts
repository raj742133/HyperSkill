import { create, type Figure, type HairlineOptions } from "../mount";
import { mount as engine } from "../engines/dish";

/** A parabolic dish on a two-axis gimbal: the pointer aims it, and it follows on a spring. `intensity` swings the dish further. */
export function dish(el: HTMLElement, options?: HairlineOptions): Figure {
  return create({
    id: "dish",
    label: "A parabolic dish on a two-axis gimbal: the pointer aims it, and it follows on a spring.",
    rest: "rest",
    engine: engine,
  }, el, options);
}
