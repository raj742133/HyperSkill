'use client';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { clamp, usePrefs } from './_n2';

export type WheelItem = string | { value: string; label: string };
export interface WheelPickerProps {
  items?: WheelItem[];
  value?: string;
  defaultValue?: string;
  onChange?: (value: string, index: number) => void;
  label?: string;
  /** Row height in px. */
  itemHeight?: number;
  className?: string;
}

const STEP = 24; // degrees between rows
const norm = (i: WheelItem) => (typeof i === 'string' ? { value: i, label: i } : i);
const DEFAULT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** iOS-style vertical wheel: drag or flick with inertia, mouse wheel, arrow keys or typeahead; snaps to a row. */
export default function WheelPicker({ items = DEFAULT, value, defaultValue, onChange, label = 'Choose a value', itemHeight = 36, className }: WheelPickerProps) {
  const list = items.map(norm);
  const uid = useId();
  const { reduced } = usePrefs();
  const idxOf = (v?: string) => Math.max(0, list.findIndex((o) => o.value === v));
  const [sel, setSel] = useState(() => idxOf(value ?? defaultValue));
  const [pos, setPos] = useState(sel);
  const st = useRef({ pos: sel, vel: 0, target: sel, raf: 0, drag: false, lastY: 0, lastT: 0, wheelAcc: 0, buf: '', bufT: 0 });
  const box = useRef<HTMLDivElement>(null);
  const selRef = useRef(sel);
  const cb = useRef({ list, onChange, reduced });
  cb.current = { list, onChange, reduced };
  const R = itemHeight / (2 * Math.tan((STEP / 2) * (Math.PI / 180)));
  const max = list.length - 1;

  const frame = useCallback(() => {
    const s = st.current;
    if (!s.drag) {
      const k = 0.16, c = 0.62;
      s.vel = (s.vel + (s.target - s.pos) * k) * c;
      s.pos += s.vel;
      if (Math.abs(s.target - s.pos) < 0.002 && Math.abs(s.vel) < 0.002) { s.pos = s.target; s.vel = 0; setPos(s.pos); s.raf = 0; return; }
    }
    setPos(s.pos);
    s.raf = requestAnimationFrame(frame);
  }, []);
  const run = useCallback(() => { const s = st.current; if (cb.current.reduced) { s.pos = s.target; s.vel = 0; setPos(s.pos); } else if (!s.raf) s.raf = requestAnimationFrame(frame); }, [frame]);
  const commit = useCallback((i: number) => {
    const n = clamp(Math.round(i), 0, cb.current.list.length - 1);
    st.current.target = n;
    if (selRef.current !== n) { selRef.current = n; setSel(n); cb.current.onChange?.(cb.current.list[n]!.value, n); }
    run();
  }, [run]);

  // controlled value
  useEffect(() => {
    if (value === undefined) return;
    const i = Math.max(0, cb.current.list.findIndex((o) => o.value === value));
    st.current.target = i; selRef.current = i; setSel(i); run();
  }, [value, run]);
  useEffect(() => () => cancelAnimationFrame(st.current.raf), []);

  // wheel needs a non-passive listener
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      const s = st.current;
      const at = s.target;
      s.wheelAcc += e.deltaMode === 1 ? e.deltaY * 30 : e.deltaY;
      if (Math.abs(s.wheelAcc) < 40) { e.preventDefault(); return; }
      const dir = Math.sign(s.wheelAcc); s.wheelAcc = 0;
      if ((dir < 0 && at <= 0) || (dir > 0 && at >= cb.current.list.length - 1)) return; // let the page scroll at the ends
      e.preventDefault();
      commit(at + dir);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [commit]);

  const down = (e: React.PointerEvent) => {
    const s = st.current;
    s.drag = true; s.vel = 0; s.lastY = e.clientY; s.lastT = e.timeStamp;
    e.currentTarget.setPointerCapture(e.pointerId);
    box.current?.focus({ preventScroll: true });
  };
  const moveP = (e: React.PointerEvent) => {
    const s = st.current;
    if (!s.drag) return;
    const dy = e.clientY - s.lastY, dt = Math.max(1, e.timeStamp - s.lastT);
    s.pos = clamp(s.pos - dy / (R * (STEP * Math.PI / 180)), -0.4, max + 0.4);
    s.vel = 0.8 * s.vel + 0.2 * (-dy / (R * (STEP * Math.PI / 180))) * (16 / dt);
    s.lastY = e.clientY; s.lastT = e.timeStamp;
    setPos(s.pos);
  };
  const up = (e: React.PointerEvent) => {
    const s = st.current;
    if (!s.drag) return;
    s.drag = false;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    const v = s.vel; s.vel = v * 0.5;
    commit(s.pos + v * 6);
  };
  const key = (e: React.KeyboardEvent) => {
    const s = st.current, at = s.target;
    const go = (i: number) => { e.preventDefault(); commit(i); };
    if (e.key === 'ArrowDown') go(at + 1);
    else if (e.key === 'ArrowUp') go(at - 1);
    else if (e.key === 'PageDown') go(at + 3);
    else if (e.key === 'PageUp') go(at - 3);
    else if (e.key === 'Home') go(0);
    else if (e.key === 'End') go(max);
    else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      s.buf = e.timeStamp - s.bufT > 700 ? e.key.toLowerCase() : s.buf + e.key.toLowerCase();
      s.bufT = e.timeStamp;
      const q = s.buf;
      const from = q.length === 1 ? at + 1 : at;
      const hit = [...list.slice(from), ...list.slice(0, from)].find((o) => o.label.toLowerCase().startsWith(q));
      if (hit) go(list.indexOf(hit));
    }
  };

  return (
    <div className={`ui-wheel-picker${className ? ' ' + className : ''}`} style={{ ['--ui-wheel-h' as string]: `${itemHeight}px` }}>
      <div
        ref={box}
        role="listbox"
        tabIndex={0}
        aria-label={label}
        aria-activedescendant={`${uid}-${sel}`}
        className="ui-wheel-picker-box"
        style={{ height: itemHeight * 5, touchAction: 'none' }}
        onPointerDown={down}
        onPointerMove={moveP}
        onPointerUp={up}
        onPointerCancel={up}
        onKeyDown={key}
      >
        <div className="ui-wheel-picker-band" style={{ height: itemHeight }} aria-hidden="true" />
        <div className="ui-wheel-picker-stage" style={{ transform: `translateZ(${-R}px)` }}>
          {list.map((o, i) => {
            const d = i - pos;
            const hide = Math.abs(d) > 3.4;
            return (
              <div
                key={o.value}
                id={`${uid}-${i}`}
                role="option"
                aria-selected={i === sel}
                className="ui-wheel-picker-item"
                style={{ height: itemHeight, lineHeight: `${itemHeight}px`, top: `calc(50% - ${itemHeight / 2}px)`, transform: `rotateX(${-d * STEP}deg) translateZ(${R}px)`, opacity: hide ? 0 : clamp(1 - Math.abs(d) * 0.1, 0.78, 1), fontWeight: i === sel ? 650 : 450, visibility: hide ? 'hidden' : 'visible' }}
                onClick={() => commit(i)}
              >
                {o.label}
              </div>
            );
          })}
        </div>
      </div>
      <span className="ui-wheel-picker-sr" role="status" aria-live="polite">{list[sel]?.label}</span>
    </div>
  );
}

export function Demo() {
  const [v, setV] = useState('Wed');
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, height: 150 }}>
      <div style={{ width: 120, transform: 'scale(0.78)', transformOrigin: 'center' }}>
        <WheelPicker label="Day of week" defaultValue="Wed" onChange={setV} />
      </div>
      <p style={{ margin: 0, fontFamily: 'var(--font-body, system-ui)', color: 'var(--ink, #111)', fontSize: 14 }}>
        <span style={{ color: 'var(--muted, #555)', display: 'block', fontSize: 12 }}>Picked</span>
        <strong>{v}</strong>
      </p>
    </div>
  );
}
