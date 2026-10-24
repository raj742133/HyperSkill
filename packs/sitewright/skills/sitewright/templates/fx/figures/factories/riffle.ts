import { create, type Figure, type HairlineOptions } from "../mount";
import { mount as engine } from "../engines/riffle";

/** A tray of eight cards. The card under the pointer stands up; the arrow keys walk the cards. `intensity` spreads the ripple further from the pulled card. */
export function riffle(el: HTMLElement, options?: HairlineOptions): Figure {
  return create({
    id: "riffle",
    label: "A tray of eight cards. Hover or use the arrow keys to pull a card.",
    rest: "rest",
    engine: engine,
    focusable: true,
  }, el, options);
}
