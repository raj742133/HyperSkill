'use client';
import { useState } from 'react';
import { Plot, Legend, DataTable, fmt, r2, series, useRoving } from './_b2';

export interface RingDatum { label: string; value: number; max?: number; color?: string }
export interface RingChartProps {
  data?: RingDatum[];
  /** default capacity of a ring when it has no own max */
  max?: number;
  unit?: string;
  centerLabel?: string;
  title?: string;
}
const DEF: RingDatum[] = [
  { label: 'Documents', value: 42, max: 60 }, { label: 'Media', value: 88, max: 120 }, { label: 'Backups', value: 31, max: 80 }, { label: 'Apps', value: 12, max: 50 },
];

export default function RingChart({ data = DEF, max = 100, unit = ' GB', centerLabel = 'used', title = 'Usage by category' }: RingChartProps) {
  const [hov, setHov] = useState<number | null>(null);
  const ip = useRoving(data.length, setHov);
  const S = 220, c = S / 2, sw = Math.min(16, 90 / data.length - 3), gap = 4;
  const rings = data.map((d, i) => {
    const m = d.max ?? max, p = Math.max(0, Math.min(1, d.value / m)), r = 100 - sw / 2 - i * (sw + gap), C = 2 * Math.PI * r;
    return { d, i, m, p, r, C: r2(C), off: r2(C * (1 - p)), color: d.color ?? series(i) };
  });
  const used = data.reduce((a, d) => a + d.value, 0), cap = rings.reduce((a, r) => a + r.m, 0);
  const act = hov === null ? null : rings[hov];
  return (
    <figure className="ui-chart2">
      <div className="ui-chart2-row">
        <Plot vb={[S, S]} label={`${title}: ${data.map((d, i) => `${d.label} ${fmt(d.value)} of ${fmt(rings[i].m)}${unit}`).join(', ')}`} style={{ flex: '0 1 190px', minWidth: 130, margin: '0 auto' }}
          tip={act ? { x: c, y: c - act.r, title: act.d.label, body: `${fmt(act.d.value)} of ${fmt(act.m)}${unit} · ${Math.round(act.p * 100)}%` } : null}>
          {rings.map((r) => (
            <g key={r.i} {...ip(r.i)} className={`ui-chart2-hit${hov !== null && hov !== r.i ? ' ui-chart2-dim' : ''}`} role="img"
              aria-label={`${r.d.label}: ${fmt(r.d.value)} of ${fmt(r.m)}${unit}, ${Math.round(r.p * 100)}%`}>
              <circle className="ui-chart2-mark" cx={c} cy={c} r={r.r} fill="none" stroke="var(--line, #e5e7eb)" strokeWidth={sw} />
              <circle className="ui-chart2-dash" cx={c} cy={c} r={r.r} fill="none" stroke={r.color} strokeWidth={sw} strokeLinecap="round" transform={`rotate(-90 ${c} ${c})`}
                style={{ ['--len' as string]: r.C, ['--off' as string]: r.off, ['--d' as string]: `${r.i * 0.12}s` }} />
            </g>
          ))}
          <g aria-hidden="true" textAnchor="middle" pointerEvents="none">
            <text className="ui-chart2-big" x={c} y={c + 4}>{fmt(act ? act.d.value : used)}</text>
            <text className="ui-chart2-muted" x={c} y={c + 22}>{act ? act.d.label : `${centerLabel}${cap ? ` of ${fmt(cap)}` : ''}`}</text>
          </g>
        </Plot>
        <Legend items={rings.map((r) => ({ label: r.d.label, color: r.color, value: `${fmt(r.d.value)}/${fmt(r.m)}` }))} active={hov} onHover={setHov} />
      </div>
      <DataTable caption={title} head={['Category', 'Value', 'Capacity', 'Percent']} rows={rings.map((r) => [r.d.label, `${fmt(r.d.value)}${unit}`, `${fmt(r.m)}${unit}`, `${Math.round(r.p * 100)}%`])} />
    </figure>
  );
}

export function Demo() {
  return <div style={{ width: '100%', padding: 8 }}><RingChart /></div>;
}
