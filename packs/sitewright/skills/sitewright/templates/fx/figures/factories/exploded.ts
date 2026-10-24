import { create, type Figure, type HairlineOptions } from "../mount";
import { mount as engine } from "../engines/exploded";

/** An app window in four layers. Moving across opens the gap; moving down picks a layer. `intensity` opens the layers further. */
export function exploded(el: HTMLElement, options?: HairlineOptions): Figure {
  return create({
    id: "exploded",
    label: "An app window taken apart into four layers. Moving across opens the gap; moving down picks a layer.",
    rest: "",
    engine: engine,
  }, el, options);
}
