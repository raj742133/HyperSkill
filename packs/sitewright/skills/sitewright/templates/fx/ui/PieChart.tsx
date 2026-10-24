'use client';
import { useState } from 'react';
import { Plot, Legend, DataTable, arcPath, polar, fmt, r2, series, useRoving } from './_b2';

export interface PieDatum { label: string; value: number; color?: string }
export interface PieChartProps {
  data?: PieDatum[];
  /** 0 = pie, 0..0.9 = donut hole as a fraction of the radius */
  innerRadius?: number;
  /** label text in the donut centre (shows the hovered slice instead while one is active) */
  centerLabel?: string;
  /** draw labels with leader lines around the pie */
  labels?: boolean;
  legend?: boolean;
  unit?: string;
  title?: string;
}
const DEF: PieDatum[] = [
  { label: 'Subscriptions', value: 46 }, { label: 'One-off', value: 24 }, { label: 'Services', value: 17 }, { label: 'Affiliate', value: 8 }, { label: 'Other', value: 5 },
];

export default function PieChart({ data = DEF, innerRadius = 0.6, centerLabel = 'Total', labels = false, legend = true, unit = '', title = 'Share by category' }: PieChartProps) {
  const [hov, setHov] = useState<number | null>(null);
  const items = data.filter((d) => d.value > 0);
  const ip = useRoving(items.length, setHov);
  const total = items.reduce((a, d) => a + d.value, 0) || 1;
  const W = labels ? 380 : 220, H = 220, cx = W / 2, cy = H / 2, ro = labels ? 74 : 100, ri = ro * Math.max(0, Math.min(0.9, innerRadius));
  let acc = 0;
  const segs = items.map((d, i) => {
    const a0 = (acc / total) * 360; acc += d.value; const a1 = (acc / total) * 360, mid = (a0 + a1) / 2;
    const [dx, dy] = polar(0, 0, 9, mid);
    return { d, i, a0, a1, mid, dx, dy, color: d.color ?? series(i), pct: Math.round((d.value / total) * 1000) / 10 };
  });
  const act = hov === null ? null : segs[hov];
  const tipAt = act ? polar(cx, cy, (ro + ri) / 2 + 9, act.mid) : null;
  const colors = segs.map((s) => s.color);

  return (
    <figure className="ui-chart2">
      <div className="ui-chart2-row">
        <Plot vb={[W, H]} label={`${title}: ${items.map((d) => `${d.label} ${fmt(d.value)}${unit}`).join(', ')}`} style={{ flex: `0 1 ${labels ? 360 : 200}px`, minWidth: 140, margin: '0 auto' }}
          tip={act && tipAt ? { x: tipAt[0], y: tipAt[1], title: act.d.label, body: `${fmt(act.d.value)}${unit} · ${act.pct}%` } : null}>
          {segs.map((s) => {
            const on = hov === s.i;
            const [lx0, ly0] = polar(cx, cy, ro + 4, s.mid), [lx1, ly1] = polar(cx, cy, ro + 15, s.mid);
            const right = lx1 >= cx, lx2 = lx1 + (right ? 12 : -12);
            return (
              <g key={s.i} className="ui-chart2-fade" style={{ ['--d' as string]: `${s.i * 0.08}s` }}>
                <g {...ip(s.i)} className={`ui-chart2-hit${hov !== null && !on ? ' ui-chart2-dim' : ''}`} role="img"
                  aria-label={`${s.d.label}: ${fmt(s.d.value)}${unit}, ${s.pct}%`}
                  style={{ transform: on ? `translate(${s.dx}px, ${s.dy}px)` : 'none' }}>
                  <path className="ui-chart2-mark" d={arcPath(cx, cy, ro, ri, s.a0, s.a1)} fill={s.color} stroke="var(--surface, #fff)" strokeWidth={2} strokeLinejoin="round" />
                </g>
                {labels && (
                  <g aria-hidden="true">
                    <polyline className="ui-chart2-grid" points={`${lx0},${ly0} ${lx1},${ly1} ${lx2},${ly1}`} />
                    <text x={r2(lx2 + (right ? 4 : -4))} y={ly1} textAnchor={right ? 'start' : 'end'} dominantBaseline="middle">{s.d.label} <tspan className="ui-chart2-muted" style={{ fill: 'var(--muted, #6b7280)' }}>{s.pct}%</tspan></text>
                  </g>
                )}
              </g>
            );
          })}
          {ri > 0 && (
            <g aria-hidden="true" textAnchor="middle" pointerEvents="none">
              <text className="ui-chart2-big" x={cx} y={cy + 6}>{act ? fmt(act.d.value) : fmt(total)}{unit && act ? unit : ''}</text>
              <text className="ui-chart2-muted" x={cx} y={cy + 24}>{act ? act.d.label : centerLabel}</text>
            </g>
          )}
        </Plot>
        {legend && <Legend items={segs.map((s, i) => ({ label: s.d.label, color: colors[i], value: `${s.pct}%` }))} active={hov} onHover={setHov} />}
      </div>
      <DataTable caption={title} head={['Category', 'Value', 'Share']} rows={segs.map((s) => [s.d.label, `${fmt(s.d.value)}${unit}`, `${s.pct}%`])} />
    </figure>
  );
}

export function Demo() {
  return <div style={{ width: '100%', padding: 8 }}><PieChart innerRadius={0.62} centerLabel="Revenue" unit="%" /></div>;
}
