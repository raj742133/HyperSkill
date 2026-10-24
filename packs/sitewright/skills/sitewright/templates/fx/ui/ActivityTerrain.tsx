'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { clamp, mulberry32, usePrefs } from './_n2';

export interface ActivityTerrainProps {
  /** Values per cell, filled week by week (rows days each). Defaults to deterministic sample data. */
  data?: number[];
  /** Optional name for a cell, used in tooltip and screen-reader text. */
  labelFor?: (index: number) => string;
  weeks?: number;
  days?: number;
  unit?: string;
  title?: string;
  className?: string;
}

const CELL = 11.5, MAXH = 42, VW = 280, VH = 150;

function sample(n: number) {
  const r = mulberry32(7);
  return Array.from({ length: n }, (_, i) => Math.round(Math.max(0, 6 + 6 * Math.sin(i / 5) + 5 * Math.sin(i / 2.3) + r() * 8 - (i % 7 > 4 ? 6 : 0))));
}
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** A small isometric terrain of bars (like a contribution grid). Drag sideways or press the arrow keys to rotate; hover or focus bars for a tooltip. */
export default function ActivityTerrain({ data, labelFor, weeks = 12, days = 7, unit = 'contributions', title = 'Activity terrain', className }: ActivityTerrainProps) {
  const n = weeks * days;
  const vals = useMemo(() => { const d = data ?? sample(n); return Array.from({ length: n }, (_, i) => Math.max(0, d[i] ?? 0)); }, [data, n]);
  const max = Math.max(1, ...vals);
  const name = (i: number) => labelFor?.(i) ?? `Week ${Math.floor(i / days) + 1}, ${DAYS[i % days] ?? `day ${(i % days) + 1}`}`;
  const [yaw, setYaw] = useState(0.62);
  const [sel, setSel] = useState<number | null>(null);
  const { reduced } = usePrefs();
  const st = useRef({ drag: false, x: 0, v: 0, raf: 0, yaw: 0.62 });
  const set = (y: number) => { st.current.yaw = y; setYaw(y); };
  useEffect(() => () => cancelAnimationFrame(st.current.raf), []);

  const bars = useMemo(() => {
    const c = Math.cos(yaw), s = Math.sin(yaw);
    const proj = (x: number, y: number, z: number): [number, number] => [VW / 2 + (x * c - y * s), 88 + (x * s + y * c) * 0.5 - z];
    const out = vals.map((v, i) => {
      const gx = (Math.floor(i / days) - (weeks - 1) / 2) * CELL, gy = ((i % days) - (days - 1) / 2) * CELL;
      const h = 1.5 + (v / max) * MAXH, hw = CELL * 0.4;
      const corner = (dx: number, dy: number, z: number) => proj(gx + dx * hw, gy + dy * hw, z);
      const top = [corner(-1, -1, h), corner(1, -1, h), corner(1, 1, h), corner(-1, 1, h)];
      const bot = [corner(-1, -1, 0), corner(1, -1, 0), corner(1, 1, 0), corner(-1, 1, 0)];
      const faces: { pts: [number, number][]; shade: number }[] = [];
      // side faces: [normalX, normalY, cornerA, cornerB]
      ([[0, -1, 0, 1], [1, 0, 1, 2], [0, 1, 2, 3], [-1, 0, 3, 0]] as const).forEach(([nx, ny, a, b]) => {
        const ny2 = nx * s + ny * c; // depth component of the rotated normal
        if (ny2 > 0.001) faces.push({ pts: [top[a]!, top[b]!, bot[b]!, bot[a]!], shade: 0.22 + 0.2 * (nx * c - ny * s + 1) / 2 });
      });
      return { i, depth: gx * s + gy * c, top, faces, tip: proj(gx, gy, h), level: v / max };
    });
    return out.sort((a, b) => a.depth - b.depth);
  }, [vals, yaw, max, days, weeks]);

  const pts = (p: [number, number][]) => p.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const heat = (l: number) => `color-mix(in srgb, var(--primary, #2563eb) ${Math.round(18 + l * 82)}%, var(--raised-2, #e5e7eb))`;
  const side = (l: number, sh: number) => `color-mix(in srgb, ${heat(l)} ${Math.round((1 - sh) * 100)}%, var(--ink, #111))`;

  const rotate = (d: number) => set(st.current.yaw + d);
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); rotate(-0.14); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); rotate(0.14); }
    else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); setSel((p) => clamp((p ?? (e.key === 'ArrowDown' ? -1 : n)) + (e.key === 'ArrowDown' ? 1 : -1), 0, n - 1)); }
    else if (e.key === 'Escape') setSel(null);
  };
  const down = (e: React.PointerEvent) => { const s = st.current; cancelAnimationFrame(s.raf); s.drag = true; s.x = e.clientX; s.v = 0; e.currentTarget.setPointerCapture(e.pointerId); };
  const move = (e: React.PointerEvent) => { const s = st.current; if (!s.drag) return; const dx = e.clientX - s.x; s.x = e.clientX; s.v = dx * 0.008; set(s.yaw + dx * 0.008); };
  const up = (e: React.PointerEvent) => {
    const s = st.current; if (!s.drag) return; s.drag = false;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    if (reduced) return;
    const glide = () => { s.v *= 0.93; if (Math.abs(s.v) < 0.0004) return; set(s.yaw + s.v); s.raf = requestAnimationFrame(glide); };
    s.raf = requestAnimationFrame(glide);
  };
  const cur = sel === null ? null : bars.find((b) => b.i === sel);

  return (
    <div className={`ui-activity-terrain${className ? ' ' + className : ''}`}>
      <div className="ui-activity-terrain-view" tabIndex={0} role="group" aria-label={`${title}: ${n} days. Arrow left and right rotate, arrow up and down move between bars.`} onKeyDown={onKey} onBlur={() => setSel(null)} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onPointerLeave={() => !st.current.drag && setSel(null)}>
        <svg viewBox={`0 0 ${VW} ${VH}`} width="100%" aria-hidden="true">
          <g>
            {bars.map((b) => (
              <g key={b.i} data-i={b.i} onPointerEnter={() => !st.current.drag && setSel(b.i)} style={{ opacity: sel === null || sel === b.i ? 1 : 0.8 }}>
                {b.faces.map((f, k) => <polygon key={k} points={pts(f.pts)} fill={side(b.level, f.shade)} />)}
                <polygon points={pts(b.top)} fill={heat(b.level)} stroke={sel === b.i ? 'var(--ink, #111)' : 'var(--surface, #fff)'} strokeOpacity={sel === b.i ? 1 : 0.35} strokeWidth="0.6" />
              </g>
            ))}
          </g>
        </svg>
        {cur && (
          <div className="ui-activity-terrain-tip" style={{ left: `${clamp((cur.tip[0] / VW) * 100, 18, 82)}%`, top: `${Math.max(cur.tip[1] / VH, 0.22) * 100}%` }}>
            <strong>{vals[cur.i]}</strong> {unit} <span>{name(cur.i)}</span>
          </div>
        )}
      </div>
      <p className="ui-activity-terrain-sr" role="status" aria-live="polite">{sel !== null ? `${name(sel)}: ${vals[sel]} ${unit}` : ''}</p>
      <table className="ui-activity-terrain-sr">
        <caption>{title}</caption>
        <tbody>{vals.map((v, i) => <tr key={i}><th scope="row">{name(i)}</th><td>{v} {unit}</td></tr>)}</tbody>
      </table>
    </div>
  );
}

export function Demo() {
  return <div style={{ height: 150 }}><ActivityTerrain /></div>;
}
