'use client';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { prefersReducedMotion, useIsoLayoutEffect } from './_m1';

export interface GalleryItem { id: string; title: string; body: string; tag?: string }

export interface LayoutGalleryProps {
  items?: GalleryItem[];
  className?: string;
}

const DEFAULT_ITEMS: GalleryItem[] = [
  { id: 'a', title: 'Springs', tag: 'Physics', body: 'Stiffness, damping and mass give motion a feel that a fixed duration cannot.' },
  { id: 'b', title: 'Layout', tag: 'FLIP', body: 'Measure first and last, then animate only the transform between the two.' },
  { id: 'c', title: 'Gestures', tag: 'Input', body: 'Hover, press and drag respond to the pointer and to the keyboard.' },
  { id: 'd', title: 'Presence', tag: 'Mount', body: 'Elements stay in the DOM until their exit animation has finished.' },
];

const EASE = 'cubic-bezier(.2,.8,.2,1)';
const flipFrom = (first: DOMRect, last: DOMRect) =>
  `translate(${first.left - last.left}px, ${first.top - last.top}px) scale(${first.width / last.width}, ${first.height / last.height})`;

export default function LayoutGallery({ items = DEFAULT_ITEMS, className }: LayoutGalleryProps) {
  const [openId, setOpenId] = useState<string | null>(null);
  const cards = useRef<Record<string, HTMLButtonElement | null>>({});
  const first = useRef<DOMRect | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const closing = useRef(false);
  const item = items.find((i) => i.id === openId);

  const open = (id: string) => {
    const el = cards.current[id];
    first.current = el ? el.getBoundingClientRect() : null;
    closing.current = false;
    setOpenId(id);
  };

  useIsoLayoutEffect(() => {
    const p = panel.current;
    if (!openId || !p) return;
    closeBtn.current?.focus({ preventScroll: true });
    const f = first.current;
    if (!f || prefersReducedMotion() || !p.animate) return;
    const last = p.getBoundingClientRect();
    p.animate([{ transform: flipFrom(f, last), borderRadius: '10px' }, { transform: 'none', borderRadius: '10px' }], { duration: 340, easing: EASE });
    p.querySelector('.ui-layout-gallery-content')?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 240, delay: 140, easing: 'ease-out', fill: 'backwards' });
  }, [openId]);

  const returnTo = useRef<string | null>(null);
  useEffect(() => {
    if (openId === null && returnTo.current) { cards.current[returnTo.current]?.focus({ preventScroll: true }); returnTo.current = null; }
  }, [openId]);
  const finish = (id: string) => {
    returnTo.current = id;
    setOpenId(null);
  };

  const close = () => {
    const p = panel.current;
    const id = openId;
    if (!id || closing.current) return;
    const card = cards.current[id];
    if (!p || !card || prefersReducedMotion() || !p.animate) return finish(id);
    closing.current = true;
    const a = p.animate([{ transform: 'none' }, { transform: flipFrom(card.getBoundingClientRect(), p.getBoundingClientRect()) }], { duration: 260, easing: EASE, fill: 'forwards' });
    p.querySelector('.ui-layout-gallery-content')?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 120, fill: 'forwards' });
    a.onfinish = () => finish(id);
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
    else if (e.key === 'Tab') { e.preventDefault(); closeBtn.current?.focus(); }
  };

  return (
    <div className={`ui-layout-gallery-root${className ? ' ' + className : ''}`}>
      <ul className="ui-layout-gallery-grid" inert={!!openId}>
        {items.map((it, i) => (
          <li key={it.id}>
            <button
              type="button"
              ref={(el) => { cards.current[it.id] = el; }}
              className="ui-layout-gallery-card"
              data-tone={i % 4}
              style={openId === it.id ? { visibility: 'hidden' } : undefined}
              aria-haspopup="dialog"
              onClick={() => open(it.id)}
            >
              <span className="ui-layout-gallery-tag">{it.tag ?? 'Item'}</span>
              <span className="ui-layout-gallery-title">{it.title}</span>
            </button>
          </li>
        ))}
      </ul>
      {item && (
        <div ref={panel} className="ui-layout-gallery-panel" role="dialog" aria-label={item.title} onKeyDown={onKey}>
          <div className="ui-layout-gallery-content">
            <span className="ui-layout-gallery-tag">{item.tag ?? 'Item'}</span>
            <h3 className="ui-layout-gallery-h">{item.title}</h3>
            <p className="ui-layout-gallery-p">{item.body}</p>
          </div>
          <button ref={closeBtn} type="button" className="ui-layout-gallery-close" aria-label={`Close ${item.title}`} onClick={close}>
            <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
          </button>
        </div>
      )}
    </div>
  );
}

export function Demo() {
  return <LayoutGallery />;
}
