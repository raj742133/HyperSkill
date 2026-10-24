'use client';
import { useId } from 'react';
import { Frame, GridY, LabelsX, MONTHS, areaPath, clamp, curve, fmt, niceTicks, scaleLinear, signed, type Pt } from './_b1';

export interface ProfitLossLineProps {
  labels?: string[];
  values?: number[];
  title?: string;
  name?: string;
  height?: number;
  format?: (v: number) => string;
}

const VALUES = [12, 28, 19, -6, -22, -10, 8, 31, 44, 27, -4, 16];

export default function ProfitLossLine({ labels = MONTHS, values = VALUES, title = 'Profit and loss by month', name = 'Net', height, format = fmt }: ProfitLossLineProps) {
  const n = Math.min(labels.length, values.length);
  const yt = niceTicks(Math.min(0, ...values), Math.max(0, ...values), 5);
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const ml = 38, mr = 12, mt = 8, mb = 22;
  return (
    <Frame
      title={title} height={height} count={n} summary={`Positive values are profit, negative are loss. ${n} points.`}
      table={{ head: ['', name], rows: labels.slice(0, n).map((l, i) => [l, signed(values[i] ?? 0, format)]) }}
      pick={(vx, _vy, w) => (n < 2 ? 0 : clamp(Math.round(((vx - ml) / (w - ml - mr)) * (n - 1)), 0, n - 1))}
      tip={(i, w, h) => {
        const v = values[i] ?? 0, y = scaleLinear(yt.min, yt.max, h - mb, mt);
        return { x: n < 2 ? w / 2 : ml + (i / (n - 1)) * (w - ml - mr), y: y(v), title: labels[i] ?? '', rows: [{ color: v >= 0 ? 'var(--ui-chart-up)' : 'var(--ui-chart-down)', label: v >= 0 ? 'Profit' : 'Loss', value: signed(v, format) }] };
      }}
      render={({ w, h, active }) => {
        const pw = w - ml - mr;
        const x = (i: number) => (n < 2 ? ml + pw / 2 : ml + (i / (n - 1)) * pw);
        const y = scaleLinear(yt.min, yt.max, h - mb, mt), y0 = y(0);
        const pts: Pt[] = values.slice(0, n).map((v, i) => [x(i), y(v)]);
        const line = curve(pts), area = areaPath(pts, y0);
        const side = (cls: 'up' | 'down', clip: string) => (
          <g clipPath={`url(#${clip})`} style={{ color: `var(--ui-chart-${cls})` }}>
            <path className="ui-chart-fade" d={area} fill="currentColor" fillOpacity={0.22} />
            <path className="ui-chart-draw" pathLength={1} d={line} fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinejoin="round" strokeLinecap="round" />
          </g>
        );
        return (
          <>
            <defs>
              <clipPath id={`${id}u`}><rect x={0} y={0} width={w} height={y0} /></clipPath>
              <clipPath id={`${id}d`}><rect x={0} y={y0} width={w} height={Math.max(0, h - y0)} /></clipPath>
            </defs>
            <GridY ticks={yt.ticks} y={y} x0={ml} x1={w - mr} f={(t) => signed(t, format)} />
            <line className="ui-chart-axis" x1={ml} x2={w - mr} y1={y0} y2={y0} />
            {side('up', `${id}u`)}{side('down', `${id}d`)}
            <LabelsX labels={labels} x={x} y={h - 6} width={pw} active={active} />
            {active !== null && (
              <g>
                <line className="ui-chart-cross" x1={x(active)} x2={x(active)} y1={mt} y2={h - mb} />
                <circle className="ui-chart-dot" cx={x(active)} cy={y(values[active] ?? 0)} r={4.5} fill={(values[active] ?? 0) >= 0 ? 'var(--ui-chart-up)' : 'var(--ui-chart-down)'} />
              </g>
            )}
          </>
        );
      }}
    />
  );
}

export function Demo() {
  return <div style={{ width: '100%', padding: '2px 8px' }}><ProfitLossLine height={118} /></div>;
}
