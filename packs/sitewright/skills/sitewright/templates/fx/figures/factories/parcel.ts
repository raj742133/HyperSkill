import { create, type Figure, type HairlineOptions } from "../mount";
import { mount as engine } from "../engines/parcel";

/** A shipping box: the pointer's height opens it, the lid slides back and lifts, and what is inside rises out. `intensity` slides the lid further back. */
export function parcel(el: HTMLElement, options?: HairlineOptions): Figure {
  return create({
    id: "parcel",
    label: "A shipping box. The pointer's height opens it: the lid slides back and lifts, and what is inside rises out.",
    rest: "rest",
    engine: engine,
  }, el, options);
}
