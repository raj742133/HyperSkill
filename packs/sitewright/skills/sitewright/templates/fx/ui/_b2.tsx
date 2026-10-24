'use client';
// Shared helpers for the batch-2 charts (pie, ring, radar, funnel, gauge, heatmap, sankey, tile map). React + SVG only.
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';

export const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 1 });
export const r2 = (n: number) => Math.round(n * 100) / 100;
export const series = (i: number) => `var(--ui-c${((i % 6) + 6) % 6})`;
/** sequential scale step 0..4 built from tints of the brand colour (0 = empty) */
export const STEPS = [0, 12, 30, 52, 76, 100];
export const heatFill = (level: number) =>
  level <= 0 ? 'var(--raised-2, #e5e7eb)' : `color-mix(in oklab, var(--primary, #2563eb) ${[0, 24, 46, 72, 100][Math.min(4, level)]}%, var(--raised, #f4f4f5))`;
export const level = (v: number, min: number, max: number, steps = 4) =>
  v <= min && min <= 0 ? 0 : Math.min(steps, 1 + Math.floor(((v - min) / (max - min || 1)) * steps * 0.9999));
export function seeded(seed: number) {
  let s = seed >>> 0 || 1;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}

/** polar -> cartesian; 0deg is 12 o'clock, clockwise */
export function polar(cx: number, cy: number, r: number, deg: number): [number, number] {
  const a = ((deg - 90) * Math.PI) / 180;
  return [r2(cx + r * Math.cos(a)), r2(cy + r * Math.sin(a))];
}
/** filled ring slice (ri = 0 gives a pie wedge) */
export function arcPath(cx: number, cy: number, ro: number, ri: number, a0: number, a1: number) {
  const sw = Math.min(a1 - a0, 359.99), e = a0 + sw, big = sw > 180 ? 1 : 0;
  const [x0, y0] = polar(cx, cy, ro, a0), [x1, y1] = polar(cx, cy, ro, e);
  if (ri <= 0.5) return `M${cx} ${cy}L${x0} ${y0}A${ro} ${ro} 0 ${big} 1 ${x1} ${y1}Z`;
  const [x2, y2] = polar(cx, cy, ri, e), [x3, y3] = polar(cx, cy, ri, a0);
  return `M${x0} ${y0}A${ro} ${ro} 0 ${big} 1 ${x1} ${y1}L${x2} ${y2}A${ri} ${ri} 0 ${big} 0 ${x3} ${y3}Z`;
}

/** true once the element scrolled into view (immediately with reduced motion / no IntersectionObserver) */
export function useInView<T extends Element>() {
  const ref = useRef<T>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || typeof IntersectionObserver === 'undefined') { setOn(true); return; }
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { setOn(true); io.disconnect(); } }, { threshold: 0.25 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return [ref, on] as const;
}

