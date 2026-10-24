'use client';
import { useEffect, useRef, useState } from 'react';
import { prefersReducedMotion, useFlip } from './_m1';

export interface PresenceListProps {
  initial?: string[];
  /** name for newly added items: receives a running number */
  newLabel?: (n: number) => string;
  max?: number;
  className?: string;
}

interface Row { id: number; text: string }

export default function PresenceList({ initial = ['Design review', 'Ship v2', 'Write docs'], newLabel = (n) => `Task ${n}`, max = 12, className }: PresenceListProps) {
  const [rows, setRows] = useState<Row[]>(() => initial.map((text, i) => ({ id: i + 1, text })));
  const [exiting, setExiting] = useState<number[]>([]);
  const [msg, setMsg] = useState('');
  const next = useRef(initial.length + 1);
  const ul = useRef<HTMLUListElement>(null);
  const els = useRef(new Map<number, HTMLLIElement>());
  const anims = useRef(new Set<Animation>());
  useFlip(ul, rows.length);

  useEffect(() => { const a = anims.current; return () => { a.forEach((x) => { x.onfinish = null; x.cancel(); }); }; }, []);

  const add = () => {
    if (rows.length >= max) return;
    const n = next.current++;
    const text = newLabel(n);
    setRows((r) => [...r, { id: n, text }]);
    setMsg(`Added ${text}`);
  };

  const remove = (row: Row) => {
    const el = els.current.get(row.id);
    setMsg(`Removed ${row.text}`);
    const done = () => { setRows((r) => r.filter((x) => x.id !== row.id)); setExiting((e) => e.filter((x) => x !== row.id)); };
    if (!el || !el.animate || prefersReducedMotion()) return done();
    setExiting((e) => [...e, row.id]);
    const a = el.animate([{ opacity: 1, transform: 'translateX(0) scale(1)' }, { opacity: 0, transform: 'translateX(28px) scale(.96)' }], { duration: 200, easing: 'ease-in', fill: 'forwards' });
    anims.current.add(a);
    a.onfinish = () => { anims.current.delete(a); done(); };
  };

  return (
    <div className={`ui-presence-list-root${className ? ' ' + className : ''}`}>
      <div className="ui-presence-list-head">
        <span className="ui-presence-list-count">{rows.length} {rows.length === 1 ? 'item' : 'items'}</span>
        <button type="button" className="ui-presence-list-add" onClick={add} disabled={rows.length >= max}>Add item</button>
      </div>
      <ul ref={ul} className="ui-presence-list-list" aria-label="Items">
        {rows.map((row) => {
          const out = exiting.includes(row.id);
          return (
            <li key={row.id} ref={(el) => { if (el) els.current.set(row.id, el); else els.current.delete(row.id); }} data-flip-key={row.id} data-exiting={out || undefined} className="ui-presence-list-item">
              <span className="ui-presence-list-text">{row.text}</span>
              <button type="button" className="ui-presence-list-x" aria-label={`Remove ${row.text}`} disabled={out} onClick={() => remove(row)}>
                <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true"><path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
              </button>
            </li>
          );
        })}
      </ul>
      {rows.length === 0 && <p className="ui-presence-list-empty">Nothing here. Add an item.</p>}
      <p className="ui-presence-list-sr" role="status" aria-live="polite">{msg}</p>
    </div>
  );
}

export function Demo() {
  return <PresenceList />;
}
