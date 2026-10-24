'use client';
import { useState } from 'react';
import { Plot, DataTable, arcPath, polar, fmt, useRoving } from './_b2';

export interface GaugeBand { to: number; label: string; color?: string }
export interface GaugeChartProps {
  value?: number; min?: number; max?: number; target?: number;
  bands?: GaugeBand[]; unit?: string; label?: string;
}
const BANDS: GaugeBand[] = [
  { to: 40, label: 'Low', color: 'var(--critical, #dc2626)' }, { to: 75, label: 'OK', color: 'var(--ok, #16a34a)' }, { to: 100, label: 'High', color: 'var(--signal, #f59e0b)' },
];

export default function GaugeChart({ value = 68, min = 0, max = 100, target = 80, bands = BANDS, unit = '%', label = 'Capacity used' }: GaugeChartProps) {
  const [hov, setHov] = useState<number | null>(null);
  const ip = useRoving(bands.length, setHov);
  const W = 240, H = 156, cx = 120, cy = 104, R = 94, ri = 74, span = max - min || 1;
  const ang = (v: number) => -90 + (180 * (Math.max(min, Math.min(max, v)) - min)) / span;
  const cur = bands.find((b) => value <= b.to) ?? bands[bands.length - 1];
  let from = min;
  const segs = bands.map((b, i) => { const s = { b, i, a0: ang(from), a1: ang(b.to), from }; from = b.to; return s; });
  const act = hov === null ? null : segs[hov];
  const tm = act ? polar(cx, cy, (R + ri) / 2, (act.a0 + act.a1) / 2) : null;
  const tgt = [polar(cx, cy, ri - 6, ang(target)), polar(cx, cy, R + 6, ang(target))];
  const tl = polar(cx, cy, R + 14, ang(target));
  return (
    <figure className="ui-chart2">
      <div role="meter" aria-label={label} aria-valuemin={min} aria-valuemax={max} aria-valuenow={value} aria-valuetext={`${fmt(value)}${unit}, ${cur?.label ?? ''}, target ${fmt(target)}${unit}`}>
        <Plot vb={[W, H]} label={`${label}: ${fmt(value)}${unit} (${cur?.label ?? ''}), target ${fmt(target)}${unit}`} style={{ maxWidth: 320, margin: '0 auto' }}
          tip={act && tm ? { x: tm[0], y: tm[1], title: act.b.label, body: `${fmt(act.from)} to ${fmt(act.b.to)}${unit}` } : null}>
          {segs.map((s) => (
            <g key={s.i} {...ip(s.i)} className="ui-chart2-hit ui-chart2-fade" role="img" aria-label={`${s.b.label} band: ${fmt(s.from)} to ${fmt(s.b.to)}${unit}`}>
              <path className="ui-chart2-mark" d={arcPath(cx, cy, hov === s.i ? R + 3 : R, ri, s.a0 + 0.6, s.a1 - 0.6)} fill={s.b.color ?? 'var(--primary, #2563eb)'} />
            </g>
          ))}
          <line x1={tgt[0][0]} y1={tgt[0][1]} x2={tgt[1][0]} y2={tgt[1][1]} stroke="var(--ink, #111)" strokeWidth={2.5} strokeLinecap="round" aria-hidden="true" />
          <g aria-hidden="true">
            <text x={tl[0]} y={tl[1] - 2} textAnchor={ang(target) > 20 ? 'start' : ang(target) < -20 ? 'end' : 'middle'} className="ui-chart2-muted">target {fmt(target)}</text>
            <text x={cx - (R + ri) / 2} y={cy + 14} textAnchor="middle" className="ui-chart2-muted">{fmt(min)}</text>
            <text x={cx + (R + ri) / 2} y={cy + 14} textAnchor="middle" className="ui-chart2-muted">{fmt(max)}</text>
            <g className="ui-chart2-needle" style={{ transformOrigin: `${cx}px ${cy}px`, ['--a' as string]: `${ang(value)}deg` }}>
              <path d={`M${cx - 4} ${cy}L${cx} ${cy - ri + 6}L${cx + 4} ${cy}Z`} fill="var(--ink, #111)" />
            </g>
            <circle cx={cx} cy={cy} r={7} fill="var(--ink, #111)" stroke="var(--surface, #fff)" strokeWidth={2} />
            <text className="ui-chart2-big" x={cx} y={cy + 38} textAnchor="middle" style={{ fontSize: 26 }}>{fmt(value)}{unit}</text>
            <text className="ui-chart2-muted" x={cx} y={cy + 52} textAnchor="middle">{label} · {cur?.label}</text>
          </g>
        </Plot>
      </div>
      <DataTable caption={label} head={['Measure', 'Value']} rows={[['Current', `${fmt(value)}${unit} (${cur?.label})`], ['Target', `${fmt(target)}${unit}`], ['Range', `${fmt(min)} to ${fmt(max)}${unit}`], ...bands.map((b, i) => [`${b.label} band`, `up to ${fmt(b.to)}${unit}`] as (string | number)[])]} />
    </figure>
  );
}

export function Demo() {
  return <div style={{ width: '100%', maxWidth: 230, margin: '0 auto', padding: 4 }}><GaugeChart /></div>;
}
