import { create, type Figure, type HairlineOptions } from "../mount";
import { mount as engine } from "../engines/phone";

/** A phone in layers: glass, board, battery, shell. Moving across opens the gap; moving down picks a layer. `intensity` opens the layers further. */
export function phone(el: HTMLElement, options?: HairlineOptions): Figure {
  return create({
    id: "phone",
    label: "A phone in layers: glass, board, battery, shell. Moving across opens the gap; moving down picks a layer.",
    rest: "rest",
    engine: engine,
  }, el, options);
}
