'use client';
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { clamp, useSpring, type SpringConfig } from './_m1';

export interface ReorderItem { id: string; label: string }

export interface DragReorderProps {
  items?: ReorderItem[];
  onReorder?: (items: ReorderItem[]) => void;
  rowHeight?: number;
  gap?: number;
  className?: string;
}

const SPRING: SpringConfig = { stiffness: 520, damping: 34, mass: 1 };
const DEFAULT_ITEMS: ReorderItem[] = [
  { id: 'design', label: 'Design' }, { id: 'build', label: 'Build' }, { id: 'test', label: 'Test' }, { id: 'ship', label: 'Ship' },
];

function Row(p: { item: ReorderItem; index: number; step: number; height: number; dragY: number | null; grabbed: boolean; total: number;
  onDown: (e: PointerEvent, id: string) => void; onMove: (e: PointerEvent) => void; onUp: (e: PointerEvent) => void; onKey: (e: KeyboardEvent, id: string) => void; onBlur: (id: string) => void }) {
  const dragging = p.dragY !== null;
  const y = useSpring(dragging ? (p.dragY as number) : p.index * p.step, SPRING, dragging);
  return (
    <li className="ui-drag-reorder-item" data-dragging={dragging || undefined} data-grabbed={p.grabbed || undefined} style={{ height: p.height, transform: `translateY(${y}px)`, zIndex: dragging || p.grabbed ? 2 : 1 }}>
      <button type="button" className="ui-drag-reorder-handle" aria-label={`Reorder ${p.item.label}, position ${p.index + 1} of ${p.total}`} aria-pressed={p.grabbed}
        onPointerDown={(e) => p.onDown(e, p.item.id)} onPointerMove={p.onMove} onPointerUp={p.onUp} onPointerCancel={p.onUp}
        onKeyDown={(e) => p.onKey(e, p.item.id)} onBlur={() => p.onBlur(p.item.id)}>
        <svg viewBox="0 0 10 16" width="10" height="16" aria-hidden="true" fill="currentColor">
          {[2, 8, 14].map((cy) => [3, 7].map((cx) => <circle key={`${cx}${cy}`} cx={cx} cy={cy} r="1.2" />))}
        </svg>
      </button>
      <span className="ui-drag-reorder-label">{p.item.label}</span>
      <span className="ui-drag-reorder-pos" aria-hidden="true">{p.index + 1}</span>
    </li>
  );
}

export default function DragReorder({ items = DEFAULT_ITEMS, onReorder, rowHeight: rowHeightProp, gap = 4, className }: DragReorderProps) {
  // rows are finger-sized (44px) on a touch screen, compact (30px) with a mouse
  const [coarse, setCoarse] = useState(false);
  useEffect(() => { const m = window.matchMedia('(pointer: coarse)'); const f = () => setCoarse(m.matches); f(); m.addEventListener('change', f); return () => m.removeEventListener('change', f); }, []);
  const rowHeight = rowHeightProp ?? (coarse ? 44 : 30);
  const [order, setOrder] = useState<ReorderItem[]>(items);
  const [drag, setDrag] = useState<{ id: string; y: number } | null>(null);
  const [grab, setGrab] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const st = useRef({ sy: 0, top: 0, id: '', pid: -1, start: [] as ReorderItem[] });
  const orderRef = useRef(order);
  orderRef.current = order;
  const step = rowHeight + gap;
  const n = order.length;

  const moveTo = (id: string, to: number) => {
    const cur = orderRef.current;
    const from = cur.findIndex((i) => i.id === id);
    if (from < 0 || from === to) return false;
    const nx = cur.slice();
    const [it] = nx.splice(from, 1);
    nx.splice(to, 0, it as ReorderItem);
    orderRef.current = nx;
    setOrder(nx);
    return true;
  };
  const label = (id: string) => orderRef.current.find((i) => i.id === id)?.label ?? '';
  const commit = (id: string) => {
    if (orderRef.current.map((i) => i.id).join() !== st.current.start.map((i) => i.id).join()) onReorder?.(orderRef.current);
    setMsg(`${label(id)} dropped at position ${orderRef.current.findIndex((i) => i.id === id) + 1} of ${n}`);
  };

  const down = (e: PointerEvent, id: string) => {
    if (e.button !== 0) return;
    const idx = order.findIndex((i) => i.id === id);
    st.current = { sy: e.clientY, top: idx * step, id, pid: e.pointerId, start: order };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDrag({ id, y: idx * step });
    setMsg(`Picked up ${label(id)}`);
  };
  const move = (e: PointerEvent) => {
    const s = st.current;
    if (s.pid !== e.pointerId) return;
    const y = clamp(s.top + e.clientY - s.sy, 0, (n - 1) * step);
    setDrag({ id: s.id, y });
    if (moveTo(s.id, clamp(Math.round(y / step), 0, n - 1))) setMsg(`${label(s.id)} moved to position ${orderRef.current.findIndex((i) => i.id === s.id) + 1} of ${n}`);
  };
  const up = (e: PointerEvent) => {
    const s = st.current;
    if (s.pid !== e.pointerId) return;
    s.pid = -1;
    setDrag(null);
    commit(s.id);
  };

  const key = (e: KeyboardEvent, id: string) => {
    const idx = orderRef.current.findIndex((i) => i.id === id);
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      if (grab === id) { setGrab(null); commit(id); }
      else { st.current.start = orderRef.current; setGrab(id); setMsg(`Picked up ${label(id)}, position ${idx + 1} of ${n}. Use arrow keys to move, space to drop.`); }
    } else if (grab === id && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault();
      const to = clamp(idx + (e.key === 'ArrowUp' ? -1 : 1), 0, n - 1);
      if (moveTo(id, to)) setMsg(`${label(id)} moved to position ${to + 1} of ${n}`);
    } else if (grab === id && e.key === 'Escape') {
      e.preventDefault();
      orderRef.current = st.current.start; setOrder(st.current.start); setGrab(null); setMsg(`Cancelled. ${label(id)} back at position ${st.current.start.findIndex((i) => i.id === id) + 1}`);
    }
  };
  const blur = (id: string) => { if (grab === id) { setGrab(null); commit(id); } };

  return (
    <div className={`ui-drag-reorder-root${className ? ' ' + className : ''}`}>
      <ul className="ui-drag-reorder-list" aria-label="Reorderable list" style={{ height: n * step - gap }}>
        {items.length === 0 ? null : [...order].sort((a, b) => (a.id < b.id ? -1 : 1)).map((item) => (
          <Row key={item.id} item={item} index={order.indexOf(item)} step={step} height={rowHeight} total={n} dragY={drag?.id === item.id ? drag.y : null} grabbed={grab === item.id}
            onDown={down} onMove={move} onUp={up} onKey={key} onBlur={blur} />
        ))}
      </ul>
      <p className="ui-drag-reorder-sr" role="status" aria-live="assertive">{msg}</p>
    </div>
  );
}

export function Demo() {
  return <DragReorder />;
}
