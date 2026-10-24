import { CARD, coarsePointer, hit, reducedMotion } from './selectors';

/** A soft light follows the pointer across the card under it. The css reads --fx-mx / --fx-my (pixels inside the card). */
export function attach(): () => void {
  if (reducedMotion() || coarsePointer()) return () => undefined;
  let cur: HTMLElement | null = null;
  const reset = (el: HTMLElement | null) => el?.classList.remove('fx-hot');
  const move = (e: PointerEvent) => {
    const el = hit(e, CARD, 'cards', 'spotlight');
    if (cur && cur !== el) reset(cur);
    cur = el;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.classList.add('fx-hot');
    el.style.setProperty('--fx-mx', `${e.clientX - r.left}px`);
    el.style.setProperty('--fx-my', `${e.clientY - r.top}px`);
  };
  const leave = () => { reset(cur); cur = null; };
  document.addEventListener('pointermove', move, { passive: true });
  document.addEventListener('pointerleave', leave);
  return () => { document.removeEventListener('pointermove', move); document.removeEventListener('pointerleave', leave); reset(cur); };
}
