import { create, type Figure, type HairlineOptions } from "../mount";
import { mount as engine } from "../engines/branches";

/** A commit graph on a board: the commit under the pointer rises, and its history rises after it, the farther back the less. `intensity` raises more of the history. */
export function branches(el: HTMLElement, options?: HairlineOptions): Figure {
  return create({
    id: "branches",
    label: "A commit graph on a board: the commit under the pointer rises, and its history rises after it, the farther back the less.",
    rest: "rest",
    engine: engine,
  }, el, options);
}