export interface Cell { r: number; c: number }
function nav(cells: Cell[] | number, i: number, key: string): number | null {
  const n = typeof cells === 'number' ? cells : cells.length;
  if (key === 'Home') return 0;
  if (key === 'End') return n - 1;
  const list = typeof cells === 'number';
  const map: Record<string, string> = list ? { ArrowRight: 'ArrowDown', ArrowLeft: 'ArrowUp', ArrowDown: 'ArrowDown', ArrowUp: 'ArrowUp' } : {};
  const k = map[key] ?? key;
  if (!['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].includes(k)) return null;
  if (list) return Math.max(0, Math.min(n - 1, i + (k === 'ArrowDown' ? 1 : -1)));
  const me = cells[i];
  let best = i, bs = Infinity;
  cells.forEach((d, j) => {
    const dr = d.r - me.r, dc = d.c - me.c;
    const ok = k === 'ArrowRight' ? dc > 0 : k === 'ArrowLeft' ? dc < 0 : k === 'ArrowDown' ? dr > 0 : dr < 0;
    if (!ok) return;
    const horiz = k === 'ArrowRight' || k === 'ArrowLeft';
    const sc = horiz ? Math.abs(dr) * 100 + Math.abs(dc) : Math.abs(dc) * 100 + Math.abs(dr);
    if (sc < bs) { bs = sc; best = j; }
  });
  return best;
}

/** roving tabindex + arrow-key movement + hover/focus reporting. `cells` is a count (list) or grid positions. */
export function useRoving(cells: Cell[] | number, setHover: (i: number | null) => void) {
  const [active, setActive] = useState(0);
  return (i: number) => ({
    'data-i': i,
    tabIndex: i === active ? 0 : -1,
    onFocus: () => { setActive(i); setHover(i); },
    onBlur: () => setHover(null),
    onMouseEnter: () => setHover(i),
    onMouseLeave: () => setHover(null),
    onKeyDown: (e: KeyboardEvent<Element>) => {
      if (e.key === 'Escape') { setHover(null); return; }
      const j = nav(cells, i, e.key);
      if (j === null) return;
      e.preventDefault();
      if (j !== i) {
        setActive(j);
        (e.currentTarget.closest('.ui-chart2-plot')?.querySelector(`[data-i="${j}"]`) as HTMLElement | null)?.focus();
      }
    },
  });
}

export interface Tip { x: number; y: number; title: string; body?: string }
/** responsive svg + tooltip, animates in once when scrolled into view */
export function Plot({ vb, label, tip, children, className = '', style }: { vb: [number, number]; label: string; tip?: Tip | null; children: ReactNode; className?: string; style?: React.CSSProperties }) {
  const [ref, on] = useInView<HTMLDivElement>();
  const px = tip ? (tip.x / vb[0]) * 100 : 0, py = tip ? (tip.y / vb[1]) * 100 : 0;
  return (
    <div ref={ref} className={`ui-chart2-plot${on ? ' ui-chart2-in' : ''} ${className}`} style={style}>
      <svg viewBox={`0 0 ${vb[0]} ${vb[1]}`} className="ui-chart2-svg" role="group" aria-label={label}>
        <title>{label}</title>
        {children}
      </svg>
      {tip && (
        <div className="ui-chart2-tip" aria-hidden="true" style={{ ['--x' as string]: `${px}%`, ['--y' as string]: `${py}%`, ['--tx' as string]: px < 22 ? '-12%' : px > 78 ? '-88%' : '-50%', ['--ty' as string]: py < 24 ? '14px' : 'calc(-100% - 10px)' }}>
          <strong>{tip.title}</strong>
          {tip.body && <span>{tip.body}</span>}
        </div>
      )}
    </div>
  );
}

/** visually hidden data table for screen readers */
export function DataTable({ caption, head, rows }: { caption: string; head: string[]; rows: (string | number)[][] }) {
  return (
    <table className="ui-chart2-sr">
      <caption>{caption}</caption>
      <thead><tr>{head.map((h, i) => <th key={i} scope="col">{h}</th>)}</tr></thead>
      <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => (j === 0 ? <th key={j} scope="row">{c}</th> : <td key={j}>{c}</td>))}</tr>)}</tbody>
    </table>
  );
}

export function Legend({ items, active, onHover }: { items: { label: string; color: string; value?: string }[]; active?: number | null; onHover?: (i: number | null) => void }) {
  return (
    <ul className="ui-chart2-legend">
      {items.map((it, i) => (
        <li key={i} data-on={active === i ? '' : undefined} onMouseEnter={() => onHover?.(i)} onMouseLeave={() => onHover?.(null)}>
          <i style={{ background: it.color }} aria-hidden="true" />
          <span className="ui-chart2-lab">{it.label}</span>
          {it.value && <span className="ui-chart2-val">{it.value}</span>}
        </li>
      ))}
    </ul>
  );
}

export function ScaleLegend({ min, max, low = 'Less', high = 'More' }: { min: string; max: string; low?: string; high?: string }) {
  return (
    <div className="ui-chart2-scale" aria-hidden="true">
      <span>{low} {min}</span>
      {[0, 1, 2, 3, 4].map((l) => <i key={l} style={{ background: heatFill(l) }} />)}
      <span>{max} {high}</span>
    </div>
  );
}

/* ---------- sankey layout ---------- */
export interface SNode { id: string; label?: string }
export interface SLink { source: string; target: string; value: number }
export interface LNode extends SNode { x: number; y: number; h: number; col: number; v: number; in: number; out: number }
export interface LLink { s: LNode; t: LNode; value: number; w: number; d: string }

