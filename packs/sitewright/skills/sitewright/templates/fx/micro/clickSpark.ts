import { reducedMotion } from './selectors';

/** A small burst of sparks where you click. Uses the Web Animations API; every spark removes itself when done. */
export function attach(): () => void {
  if (reducedMotion()) return () => undefined;
  const down = (e: PointerEvent) => {
    const n = 8;
    for (let k = 0; k < n; k++) {
      const s = document.createElement('i');
      s.className = 'fx-spark';
      s.setAttribute('aria-hidden', 'true');
      s.style.left = `${e.clientX}px`;
      s.style.top = `${e.clientY}px`;
      document.body.appendChild(s);
      const a = (k / n) * Math.PI * 2 + Math.random() * 0.5, d = 22 + Math.random() * 26;
      const anim = s.animate(
        [
          { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 },
          { transform: `translate(calc(-50% + ${Math.cos(a) * d}px), calc(-50% + ${Math.sin(a) * d}px)) scale(0.2)`, opacity: 0 },
        ],
        { duration: 520, easing: 'cubic-bezier(.2,.7,.3,1)' },
      );
      anim.onfinish = () => s.remove();
      setTimeout(() => s.remove(), 900);
    }
  };
  document.addEventListener('pointerdown', down, { passive: true });
  return () => document.removeEventListener('pointerdown', down);
}
