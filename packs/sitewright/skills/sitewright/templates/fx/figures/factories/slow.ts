import { create, type Figure, type HairlineOptions } from "../mount";
import { mount as engine } from "../engines/slow";

/** Crates riding a belt through a gate. Hovering slows the clock without stopping it. `intensity` slows it more. */
export function slow(el: HTMLElement, options?: HairlineOptions): Figure {
  return create({
    id: "slow",
    label: "Crates riding a belt through a gate. Hovering slows the clock without stopping it.",
    rest: "rate 1.00×",
    engine: engine,
  }, el, options);
}
