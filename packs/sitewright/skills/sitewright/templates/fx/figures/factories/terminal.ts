import { create, type Figure, type HairlineOptions } from "../mount";
import { mount as engine } from "../engines/terminal";

/** A terminal window: the pointer's height scrolls back through its history, and the line under it lifts off the screen. `intensity` spreads the lift over more lines. */
export function terminal(el: HTMLElement, options?: HairlineOptions): Figure {
  return create({
    id: "terminal",
    label: "A terminal window: the pointer's height scrolls back through its history, and the line under it lifts off the screen.",
    rest: "rest",
    engine: engine,
  }, el, options);
}
