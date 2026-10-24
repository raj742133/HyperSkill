import { create, type Figure, type HairlineOptions } from "../mount";
import { mount as engine } from "../engines/padlock";

/** A padlock: as the pointer nears, the shackle springs up out of the body and swings open about its long leg. `intensity` swings the shackle further. */
export function padlock(el: HTMLElement, options?: HairlineOptions): Figure {
  return create({
    id: "padlock",
    label: "A padlock: as the pointer nears, the shackle springs up out of the body and swings open about its long leg.",
    rest: "rest",
    engine: engine,
  }, el, options);
}
