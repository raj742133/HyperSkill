'use client';
import { useState } from 'react';
import { Plot, Legend, DataTable, polar, fmt, r2, series, useRoving } from './_b2';

export interface RadarSeries { name: string; values: number[]; color?: string }
export interface RadarChartProps {
  axes?: string[];
  series?: RadarSeries[];
  /** value at the outer ring; defaults to the largest value */
  max?: number;
  rings?: number;
  title?: string;
}
const AX = ['Speed', 'Reliability', 'Comfort', 'Safety', 'Value', 'Design'];
const SER: RadarSeries[] = [{ name: 'Model A', values: [82, 70, 64, 90, 58, 76] }, { name: 'Model B', values: [60, 88, 80, 66, 84, 52] }];

export default function RadarChart({ axes = AX, series: sr = SER, max, rings = 4, title = 'Comparison across attributes' }: RadarChartProps) {
  const [hov, setHov] = useState<number | null>(null);
  const n = axes.length, W = 280, H = 190, cx = W / 2, cy = 98, R = 62;
  const top = max ?? Math.max(1, ...sr.flatMap((s) => s.values));
  const pt = (a: number, v: number) => polar(cx, cy, (R * Math.max(0, v)) / top, (360 / n) * a);
  const verts = sr.flatMap((s, si) => axes.map((_, a) => ({ si, a, v: s.values[a] ?? 0, xy: pt(a, s.values[a] ?? 0) })));
  const ip = useRoving(verts.length, setHov);
  const act = hov === null ? null : verts[hov];
  const colour = (i: number) => sr[i]?.color ?? series(i);
  return (
    <figure className="ui-chart2">
      <Plot vb={[W, H]} label={`${title}. ${sr.map((s) => `${s.name}: ${axes.map((a, i) => `${a} ${fmt(s.values[i] ?? 0)}`).join(', ')}`).join('. ')}`}
        tip={act ? { x: act.xy[0], y: act.xy[1], title: `${sr[act.si].name} · ${axes[act.a]}`, body: fmt(act.v) } : null}>
        {Array.from({ length: rings }, (_, k) => {
          const f = (k + 1) / rings;
          return <polygon key={k} className="ui-chart2-grid" points={axes.map((_, a) => polar(cx, cy, R * f, (360 / n) * a).join(',')).join(' ')} />;
        })}
        {axes.map((_, a) => <line key={a} className="ui-chart2-grid" x1={cx} y1={cy} x2={polar(cx, cy, R, (360 / n) * a)[0]} y2={polar(cx, cy, R, (360 / n) * a)[1]} />)}
        {axes.map((label, a) => {
          const [x, y] = polar(cx, cy, R + 13, (360 / n) * a), dx = x - cx;
          return <text key={a} x={x} y={r2(y + 4)} textAnchor={Math.abs(dx) < 6 ? 'middle' : dx > 0 ? 'start' : 'end'} aria-hidden="true">{label}</text>;
        })}
        {sr.map((s, si) => (
          <polygon key={si} className="ui-chart2-grow" points={axes.map((_, a) => pt(a, s.values[a] ?? 0).join(',')).join(' ')}
            fill={colour(si)} fillOpacity={0.18} stroke={colour(si)} strokeWidth={2} strokeLinejoin="round"
            style={{ transformOrigin: `${cx}px ${cy}px`, ['--d' as string]: `${si * 0.15}s`, opacity: hov !== null && act && act.si !== si ? 0.35 : undefined }} />
        ))}
        {verts.map((v, i) => (
          <g key={i} {...ip(i)} className="ui-chart2-hit ui-chart2-fade" role="img" aria-label={`${sr[v.si].name}, ${axes[v.a]}: ${fmt(v.v)}`}>
            <circle cx={v.xy[0]} cy={v.xy[1]} r={11} fill="transparent" />
            <circle className="ui-chart2-mark" cx={v.xy[0]} cy={v.xy[1]} r={hov === i ? 5.5 : 3.5} fill={colour(v.si)} stroke="var(--surface, #fff)" strokeWidth={1.5} />
          </g>
        ))}
      </Plot>
      {sr.length > 1 && <Legend items={sr.map((s, i) => ({ label: s.name, color: colour(i) }))} />}
      <DataTable caption={title} head={['Attribute', ...sr.map((s) => s.name)]} rows={axes.map((a, i) => [a, ...sr.map((s) => fmt(s.values[i] ?? 0))])} />
    </figure>
  );
}

export function Demo() {
  return <div style={{ width: '100%', maxWidth: 250, margin: '0 auto', padding: 4 }}><RadarChart series={[{ name: 'A', values: [82, 70, 64, 90, 58, 76] }, { name: 'B', values: [60, 88, 80, 66, 84, 52] }]} /></div>;
}
