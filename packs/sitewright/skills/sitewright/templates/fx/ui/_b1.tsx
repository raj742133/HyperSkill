'use client';
// Shared helpers for the chart components (area, bar, line, live line, profit/loss, composed, scatter, candlestick):
// scales, nice ticks, path builders (incl. a monotone curve), hooks (size, in-view, reduced motion), and <Frame>,
// the chart shell that owns the SVG, the keyboard/pointer crosshair, the tooltip and the screen-reader data table.
import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode, type RefObject } from 'react';

export interface Series { name: string; values: number[]; color?: string }
export type Pt = [number, number];
export interface TipRow { color?: string; label?: string; value: string }
export interface Tip { x: number; y: number; title: string; rows: TipRow[] }

/* ---------- scales and ticks ---------- */
export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
export const scaleLinear = (d0: number, d1: number, r0: number, r1: number) => (v: number) => (d1 === d0 ? (r0 + r1) / 2 : r0 + ((v - d0) / (d1 - d0)) * (r1 - r0));
export function scaleBand(n: number, r0: number, r1: number, padding = 0.25) {
  const step = (r1 - r0) / Math.max(1, n);
  const bw = step * (1 - padding);
  return { step, bw, x: (i: number) => r0 + i * step + (step - bw) / 2, mid: (i: number) => r0 + i * step + step / 2 };
}
function niceStep(raw: number) {
  const p = 10 ** Math.floor(Math.log10(raw || 1));
  const f = raw / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p;
}
export function niceTicks(min: number, max: number, count = 5) {
  if (!(max > min)) max = min + 1;
  const step = niceStep((max - min) / Math.max(1, count - 1));
  const lo = Math.floor(min / step + 1e-9) * step;
  const hi = Math.ceil(max / step - 1e-9) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(+v.toFixed(10));
  return { ticks, min: lo, max: hi };
}
/** Zero-based ticks with exactly `intervals` steps, so a second axis lines up with the first one's grid. */
export function alignedTicks(max: number, intervals: number) {
  const step = niceStep((max || 1) / intervals);
  return Array.from({ length: intervals + 1 }, (_, i) => +(i * step).toFixed(10));
}
export const thin = (n: number, width: number, gap = 52) => Math.max(1, Math.ceil(n / Math.max(1, Math.floor(width / gap))));

/* ---------- formatting ---------- */
export function fmt(v: number): string {
  const a = Math.abs(v), s = v < 0 ? '−' : '';
  const t = (x: number) => String(+x.toFixed(1));
  return a >= 1e6 ? `${s}${t(a / 1e6)}M` : a >= 1e3 ? `${s}${t(a / 1e3)}k` : `${s}${+a.toFixed(2)}`;
}
export const signed = (v: number, f: (n: number) => string = fmt) => (v > 0 ? '+' : v < 0 ? '−' : '') + f(Math.abs(v));

/* ---------- paths ---------- */
const r1 = (n: number) => +n.toFixed(2);
export const linePath = (p: Pt[]) => p.map(([x, y], i) => `${i ? 'L' : 'M'}${r1(x)} ${r1(y)}`).join('');
/** Monotone cubic (Fritsch-Carlson): smooth, and never overshoots the data. */
export function monotonePath(p: Pt[]): string {
  const n = p.length;
  if (n < 3) return linePath(p);
  const d: number[] = [], m: number[] = [];
  for (let i = 0; i < n - 1; i++) { const dx = p[i + 1]![0] - p[i]![0]; d.push(dx === 0 ? 0 : (p[i + 1]![1] - p[i]![1]) / dx); }
  m[0] = d[0]!; m[n - 1] = d[n - 2]!;
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1]! * d[i]! <= 0 ? 0 : (d[i - 1]! + d[i]!) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
    const a = m[i]! / d[i]!, b = m[i + 1]! / d[i]!, s = a * a + b * b;
    if (s > 9) { const t = 3 / Math.sqrt(s); m[i] = t * a * d[i]!; m[i + 1] = t * b * d[i]!; }
  }
  let out = `M${r1(p[0]![0])} ${r1(p[0]![1])}`;
  for (let i = 0; i < n - 1; i++) {
    const [x0, y0] = p[i]!, [x1, y1] = p[i + 1]!, dx = (x1 - x0) / 3;
    out += `C${r1(x0 + dx)} ${r1(y0 + m[i]! * dx)} ${r1(x1 - dx)} ${r1(y1 - m[i + 1]! * dx)} ${r1(x1)} ${r1(y1)}`;
  }
  return out;
}
export const curve = (p: Pt[], smooth = true) => (smooth ? monotonePath(p) : linePath(p));
/** Closed area between a top curve and either a flat baseline (number) or another curve (points). */
export function areaPath(top: Pt[], bottom: Pt[] | number, smooth = true) {
  if (!top.length) return '';
  const back = typeof bottom === 'number'
    ? `L${r1(top[top.length - 1]![0])} ${r1(bottom)}L${r1(top[0]![0])} ${r1(bottom)}`
    : 'L' + curve([...bottom].reverse(), smooth).slice(1);
  return `${curve(top, smooth)}${back}Z`;
}
/** A bar with only its far end rounded. dir: 'up' (vertical, top rounded) or 'right' (horizontal, right end rounded). */
export function roundedBar(x: number, y: number, w: number, h: number, r: number, dir: 'up' | 'right' = 'up', round = true) {
  if (w <= 0 || h <= 0) return '';
  const k = round ? Math.min(r, (dir === 'up' ? w : h) / 2, dir === 'up' ? h : w) : 0;
  return dir === 'up'
    ? `M${r1(x)} ${r1(y + h)}V${r1(y + k)}Q${r1(x)} ${r1(y)} ${r1(x + k)} ${r1(y)}H${r1(x + w - k)}Q${r1(x + w)} ${r1(y)} ${r1(x + w)} ${r1(y + k)}V${r1(y + h)}Z`
    : `M${r1(x)} ${r1(y)}H${r1(x + w - k)}Q${r1(x + w)} ${r1(y)} ${r1(x + w)} ${r1(y + k)}V${r1(y + h - k)}Q${r1(x + w)} ${r1(y + h)} ${r1(x + w - k)} ${r1(y + h)}H${r1(x)}Z`;
}

