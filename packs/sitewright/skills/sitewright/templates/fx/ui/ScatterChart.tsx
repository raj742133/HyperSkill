'use client';
import { Frame, GridY, Legend, fmt, niceTicks, rng, scaleLinear, seriesColor } from './_b1';

export interface ScatterPoint { x: number; y: number; size?: number; group?: number; label?: string }
export interface ScatterChartProps {
  points?: ScatterPoint[];
  /** Names for the group colours (index = ScatterPoint.group). */
  groups?: string[];
  xLabel?: string;
  yLabel?: string;
  title?: string;
  height?: number;
  format?: (v: number) => string;
}

const GROUPS = ['Free', 'Pro'];
const r = rng(11);
const POINTS: ScatterPoint[] = Array.from({ length: 26 }, (_, i) => {
  const g = i % 2, x = 4 + r() * 46 + g * 12;
  return { x: Math.round(x), y: Math.round(18 + x * (g ? 1.5 : 0.8) + (r() - 0.5) * 26), size: Math.round(10 + r() * 90), group: g, label: `Account ${i + 1}` };
});

function Marker({ g, x, y, rad, color, ring }: { g: number; x: number; y: number; rad: number; color: string; ring?: boolean }) {
  const p = { fill: color, fillOpacity: 0.55, stroke: color, strokeWidth: ring ? 2.5 : 1.5 };
  const s = g % 3;
  return s === 0 ? <circle cx={x} cy={y} r={rad} {...p} /> : s === 1 ? <rect x={x - rad} y={y - rad} width={rad * 2} height={rad * 2} rx={2} {...p} /> : <path d={`M${x} ${y - rad - 1}L${x + rad + 1} ${y + rad}L${x - rad - 1} ${y + rad}Z`} {...p} strokeLinejoin="round" />;
}

export default function ScatterChart({ points = POINTS, groups = GROUPS, xLabel = 'Seats', yLabel = 'Monthly usage (h)', title = 'Usage by account size', height, format = fmt }: ScatterChartProps) {
  const pts = [...points].sort((a, b) => a.x - b.x);
  const n = pts.length;
  const xt = niceTicks(Math.min(0, ...pts.map((p) => p.x)), Math.max(1, ...pts.map((p) => p.x)), 6);
  const yt = niceTicks(Math.min(0, ...pts.map((p) => p.y)), Math.max(1, ...pts.map((p) => p.y)), 5);
  const smax = Math.max(0, ...pts.map((p) => p.size ?? 0));
  const rad = (p: ScatterPoint) => (p.size && smax ? 4 + Math.sqrt(p.size / smax) * 8 : 5);
  const ml = 38, mr = 14, mt = yLabel ? 18 : 8, mb = xLabel ? 36 : 22;
  const gi = (p: ScatterPoint) => p.group ?? 0;
  return (
    <Frame
      title={title} height={height} count={n} summary={`Scatter plot of ${n} points.`}
      table={{ head: ['Point', xLabel || 'x', yLabel || 'y', 'Size', 'Group'], rows: pts.map((p, i) => [p.label ?? `Point ${i + 1}`, format(p.x), format(p.y), p.size === undefined ? '' : format(p.size), groups[gi(p)] ?? ''] ) }}
      legend={groups.length > 1 ? <Legend items={groups.map((g, i) => ({ name: g, color: seriesColor(i) }))} /> : undefined}
      pick={(vx, vy, w, h) => {
        const X = scaleLinear(xt.min, xt.max, ml, w - mr), Y = scaleLinear(yt.min, yt.max, h - mb, mt);
        let best = -1, bd = 44 * 44;
        pts.forEach((p, i) => { const d = (X(p.x) - vx) ** 2 + (Y(p.y) - vy) ** 2; if (d < bd) { bd = d; best = i; } });
        return best;
      }}
      tip={(i, w, h) => {
        const p = pts[i]!, X = scaleLinear(xt.min, xt.max, ml, w - mr), Y = scaleLinear(yt.min, yt.max, h - mb, mt);
        const rows = [{ label: xLabel || 'x', value: format(p.x) }, { label: yLabel || 'y', value: format(p.y) }];
        if (p.size !== undefined) rows.push({ label: 'Size', value: format(p.size) });
        return { x: X(p.x), y: Y(p.y) - rad(p) + 4, title: `${p.label ?? `Point ${i + 1}`}${groups.length > 1 ? ` (${groups[gi(p)] ?? ''})` : ''}`, rows };
      }}
      render={({ w, h, active }) => {
        const X = scaleLinear(xt.min, xt.max, ml, w - mr), Y = scaleLinear(yt.min, yt.max, h - mb, mt);
        const ap = active !== null ? pts[active] : undefined;
        return (
          <>
            <GridY ticks={yt.ticks} y={Y} x0={ml} x1={w - mr} f={format} />
            <g aria-hidden="true">{xt.ticks.map((t) => <text key={t} className="ui-chart-tick" x={X(t)} y={h - mb + 14} textAnchor="middle">{format(t)}</text>)}</g>
            <line className="ui-chart-axis" x1={ml} x2={w - mr} y1={h - mb} y2={h - mb} />
            {xLabel && <text className="ui-chart-axis-title" x={(ml + w - mr) / 2} y={h - 4} textAnchor="middle" aria-hidden="true">{xLabel}</text>}
            {yLabel && <text className="ui-chart-axis-title" x={ml} y={8} aria-hidden="true">{yLabel}</text>}
            {ap && <g><line className="ui-chart-cross" x1={X(ap.x)} x2={X(ap.x)} y1={Y(ap.y)} y2={h - mb} /><line className="ui-chart-cross" x1={ml} x2={X(ap.x)} y1={Y(ap.y)} y2={Y(ap.y)} /></g>}
            <g className="ui-chart-fade">{pts.map((p, i) => <Marker key={i} g={gi(p)} x={X(p.x)} y={Y(p.y)} rad={rad(p)} color={seriesColor(gi(p))} ring={i === active} />)}</g>
          </>
        );
      }}
    />
  );
}

export function Demo() {
  return <div style={{ width: '100%', padding: '2px 8px' }}><ScatterChart height={128} xLabel="" yLabel="" groups={GROUPS} points={POINTS.slice(0, 18)} /></div>;
}
