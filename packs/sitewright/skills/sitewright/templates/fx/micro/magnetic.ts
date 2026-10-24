import { BTN, clamp, coarsePointer, hit, reducedMotion } from './selectors';

/** Buttons lean toward the pointer while it is over them, then spring back. */
export function attach(): () => void {
  if (reducedMotion() || coarsePointer()) return () => undefined;
  let cur: HTMLElement | null = null;
  const reset = (el: HTMLElement | null) => { if (el) { el.style.removeProperty('--fx-tx'); el.style.removeProperty('--fx-ty'); } };
  const move = (e: PointerEvent) => {
    const el = hit(e, BTN, 'buttons', 'magnetic');
    if (cur && cur !== el) reset(cur);
    cur = el;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--fx-tx', `${clamp((e.clientX - (r.left + r.width / 2)) * 0.22, -9, 9)}px`);
    el.style.setProperty('--fx-ty', `${clamp((e.clientY - (r.top + r.height / 2)) * 0.3, -7, 7)}px`);
  };
  const leave = () => { reset(cur); cur = null; };
  document.addEventListener('pointermove', move, { passive: true });
  document.addEventListener('pointerleave', leave);
  return () => { document.removeEventListener('pointermove', move); document.removeEventListener('pointerleave', leave); reset(cur); };
}
