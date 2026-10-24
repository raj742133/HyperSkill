import { create, type Figure, type HairlineOptions } from "../mount";
import { mount as engine } from "../engines/laptop";

/** A thin laptop: the pointer's height sets how far the lid stands open, and the lid follows it on a spring. `intensity` lets the lid open wider. */
export function laptop(el: HTMLElement, options?: HairlineOptions): Figure {
  return create({
    id: "laptop",
    label: "A thin laptop: the pointer's height sets how far the lid stands open, and the lid follows it on a spring.",
    rest: "rest",
    engine: engine,
  }, el, options);
}
