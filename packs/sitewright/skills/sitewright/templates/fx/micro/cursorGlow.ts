import { coarsePointer, reducedMotion } from './selectors';

/** A soft glow that trails the pointer across the page. Pointer-events none, so it never gets in the way. */
export function attach(): () => void {
  if (reducedMotion() || coarsePointer()) return () => undefined;
  const el = document.createElement('div');
  el.className = 'fx-cursor';
  el.setAttribute('aria-hidden', 'true');
  document.body.appendChild(el);
  let tx = -999, ty = -999, x = -999, y = -999, raf = 0, on = false;
  const tick = () => {
    x += (tx - x) * 0.16; y += (ty - y) * 0.16;
    el.style.transform = `translate3d(${x - 180}px, ${y - 180}px, 0)`;
    if (Math.abs(tx - x) + Math.abs(ty - y) > 0.5) raf = requestAnimationFrame(tick); else on = false;
  };
  const move = (e: PointerEvent) => {
    if (x === -999) { x = e.clientX; y = e.clientY; el.classList.add('on'); }
    tx = e.clientX; ty = e.clientY;
    if (!on) { on = true; raf = requestAnimationFrame(tick); }
  };
  const leave = () => el.classList.remove('on');
  const enter = () => { if (x !== -999) el.classList.add('on'); };
  window.addEventListener('pointermove', move, { passive: true });
  document.addEventListener('pointerleave', leave);
  document.addEventListener('pointerenter', enter);
  return () => {
    window.removeEventListener('pointermove', move);
    document.removeEventListener('pointerleave', leave);
    document.removeEventListener('pointerenter', enter);
    cancelAnimationFrame(raf);
    el.remove();
  };
}
