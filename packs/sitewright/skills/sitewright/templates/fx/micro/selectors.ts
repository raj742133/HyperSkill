/** What the micro-interactions act on. Keep in step with CARD_SELECTOR / BUTTON_SELECTOR in scripts/effects.mjs (the css uses the same lists). */
export const BTN = '__FX_BTN__';
export const CARD = '__FX_CARD__';

export const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
/** Touch screens have no hover, so pointer-follow effects are skipped there. */
export const coarsePointer = () => window.matchMedia('(pointer: coarse)').matches;
export const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** The matching element under the pointer, but only inside a region that switched this effect on (data-fx-ATTR="VALUE"). */
export function hit(e: Event, selector: string, attr: string, value: string): HTMLElement | null {
  const t = (e.target as Element | null)?.closest?.(selector) as HTMLElement | null;
  return t && t.closest(`[data-fx-${attr}='${value}']`) ? t : null;
}
