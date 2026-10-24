import { create, type Figure, type HairlineOptions } from "../mount";
import { mount as engine } from "../engines/scanner";

/** A nine by nine code on a plinth: the pointer sets a scan line, and the dark modules in its row, and the rows beside it, stand up. `intensity` widens the scan. */
export function scanner(el: HTMLElement, options?: HairlineOptions): Figure {
  return create({
    id: "scanner",
    label: "A nine by nine code on a plinth. The pointer sets a scan line: the dark modules in its row stand up, and the rows beside it follow.",
    rest: "rest",
    engine: engine,
  }, el, options);
}
