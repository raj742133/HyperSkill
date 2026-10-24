'use client';
import { Frame, GridY, LabelsX, MONTHS, alignedTicks, curve, fmt, niceTicks, roundedBar, scaleBand, scaleLinear, type Pt } from './_b1';

export interface ComposedChartProps {
  labels?: string[];
  /** Columns on the left axis. */
  bars?: number[];
  /** Line on the right (secondary) axis. */
  line?: number[];
  barName?: string;
  lineName?: string;
  barFormat?: (v: number) => string;
  lineFormat?: (v: number) => string;
  title?: string;
  height?: number;
}

const BARS = [12400, 15800, 14200, 18900, 21400, 20100, 24600, 27300];
const LINE = [2.1, 2.4, 2.2, 2.9, 3.1, 2.8, 3.6, 3.9];
const pct = (v: number) => `${+v.toFixed(1)}%`;
const money = (v: number) => `$${fmt(v)}`;

export default function ComposedChart({ labels = MONTHS.slice(0, 8), bars = BARS, line = LINE, barName = 'Revenue', lineName = 'Conversion', barFormat = money, lineFormat = pct, title = 'Revenue and conversion rate', height }: ComposedChartProps) {
  const n = Math.min(labels.length, bars.length, line.length);
  const lt = niceTicks(0, Math.max(1, ...bars), 5);
  const rt = alignedTicks(Math.max(0.1, ...line), lt.ticks.length - 1);
  const rMax = rt[rt.length - 1] ?? 1;
  const ml = 44, mr = 40, mt = 24, mb = 22;
  return (
    <Frame
      title={title} height={height} count={n} summary={`${barName} as columns on the left axis, ${lineName} as a line on the right axis.`}
      table={{ head: ['', barName, lineName], rows: labels.slice(0, n).map((l, i) => [l, barFormat(bars[i] ?? 0), lineFormat(line[i] ?? 0)]) }}
      legend={undefined}
      pick={(vx, _vy, w) => { const i = Math.floor((vx - ml) / scaleBand(n, ml, w - mr).step); return i < 0 || i >= n ? -1 : i; }}
      tip={(i, w, h) => ({ x: scaleBand(n, ml, w - mr).mid(i), y: scaleLinear(0, rMax, h - mb, mt)(line[i] ?? 0), title: labels[i] ?? '', rows: [{ color: 'var(--ui-chart-c1)', label: barName, value: barFormat(bars[i] ?? 0) }, { color: 'var(--ui-chart-c2)', label: lineName, value: lineFormat(line[i] ?? 0) }] })}
      render={({ w, h, active }) => {
        const b = scaleBand(n, ml, w - mr, 0.35);
        const yl = scaleLinear(lt.min, lt.max, h - mb, mt), yr = scaleLinear(0, rMax, h - mb, mt);
        const pts: Pt[] = line.slice(0, n).map((v, i) => [b.mid(i), yr(v)]);
        return (
          <>
            <GridY ticks={lt.ticks} y={yl} x0={ml} x1={w - mr} f={barFormat} />
            <g aria-hidden="true">{rt.map((t) => <text key={t} className="ui-chart-tick" x={w - mr + 6} y={yr(t)} dy="0.32em">{lineFormat(t)}</text>)}</g>
            <text className="ui-chart-axis-title" x={2} y={10} aria-hidden="true">{barName}</text>
            <text className="ui-chart-axis-title" x={w - 2} y={10} textAnchor="end" aria-hidden="true">{lineName}</text>
            {bars.slice(0, n).map((v, i) => <path key={i} d={roundedBar(b.x(i), yl(v), b.bw, yl(0) - yl(v), 5)} className="ui-chart-grow" style={{ ['--d' as string]: i }} fill="var(--ui-chart-c1)" opacity={active === null || active === i ? 0.9 : 0.5} />)}
            <path className="ui-chart-draw" pathLength={1} d={curve(pts)} fill="none" stroke="var(--ui-chart-c2)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
            <g className="ui-chart-fade">{pts.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={active === i ? 5 : 3} fill="var(--ui-chart-c2)" stroke="var(--surface, #fff)" strokeWidth={1.5} />)}</g>
            <LabelsX labels={labels} x={b.mid} y={h - 6} width={w - ml - mr} active={active} />
            {active !== null && <line className="ui-chart-cross" x1={b.mid(active)} x2={b.mid(active)} y1={mt} y2={h - mb} />}
          </>
        );
      }}
    />
  );
}

export function Demo() {
  return <div style={{ width: '100%', padding: '2px 6px' }}><ComposedChart height={128} labels={MONTHS.slice(0, 6)} bars={BARS.slice(0, 6)} line={LINE.slice(0, 6)} /></div>;
}
