import { CARD, clamp, coarsePointer, hit, reducedMotion } from './selectors';

/** Cards tilt toward the pointer (up to ~5 degrees) and a glare follows it. The css reads --fx-rx/ry/gx/gy. */
export function attach(): () => void {
  if (reducedMotion() || coarsePointer()) return () => undefined;
  let cur: HTMLElement | null = null;
  const reset = (el: HTMLElement | null) => { if (el) { el.classList.remove('fx-hot'); el.style.removeProperty('--fx-rx'); el.style.removeProperty('--fx-ry'); } };
  const move = (e: PointerEvent) => {
    const el = hit(e, CARD, 'cards', 'tilt');
    if (cur && cur !== el) reset(cur);
    cur = el;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = clamp((e.clientX - r.left) / r.width, 0, 1), py = clamp((e.clientY - r.top) / r.height, 0, 1);
    el.classList.add('fx-hot');
    el.style.setProperty('--fx-rx', `${((0.5 - py) * 10).toFixed(2)}deg`);
    el.style.setProperty('--fx-ry', `${((px - 0.5) * 10).toFixed(2)}deg`);
    el.style.setProperty('--fx-gx', `${(px * 100).toFixed(1)}%`);
    el.style.setProperty('--fx-gy', `${(py * 100).toFixed(1)}%`);
  };
  const leave = () => { reset(cur); cur = null; };
  document.addEventListener('pointermove', move, { passive: true });
  document.addEventListener('pointerleave', leave);
  return () => { document.removeEventListener('pointermove', move); document.removeEventListener('pointerleave', leave); reset(cur); };
}
