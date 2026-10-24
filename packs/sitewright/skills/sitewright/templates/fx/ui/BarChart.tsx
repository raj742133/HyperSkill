'use client';
import { Frame, GridY, Legend, MONTHS, clamp, colorOf, fmt, niceTicks, roundedBar, scaleBand, scaleLinear, seriesTable, thin, type Series } from './_b1';

export interface BarChartProps {
  labels?: string[];
  series?: Series[];
  stacked?: boolean;
  /** Bars run left to right, one row per label. */
  horizontal?: boolean;
  title?: string;
  height?: number;
  format?: (v: number) => string;
  legend?: boolean;
}

const SERIES: Series[] = [
  { name: 'Online', values: [34, 41, 38, 52, 47, 63] },
  { name: 'In store', values: [22, 25, 31, 28, 36, 40] },
];

export default function BarChart({ labels = MONTHS.slice(0, 6), series = SERIES, stacked = false, horizontal = false, title = 'Sales by channel', height, format = fmt, legend = true }: BarChartProps) {
  const n = labels.length, k = series.length;
  const totals = labels.map((_, i) => series.reduce((a, s) => a + (s.values[i] ?? 0), 0));
  const top = stacked ? Math.max(1, ...totals) : Math.max(1, ...series.flatMap((s) => s.values.slice(0, n)));
  const yt = niceTicks(0, top, horizontal ? 4 : 5);
  const ml = horizontal ? clamp(Math.max(...labels.map((l) => l.length)) * 6.2 + 14, 40, 96) : 36;
  const mt = horizontal ? 6 : 18, mb = 22, mr = horizontal ? 36 : 8;
  const h0 = height ?? (horizontal ? Math.max(120, n * (stacked ? 28 : 18 * k + 10) + 30) : undefined);
  return (
    <Frame
      title={title} height={h0} count={n} summary={`${stacked ? 'Stacked' : 'Grouped'} bars, ${n} categories.`} table={seriesTable(labels, series, format)}
      legend={legend && k > 1 ? <Legend items={series.map((s, i) => ({ name: s.name, color: colorOf(s, i) }))} /> : undefined}
      pick={(vx, vy, w, h) => {
        const b = horizontal ? scaleBand(n, mt, h - mb) : scaleBand(n, ml, w - mr);
        const i = Math.floor(((horizontal ? vy - mt : vx - ml)) / b.step);
        return i < 0 || i >= n ? -1 : i;
      }}
      tip={(i, w, h) => {
        const rows = series.map((s, j) => ({ color: colorOf(s, j), label: s.name, value: format(s.values[i] ?? 0) }));
        if (stacked && k > 1) rows.push({ color: '', label: 'Total', value: format(totals[i] ?? 0) });
        const m = Math.max(...series.map((s) => s.values[i] ?? 0), stacked ? totals[i] ?? 0 : 0);
        if (horizontal) { const b = scaleBand(n, mt, h - mb); return { x: scaleLinear(yt.min, yt.max, ml, w - mr)(m), y: b.mid(i), title: labels[i] ?? '', rows }; }
        const b = scaleBand(n, ml, w - mr);
        return { x: b.mid(i), y: scaleLinear(yt.min, yt.max, h - mb, mt)(m), title: labels[i] ?? '', rows };
      }}
      render={({ w, h, active }) => {
        const vb = scaleBand(n, ml, w - mr), hb = scaleBand(n, mt, h - mb);
        const b = horizontal ? hb : vb;
        const v = scaleLinear(yt.min, yt.max, h - mb, mt), hv = scaleLinear(yt.min, yt.max, ml, w - mr);
        const kb = stacked ? 1 : k, bw = (b.bw - (kb - 1) * 2) / kb;
        const bars = labels.flatMap((_, i) => {
          let acc = 0;
          return series.map((s, j) => {
            const val = Math.max(0, s.values[i] ?? 0);
            const slot = stacked ? 0 : j, off = b.x(i) + slot * (bw + 2);
            const lastTop = stacked ? j === k - 1 : true;
            const d = horizontal
              ? roundedBar(hv(acc), off, hv(acc + val) - hv(acc), bw, 5, 'right', lastTop)
              : roundedBar(off, v(acc + val), bw, v(acc) - v(acc + val), 5, 'up', lastTop);
            if (stacked) acc += val;
            return <path key={`${i}-${j}`} d={d} className={horizontal ? 'ui-chart-growx' : 'ui-chart-grow'} style={{ ['--d' as string]: i }} fill={colorOf(s, j)} opacity={active === null || active === i ? 1 : 0.5} stroke={stacked ? 'var(--surface, #fff)' : undefined} strokeWidth={stacked ? 1 : 0} />;
          });
        });
        const step = thin(n, horizontal ? h : w - ml - mr, horizontal ? 20 : 52);
        return (
          <>
            {horizontal ? (
              <g aria-hidden="true">{yt.ticks.map((t) => (<g key={t}><line className="ui-chart-grid" x1={hv(t)} x2={hv(t)} y1={mt} y2={h - mb} /><text className="ui-chart-tick" x={hv(t)} y={h - 6} textAnchor="middle">{format(t)}</text></g>))}</g>
            ) : <GridY ticks={yt.ticks} y={v} x0={ml} x1={w - mr} f={format} />}
            {bars}
            <g aria-hidden="true">
              {labels.map((l, i) => (i % step === 0 || i === active) && (horizontal
                ? <text key={i} className="ui-chart-tick" data-on={i === active ? '' : undefined} x={ml - 6} y={hb.mid(i)} dy="0.32em" textAnchor="end">{l}</text>
                : <text key={i} className="ui-chart-tick" data-on={i === active ? '' : undefined} x={vb.mid(i)} y={h - 6} textAnchor="middle">{l}</text>))}
            </g>
            {active !== null && (stacked
              ? <text className="ui-chart-value" x={horizontal ? hv(totals[active] ?? 0) + 4 : vb.mid(active)} y={horizontal ? hb.mid(active) : v(totals[active] ?? 0) - 6} dy={horizontal ? '0.32em' : 0} textAnchor={horizontal ? 'start' : 'middle'}>{format(totals[active] ?? 0)}</text>
              : series.map((s, j) => {
                const val = s.values[active] ?? 0, off = b.x(active) + j * (bw + 2) + bw / 2;
                return horizontal
                  ? <text key={j} className="ui-chart-value" x={hv(val) + 4} y={off} dy="0.32em" textAnchor="start">{format(val)}</text>
                  : <text key={j} className="ui-chart-value" x={off} y={v(val) - 5}>{format(val)}</text>;
              }))}
          </>
        );
      }}
    />
  );
}

export function Demo() {
  return <div style={{ width: '100%', padding: '4px 8px' }}><BarChart legend={false} height={120} /></div>;
}
