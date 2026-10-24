import { create, type Figure, type HairlineOptions } from "../mount";
import { mount as engine } from "../engines/vault";

/** A vault door: circling the pointer turns its dial, which coasts and catches every ten; on forty its three bolts draw back. `intensity` lets the dial coast longer. */
export function vault(el: HTMLElement, options?: HairlineOptions): Figure {
  return create({
    id: "vault",
    label: "A vault door: circling the pointer turns its dial, which coasts and catches every ten; on forty its three bolts draw back.",
    rest: "rest",
    engine: engine,
  }, el, options);
}
