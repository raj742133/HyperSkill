'use client';
import { useState } from 'react';
import { Frame, GridY, LabelsX, Legend, MONTHS, clamp, colorOf, curve, fmt, niceTicks, scaleLinear, seriesTable, type Pt, type Series } from './_b1';

export interface LineChartProps {
  labels?: string[];
  series?: Series[];
  smooth?: boolean;
  title?: string;
  height?: number;
  format?: (v: number) => string;
}

const SERIES: Series[] = [
  { name: 'Orders', values: [42, 48, 45, 58, 62, 59, 71, 76, 70, 84, 91, 98] },
  { name: 'Returns', values: [9, 11, 8, 12, 10, 14, 13, 12, 16, 15, 14, 18] },
  { name: 'Refunds', values: [3, 2, 4, 3, 6, 5, 4, 7, 6, 5, 8, 7] },
];

export default function LineChart({ labels = MONTHS, series = SERIES, smooth = true, title = 'Orders by month', height, format = fmt }: LineChartProps) {
  const [hidden, setHidden] = useState<Set<number>>(new Set());
  const n = labels.length;
  const vis = series.map((_, i) => i).filter((i) => !hidden.has(i));
  const all = vis.flatMap((i) => series[i]!.values.slice(0, n));
  const yt = niceTicks(Math.min(0, ...all), Math.max(1, ...all), 5);
  const toggle = (i: number) => setHidden((h) => { const s = new Set(h); if (s.has(i)) s.delete(i); else if (s.size < series.length - 1) s.add(i); return s; });
  return (
    <Frame
      title={title} height={height} count={n} summary={`${series.length} series, ${n} points.`} table={seriesTable(labels, series, format)}
      legend={<Legend items={series.map((s, i) => ({ name: s.name, color: colorOf(s, i) }))} hidden={hidden} onToggle={toggle} />}
      pick={(vx, _vy, w) => { const ml = 36, pw = w - ml - 12; return n < 2 ? 0 : clamp(Math.round(((vx - ml) / pw) * (n - 1)), 0, n - 1); }}
      tip={(i, w, h) => {
        const ml = 36, pw = w - ml - 12, y = scaleLinear(yt.min, yt.max, h - 22, 8);
        return { x: n < 2 ? ml + pw / 2 : ml + (i / (n - 1)) * pw, y: y(Math.max(...vis.map((k) => series[k]!.values[i] ?? 0))), title: labels[i] ?? '', rows: vis.map((k) => ({ color: colorOf(series[k]!, k), label: series[k]!.name, value: format(series[k]!.values[i] ?? 0) })) };
      }}
      render={({ w, h, active }) => {
        const ml = 36, mr = 12, mt = 8, mb = 22, pw = w - ml - mr;
        const x = (i: number) => (n < 2 ? ml + pw / 2 : ml + (i / (n - 1)) * pw);
        const y = scaleLinear(yt.min, yt.max, h - mb, mt);
        return (
          <>
            <GridY ticks={yt.ticks} y={y} x0={ml} x1={w - mr} f={format} />
            {vis.map((k) => {
              const pts: Pt[] = series[k]!.values.slice(0, n).map((v, i) => [x(i), y(v)]);
              return <path key={k} className="ui-chart-draw" pathLength={1} d={curve(pts, smooth)} fill="none" stroke={colorOf(series[k]!, k)} strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" />;
            })}
            <LabelsX labels={labels} x={x} y={h - 6} width={pw} active={active} />
            {active !== null && (
              <g>
                <line className="ui-chart-cross" x1={x(active)} x2={x(active)} y1={mt} y2={h - mb} />
                {vis.map((k) => <circle key={k} className="ui-chart-dot" cx={x(active)} cy={y(series[k]!.values[active] ?? 0)} r={4.5} fill={colorOf(series[k]!, k)} />)}
              </g>
            )}
          </>
        );
      }}
    />
  );
}

export function Demo() {
  return <div style={{ width: '100%', padding: '2px 8px' }}><LineChart height={100} /></div>;
}
