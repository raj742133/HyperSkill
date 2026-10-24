'use client';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

export interface ScrollFadeItem { id?: string; label: ReactNode; meta?: ReactNode }
export interface ScrollFadeListProps {
  items?: ScrollFadeItem[];
  /** Height of the surface in px. */
  height?: number;
  'aria-label'?: string;
  className?: string;
}

const SAMPLE: ScrollFadeItem[] = ['Invoice 1041 paid', 'New sign-up: Mara', 'Backup completed', 'Deploy to production', 'Comment on "Pricing"', 'Invite accepted', 'Report exported', 'Password changed', 'Webhook retried', 'Plan upgraded'].map((label, i) => ({ id: `s${i}`, label, meta: `${i + 1}h` }));

/** A compact scrollable list; a soft fade shows at the top/bottom edge only while there is more content in that direction. */
export default function ScrollFadeList({ items = SAMPLE, height = 130, 'aria-label': label = 'List', className }: ScrollFadeListProps) {
  const ref = useRef<HTMLUListElement>(null);
  const [edge, setEdge] = useState({ top: false, bottom: false });
  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const top = el.scrollTop > 1, bottom = el.scrollTop + el.clientHeight < el.scrollHeight - 1;
    setEdge((p) => (p.top === top && p.bottom === bottom ? p : { top, bottom }));
  }, []);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, [measure, items, height]);
  return (
    <div className={`ui-scroll-fade-list-root ${className ?? ''}`} data-top={edge.top} data-bottom={edge.bottom} style={{ height }}>
      {/* a scrollable region must be reachable by keyboard */}
      <ul ref={ref} className="ui-scroll-fade-list-ul" role="list" tabIndex={0} aria-label={label} onScroll={measure}>
        {items.map((it, i) => (
          <li key={it.id ?? i} className="ui-scroll-fade-list-item"><span>{it.label}</span>{it.meta !== undefined && <span className="ui-scroll-fade-list-meta">{it.meta}</span>}</li>
        ))}
      </ul>
    </div>
  );
}

export function Demo() { return <ScrollFadeList aria-label="Recent activity" />; }