export function sankeyLayout(nodes: SNode[], links: SLink[], W: number, H: number, nodeW: number, pad: number) {
  const idx = new Map(nodes.map((n, i) => [n.id, i]));
  const L = links.filter((l) => idx.has(l.source) && idx.has(l.target) && l.source !== l.target && l.value > 0);
  const depth = nodes.map(() => 0);
  for (let it = 0; it < nodes.length; it++) {
    let ch = false;
    for (const l of L) {
      const s = idx.get(l.source) as number, t = idx.get(l.target) as number;
      if (depth[t] < depth[s] + 1 && depth[s] + 1 < nodes.length) { depth[t] = depth[s] + 1; ch = true; }
    }
    if (!ch) break;
  }
  const maxD = Math.max(0, ...depth);
  const ln: LNode[] = nodes.map((n, i) => {
    const inn = L.filter((l) => l.target === n.id).reduce((a, l) => a + l.value, 0);
    const out = L.filter((l) => l.source === n.id).reduce((a, l) => a + l.value, 0);
    const col = out === 0 && inn > 0 ? maxD : depth[i];
    return { ...n, x: maxD ? (col * (W - nodeW)) / maxD : 0, y: 0, h: 0, col, v: Math.max(inn, out, 0.0001), in: inn, out };
  });
  const cols: LNode[][] = [];
  ln.forEach((n) => (cols[n.col] = cols[n.col] || []).push(n));
  const ky = Math.min(...cols.filter(Boolean).map((c) => (H - pad * (c.length - 1)) / c.reduce((a, n) => a + n.v, 0)));
  cols.forEach((c) => { if (!c) return; let y = 0; c.forEach((n) => { n.h = n.v * ky; n.y = y; y += n.h + pad; }); });
  const resolve = (c: LNode[]) => {
    c.sort((a, b) => a.y - b.y);
    let y = 0;
    c.forEach((n) => { n.y = Math.max(n.y, y); y = n.y + n.h + pad; });
    let b = H;
    for (let i = c.length - 1; i >= 0; i--) { c[i].y = Math.min(c[i].y, b - c[i].h); b = c[i].y - pad; }
  };
  const byId = new Map(ln.map((n) => [n.id, n]));
  for (let it = 0; it < 6; it++) {
    for (const dir of [1, -1]) {
      const order = dir === 1 ? cols : [...cols].reverse();
      order.forEach((c) => {
        if (!c) return;
        c.forEach((n) => {
          const rel = L.filter((l) => (dir === 1 ? l.target === n.id : l.source === n.id));
          const tot = rel.reduce((a, l) => a + l.value, 0);
          if (!tot) return;
          const mid = rel.reduce((a, l) => { const o = byId.get(dir === 1 ? l.source : l.target) as LNode; return a + (o.y + o.h / 2) * l.value; }, 0) / tot;
          n.y = mid - n.h / 2;
        });
        resolve(c);
      });
    }
  }
  const sy = new Map<string, number>(), ty = new Map<string, number>();
  const sorted = [...L].sort((a, b) => ((byId.get(a.target) as LNode).y - (byId.get(b.target) as LNode).y));
  const out: LLink[] = [];
  const inOrder = [...L].sort((a, b) => ((byId.get(a.source) as LNode).y - (byId.get(b.source) as LNode).y));
  const tOff = new Map<SLink, number>();
  inOrder.forEach((l) => { const o = ty.get(l.target) || 0; tOff.set(l, o); ty.set(l.target, o + l.value * ky); });
  sorted.forEach((l) => {
    const s = byId.get(l.source) as LNode, t = byId.get(l.target) as LNode, w = l.value * ky;
    const o = sy.get(l.source) || 0; sy.set(l.source, o + w);
    const y0 = s.y + o + w / 2, y1 = t.y + (tOff.get(l) || 0) + w / 2, x0 = s.x + nodeW, x1 = t.x, xm = (x0 + x1) / 2;
    out.push({ s, t, value: l.value, w, d: `M${r2(x0)} ${r2(y0)}C${r2(xm)} ${r2(y0)} ${r2(xm)} ${r2(y1)} ${r2(x1)} ${r2(y1)}` });
  });
  return { nodes: ln, links: out, cols: maxD + 1 };
}
