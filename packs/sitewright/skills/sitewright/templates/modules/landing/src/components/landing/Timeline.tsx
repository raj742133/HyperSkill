'use client';

import { useEffect, useRef, useState } from 'react';
import site from '@/content/site.json';

interface TimelineCfg {
  kicker: string; title: string; lead?: string;
  items: { n: string; name: string; year?: string; first?: string }[];
  okText?: string;
  facts?: { title: string; text: string; mono?: boolean }[];
}

const T = site.landing.compat as unknown as TimelineCfg;
const ITEMS = T.items;

/** A medal's glyph: the item's short label (a number, a letter, a tier) inside the ring. */
function Glyph({ n }: { n: string }) {
  return <span className="dz glyph" aria-hidden="true">{n}</span>;
}

/**
 * Compatibility / roadmap / tiers as a rail. Two rails - the brand's primary and signal colours, like the story's road - write
 * themselves along the items as the card scrolls into view, filling each one as they pass it. Tap one to see it up top.
 * Wide screens lay the rail across; narrow screens stack it down the page.
 */
export function Timeline() {
  const [sel, setSel] = useState(0);
  const rail = useRef<HTMLDivElement>(null);
  const medals = useRef<(HTMLSpanElement | null)[]>([]);

  useEffect(() => {
    const el = rail.current;
    if (!el) return;
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = 0;
    const tick = () => {
      raf = 0;
      const box = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const p = still ? 1 : Math.min(1, Math.max(0, (vh * 0.92 - box.top) / (vh * 0.5)));
      el.style.setProperty('--p', p.toFixed(4));
      // the tips glow while the rails are still being written
      if (p > 0 && p < 1) el.dataset.writing = ''; else delete el.dataset.writing;
      const across = getComputedStyle(el).getPropertyValue('--across').trim() === '1';
      const len = across ? box.width : box.height;
      const pos = p * len;
      medals.current.forEach((m) => {
        if (!m) return;
        const b = m.getBoundingClientRect();
        const start = across ? b.left - box.left : b.top - box.top;
        const size = across ? b.width : b.height;
        const f = Math.min(1, Math.max(0, (pos - start + size / 2) / size));
        m.style.setProperty('--f', f.toFixed(3));
        if (f >= 0.5) m.dataset.reached = ''; else delete m.dataset.reached;
      });
    };
    const on = () => { if (!raf) raf = requestAnimationFrame(tick); };
    tick();
    window.addEventListener('scroll', on, { passive: true });
    window.addEventListener('resize', on);
    return () => { window.removeEventListener('scroll', on); window.removeEventListener('resize', on); cancelAnimationFrame(raf); };
  }, []);

  const v = ITEMS[sel];
  return (
    <>
      <div className="rv">
        <p className="lp-kicker">{T.kicker}</p>
        <h2 className="lp-h2">{T.title}</h2>
        {T.lead ? <p className="lp-lead">{T.lead}</p> : null}
      </div>
      <div className="dev-card rv">
        <div className="dev-top">
          <span key={v.n} className="dev-hero dessert-pop"><Glyph n={v.n} /></span>
          <div key={`t${v.n}`} className="dev-fade">
            <p className="dev-name">{v.name}</p>
            <p className="dev-sub">{v.year}{sel === 0 && v.first ? ` · ${v.first}` : ''}</p>
            <span className="dev-ok"><i>✓</i>{T.okText ?? 'Included'}</span>
          </div>
        </div>
        <div className="dv" ref={rail}>
          <span className="dv-rail" aria-hidden="true">
            <span className="dv-line b"><span className="dv-body" /><span className="dv-tip" /></span>
            <span className="dv-line a"><span className="dv-body" /><span className="dv-tip" /></span>
          </span>
          <ol className="dv-stops">
            {ITEMS.map((x, i) => (
              <li key={x.n}>
                <button type="button" className="dv-btn" aria-pressed={i === sel} aria-label={`${x.name}${x.year ? `, ${x.year}` : ''}`} onClick={() => setSel(i)}>
                  <span className="medal" ref={(m) => { medals.current[i] = m; }} aria-hidden="true">
                    <span className="medal-face"><Glyph n={x.n} /></span>
                    <span className="medal-fill"><span className="medal-face on"><Glyph n={x.n} /></span></span>
                  </span>
                  <span className="dv-label" aria-hidden="true">
                    <b>{x.n}</b><span className="dv-name">{x.name}</span>{x.year ? <small>{x.year}</small> : null}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </div>
      </div>
      {T.facts?.length ? (
        <ul className="dev-facts">
          {T.facts.map((f) => (
            <li key={f.title} className="dev-fact rv"><h4 className={f.mono ? 'mono' : ''}>{f.title}</h4><p>{f.text}</p></li>
          ))}
        </ul>
      ) : null}
    </>
  );
}