/* ---------- deterministic data ---------- */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const seriesColor = (i: number) => `var(--ui-chart-c${(i % 6) + 1})`;
export const colorOf = (s: Series, i: number) => s.color ?? seriesColor(i);

/* ---------- hooks ---------- */
export function useReducedMotion() {
  const [r, setR] = useState(false);
  useEffect(() => {
    const q = window.matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setR(q.matches);
    on(); q.addEventListener('change', on);
    return () => q.removeEventListener('change', on);
  }, []);
  return r;
}
/** True while the element is on screen. once = stay true after the first time (for entrance animations). */
export function useInView(ref: RefObject<Element | null>, once = true) {
  const [v, setV] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') { setV(true); return; }
    const io = new IntersectionObserver((es) => { for (const e of es) { if (e.isIntersecting) { setV(true); if (once) io.disconnect(); } else if (!once) setV(false); } }, { threshold: 0.15 });
    io.observe(el);
    return () => io.disconnect();
  }, [ref, once]);
  return v;
}
/** Measured width of the element; the SVG viewBox is 1:1 with CSS pixels so text stays crisp and the same size at any width. */
export function useChartSize(ref: RefObject<HTMLElement | null>, aspect = 0.56, fixedH?: number) {
  const [w, setW] = useState(480);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => { const x = Math.round(el.getBoundingClientRect().width); if (x > 0) setW((o) => (o === x ? o : x)); };
    read();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  const width = Math.max(160, w);
  return { w: width, h: fixedH ?? Math.round(clamp(width * aspect, 150, 380)) };
}
export const useUid = () => useId().replace(/[^a-zA-Z0-9_-]/g, '');

/* ---------- pieces ---------- */
export function Legend({ items, hidden, onToggle }: { items: { name: string; color: string }[]; hidden?: Set<number>; onToggle?: (i: number) => void }) {
  return (
    <ul className="ui-chart-legend" aria-label="Legend">
      {items.map((it, i) => {
        const off = hidden?.has(i);
        const inner = (<><span className="ui-chart-sw" style={{ background: it.color }} aria-hidden="true" />{it.name}</>);
        return (
          <li key={it.name} data-off={off ? '' : undefined}>
            {onToggle ? <button type="button" className="ui-chart-legend-btn" aria-pressed={!off} onClick={() => onToggle(i)}>{inner}</button> : <span className="ui-chart-legend-item">{inner}</span>}
          </li>
        );
      })}
    </ul>
  );
}
/** Horizontal gridlines with y tick labels. */
export function GridY({ ticks, y, x0, x1, f = fmt, align = 'left' }: { ticks: number[]; y: (v: number) => number; x0: number; x1: number; f?: (v: number) => string; align?: 'left' | 'right' }) {
  return (
    <g aria-hidden="true">
      {ticks.map((t) => (
        <g key={t}>
          <line className="ui-chart-grid" x1={x0} x2={x1} y1={y(t)} y2={y(t)} />
          <text className="ui-chart-tick" x={align === 'left' ? x0 - 6 : x1 + 6} y={y(t)} dy="0.32em" textAnchor={align === 'left' ? 'end' : 'start'}>{f(t)}</text>
        </g>
      ))}
    </g>
  );
}
/** Category labels along the bottom, thinned so they never collide. */
export function LabelsX({ labels, x, y, width, active }: { labels: string[]; x: (i: number) => number; y: number; width: number; active?: number | null }) {
  const k = thin(labels.length, width);
  return (
    <g aria-hidden="true">
      {labels.map((l, i) => (i % k === 0 || i === active) && (
        <text key={i} className="ui-chart-tick" data-on={i === active ? '' : undefined} x={x(i)} y={y} textAnchor="middle">{l}</text>
      ))}
    </g>
  );
}

