'use client';
import { useMemo, useState } from 'react';
import { Plot, ScaleLegend, DataTable, heatFill, level, fmt, r2, seeded, useRoving, type Cell } from './_b2';

export interface HeatmapChartProps {
  /** values[row][col]; a calendar uses rows = weekdays, cols = weeks */
  values?: number[][];
  rowLabels?: string[];
  colLabels?: string[];
  unit?: string;
  title?: string;
}
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
function demoValues() {
  const rnd = seeded(7);
  return DAYS.map((_, d) => Array.from({ length: 16 }, (_, w) => {
    const base = d >= 5 ? 0.25 : 1, wave = 0.6 + 0.4 * Math.sin(w / 2.2);
    const v = rnd() * 10 * base * wave;
    return rnd() < 0.12 ? 0 : Math.round(v);
  }));
}

export default function HeatmapChart({ values, rowLabels = DAYS, colLabels, unit = 'contributions', title = 'Activity by week and weekday' }: HeatmapChartProps) {
  const vals = useMemo(() => values ?? demoValues(), [values]);
  const rows = vals.length, cols = vals[0]?.length ?? 0;
  const cl = colLabels ?? Array.from({ length: cols }, (_, i) => `Wk ${i + 1}`);
  const cells: Cell[] = useMemo(() => vals.flatMap((r, ri) => r.map((_, ci) => ({ r: ri, c: ci }))), [vals]);
  const [hov, setHov] = useState<number | null>(null);
  const ip = useRoving(cells, setHov);
  const flat = vals.flat(), min = Math.min(...flat, 0), max = Math.max(...flat, 1);
  const W = 300, lw = 28, gap = 3, cs = (W - lw) / Math.max(1, cols) - gap, step = cs + gap, H = 16 + rows * step;
  const at = (i: number) => ({ r: cells[i].r, c: cells[i].c, v: vals[cells[i].r][cells[i].c] });
  const act = hov === null ? null : at(hov);
  const every = Math.ceil(cols / 5);
  return (
    <figure className="ui-chart2">
      <Plot vb={[W, H]} label={`${title}: ${rows} rows by ${cols} columns, values from ${fmt(min)} to ${fmt(max)} ${unit}`}
        tip={act ? { x: r2(lw + act.c * step + cs / 2), y: r2(16 + act.r * step), title: `${rowLabels[act.r] ?? act.r + 1}, ${cl[act.c]}`, body: `${fmt(act.v)} ${unit}` } : null}>
        <g aria-hidden="true">
          {cl.map((l, c) => (c % every === 0 ? <text key={c} className="ui-chart2-muted" x={r2(lw + c * step)} y={9} style={{ fontSize: 9 }}>{l}</text> : null))}
          {rowLabels.map((l, r) => (r % 2 === 0 ? <text key={r} className="ui-chart2-muted" x={0} y={r2(16 + r * step + cs / 2 + 3)} style={{ fontSize: 9 }}>{l}</text> : null))}
        </g>
        {cells.map((cell, i) => {
          const v = vals[cell.r][cell.c];
          return (
            <g key={i} {...ip(i)} className="ui-chart2-hit ui-chart2-fade" role="img" style={{ ['--d' as string]: `${(cell.c + cell.r * 0.4) * 0.03}s` }}
              aria-label={`${rowLabels[cell.r] ?? cell.r + 1}, ${cl[cell.c]}: ${fmt(v)} ${unit}`}>
              <rect className="ui-chart2-mark" x={r2(lw + cell.c * step)} y={r2(16 + cell.r * step)} width={r2(cs)} height={r2(cs)} rx={3} fill={heatFill(level(v, min, max))} stroke="var(--line, #e5e7eb)" strokeOpacity={0.5} strokeWidth={1} />
            </g>
          );
        })}
      </Plot>
      <ScaleLegend min={fmt(min)} max={fmt(max)} />
      <DataTable caption={title} head={['', ...cl]} rows={vals.map((r, ri) => [rowLabels[ri] ?? `Row ${ri + 1}`, ...r.map(fmt)])} />
    </figure>
  );
}

export function Demo() {
  return <div style={{ width: '100%', padding: 4 }}><HeatmapChart /></div>;
}
