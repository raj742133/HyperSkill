'use client';
import { Frame, GridY, LabelsX, Legend, MONTHS, areaPath, clamp, colorOf, curve, fmt, niceTicks, scaleLinear, seriesTable, type Pt, type Series } from './_b1';

export interface AreaChartProps {
  labels?: string[];
  series?: Series[];
  /** Stack the series on top of each other (totals shown in the tooltip). */
  stacked?: boolean;
  smooth?: boolean;
  title?: string;
  height?: number;
  format?: (v: number) => string;
  legend?: boolean;
}

const LABELS = MONTHS;
const SERIES: Series[] = [
  { name: 'Visitors', values: [18, 22, 21, 27, 33, 31, 38, 44, 41, 49, 55, 62] },
  { name: 'Sign-ups', values: [6, 8, 9, 11, 10, 14, 16, 15, 19, 22, 21, 27] },
];

export default function AreaChart({ labels = LABELS, series = SERIES, stacked = false, smooth = true, title = 'Traffic by month', height, format = fmt, legend = true }: AreaChartProps) {
  const n = labels.length;
  const cum: number[][] = series.map((s) => s.values.slice(0, n));
  if (stacked) for (let k = 1; k < series.length; k++) for (let i = 0; i < n; i++) cum[k]![i] = (cum[k]![i] ?? 0) + (cum[k - 1]![i] ?? 0);
  const top = Math.max(1, ...cum.flat());
  const yt = niceTicks(0, top, 4);
  return (
    <Frame
      title={title} height={height} count={n} summary={`${series.length} series over ${n} points.`}
      table={seriesTable(labels, series, format)}
      legend={legend && series.length > 1 ? <Legend items={series.map((s, i) => ({ name: s.name, color: colorOf(s, i) }))} /> : undefined}
      pick={(vx, _vy, w) => { const ml = 36, pw = w - ml - 10; return n < 2 ? 0 : clamp(Math.round(((vx - ml) / pw) * (n - 1)), 0, n - 1); }}
      tip={(i, w, h) => {
        const ml = 36, pw = w - ml - 10, y = scaleLinear(yt.min, yt.max, h - 22, 8);
        const x = n < 2 ? ml + pw / 2 : ml + (i / (n - 1)) * pw;
        const total = stacked ? series.reduce((a, s) => a + (s.values[i] ?? 0), 0) : null;
        return { x, y: y(Math.max(...cum.map((c) => c[i] ?? 0))), title: labels[i] ?? '', rows: [...series.map((s, k) => ({ color: colorOf(s, k), label: s.name, value: format(s.values[i] ?? 0) })), ...(total !== null && series.length > 1 ? [{ label: 'Total', value: format(total) }] : [])] };
      }}
      render={({ w, h, active, uid }) => {
        const ml = 36, mr = 10, mt = 8, mb = 22, pw = w - ml - mr;
        const x = (i: number) => (n < 2 ? ml + pw / 2 : ml + (i / (n - 1)) * pw);
        const y = scaleLinear(yt.min, yt.max, h - mb, mt);
        const pts = (k: number): Pt[] => (cum[k] ?? []).map((v, i) => [x(i), y(v)]);
        return (
          <>
            <defs>
              {series.map((s, k) => (
                <linearGradient key={k} id={`${uid}g${k}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor={colorOf(s, k)} stopOpacity={0.5} />
                  <stop offset="1" stopColor={colorOf(s, k)} stopOpacity={0.03} />
                </linearGradient>
              ))}
            </defs>
            <GridY ticks={yt.ticks} y={y} x0={ml} x1={w - mr} f={format} />
            {series.map((_, k) => (
              <path key={k} className="ui-chart-fade" d={areaPath(pts(k), stacked && k ? pts(k - 1) : y(0), smooth)} fill={`url(#${uid}g${k})`} />
            )).reverse()}
            {series.map((s, k) => (
              <path key={k} className="ui-chart-draw" pathLength={1} d={curve(pts(k), smooth)} fill="none" stroke={colorOf(s, k)} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            ))}
            <LabelsX labels={labels} x={x} y={h - 6} width={pw} active={active} />
            {active !== null && (
              <g>
                <line className="ui-chart-cross" x1={x(active)} x2={x(active)} y1={mt} y2={h - mb} />
                {series.map((s, k) => <circle key={k} className="ui-chart-dot" cx={x(active)} cy={y(cum[k]![active] ?? 0)} r={4.5} fill={colorOf(s, k)} />)}
              </g>
            )}
          </>
        );
      }}
    />
  );
}

export function Demo() {
  return <div style={{ width: '100%', padding: '4px 8px' }}><AreaChart stacked height={118} legend={false} /></div>;
}