export interface FrameProps {
  title: string;
  summary?: string;
  height?: number;
  aspect?: number;
  count: number;
  table: { head: string[]; rows: (string | number)[][] };
  /** Index under the pointer (viewBox coordinates), or -1. */
  pick: (vx: number, vy: number, w: number, h: number) => number;
  render: (c: { w: number; h: number; active: number | null; uid: string }) => ReactNode;
  tip: (i: number, w: number, h: number) => Tip | null;
  legend?: ReactNode;
  onActive?: (i: number | null) => void;
  className?: string;
  extra?: ReactNode;
}

export function Frame(p: FrameProps) {
  const root = useRef<HTMLDivElement>(null);
  const { w, h } = useChartSize(root, p.aspect ?? 0.56, p.height);
  const inView = useInView(root);
  const reduced = useReducedMotion();
  const [armed, setArmed] = useState(false);
  useEffect(() => setArmed(!reduced), [reduced]);
  const [act, setAct] = useState<number | null>(null);
  const mouse = useRef(false);
  const uid = useUid();
  const a = act !== null && act < p.count ? act : null;
  const set = (i: number | null) => { setAct(i); p.onActive?.(i); };
  const onKey = (e: KeyboardEvent) => {
    const n = p.count;
    if (!n) return;
    let i: number;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') i = a === null ? 0 : Math.min(n - 1, a + 1);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') i = a === null ? n - 1 : Math.max(0, a - 1);
    else if (e.key === 'Home') i = 0;
    else if (e.key === 'End') i = n - 1;
    else if (e.key === 'Escape') { set(null); return; }
    else return;
    e.preventDefault(); set(i);
  };
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const b = e.currentTarget.getBoundingClientRect();
    const i = p.pick(((e.clientX - b.left) / b.width) * w, ((e.clientY - b.top) / b.height) * h, w, h);
    set(i >= 0 ? i : null);
  };
  const tip = a !== null ? p.tip(a, w, h) : null;
  return (
    <figure ref={root} className={`ui-chart ${p.className ?? ''}`} data-anim={armed ? '' : undefined} data-go={inView ? '' : undefined}>
      {p.legend}
      <div
        className="ui-chart-plot" tabIndex={0} role="group" aria-roledescription="chart"
        aria-label={`${p.title}. ${p.summary ?? ''} Use the arrow keys to move between points.`}
        onKeyDown={onKey} onPointerDown={() => { mouse.current = true; }} onPointerMove={onMove} onPointerLeave={() => set(null)}
        onFocus={() => { if (!mouse.current && a === null) set(0); }} onBlur={() => { mouse.current = false; set(null); }}
      >
        <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} aria-hidden="true" focusable="false">{p.render({ w, h, active: a, uid })}</svg>
        {tip && (
          <div className="ui-chart-tip" data-h={tip.x < 90 ? 'l' : tip.x > w - 90 ? 'r' : 'c'} data-v={tip.y < 70 ? 'b' : 't'} style={{ left: tip.x, top: tip.y }}>
            <strong className="ui-chart-tip-title">{tip.title}</strong>
            {tip.rows.map((r, i) => (
              <span key={i} className="ui-chart-tip-row">
                {tip.rows.some((x) => x.color) && <span className="ui-chart-sw" style={{ background: r.color || 'transparent' }} aria-hidden="true" />}
                {r.label && <span className="ui-chart-tip-k">{r.label}</span>}
                <span className="ui-chart-tip-v">{r.value}</span>
              </span>
            ))}
          </div>
        )}
      </div>
      {p.extra}
      <div className="ui-chart-sr" aria-live="polite" role="status">{tip ? `${tip.title}: ${tip.rows.map((r) => `${r.label ?? ''} ${r.value}`).join(', ')}` : ''}</div>
      <div className="ui-chart-sr"><table>
        <caption>{p.title}</caption>
        <thead><tr>{p.table.head.map((x) => <th key={x} scope="col">{x}</th>)}</tr></thead>
        <tbody>{p.table.rows.map((r, i) => <tr key={i}>{r.map((c, j) => (j === 0 ? <th key={j} scope="row">{c}</th> : <td key={j}>{c}</td>))}</tr>)}</tbody>
      </table></div>
    </figure>
  );
}
/** Standard table for label + series charts. */
export const seriesTable = (labels: string[], series: Series[], f: (v: number) => string = fmt) => ({
  head: ['', ...series.map((s) => s.name)],
  rows: labels.map((l, i) => [l, ...series.map((s) => f(s.values[i] ?? 0))]),
});
