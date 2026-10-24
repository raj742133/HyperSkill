import { create, type Figure, type HairlineOptions } from "../mount";
import { mount as engine } from "../engines/keyboard";

/** A sixty-key board. The key under the pointer sinks, and its neighbours follow it down, less the further away. `intensity` widens how far the press reaches. */
export function keyboard(el: HTMLElement, options?: HairlineOptions): Figure {
  return create({
    id: "keyboard",
    label: "A sixty-key board. The key under the pointer sinks, and its neighbours follow it down, less the further away.",
    rest: "rest",
    engine: engine,
  }, el, options);
}
