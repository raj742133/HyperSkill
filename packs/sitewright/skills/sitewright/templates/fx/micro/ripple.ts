import { BTN, hit, reducedMotion } from './selectors';

/** A ripple spreads from where a button is pressed. The element removes itself when the animation ends. */
export function attach(): () => void {
  if (reducedMotion()) return () => undefined;
  const down = (e: PointerEvent) => {
    const el = hit(e, BTN, 'buttons', 'ripple');
    if (!el) return;
    const r = el.getBoundingClientRect();
    const size = Math.max(r.width, r.height) * 2.2;
    const dot = document.createElement('span');
    dot.className = 'fx-ripple';
    dot.setAttribute('aria-hidden', 'true');
    dot.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - r.left - size / 2}px;top:${e.clientY - r.top - size / 2}px`;
    el.appendChild(dot);
    dot.addEventListener('animationend', () => dot.remove(), { once: true });
    setTimeout(() => dot.remove(), 900);
  };
  document.addEventListener('pointerdown', down, { passive: true });
  return () => document.removeEventListener('pointerdown', down);
}
