'use client';
import { useMemo, useState } from 'react';
import { Plot, ScaleLegend, DataTable, heatFill, level, fmt, r2, useRoving, type Cell } from './_b2';

export interface TileMapChartProps {
  /** value per two-letter state code (and DC) */
  data?: Record<string, number>;
  unit?: string;
  title?: string;
}
// [code, name, row, col] on an 11 x 8 grid
const T: [string, string, number, number][] = [
  ['AK', 'Alaska', 0, 0], ['ME', 'Maine', 0, 10], ['VT', 'Vermont', 1, 9], ['NH', 'New Hampshire', 1, 10],
  ['WA', 'Washington', 2, 0], ['ID', 'Idaho', 2, 1], ['MT', 'Montana', 2, 2], ['ND', 'North Dakota', 2, 3], ['MN', 'Minnesota', 2, 4], ['IL', 'Illinois', 2, 5],
  ['WI', 'Wisconsin', 2, 6], ['MI', 'Michigan', 2, 7], ['NY', 'New York', 2, 8], ['RI', 'Rhode Island', 2, 9], ['MA', 'Massachusetts', 2, 10],
  ['OR', 'Oregon', 3, 0], ['NV', 'Nevada', 3, 1], ['WY', 'Wyoming', 3, 2], ['SD', 'South Dakota', 3, 3], ['IA', 'Iowa', 3, 4], ['IN', 'Indiana', 3, 5],
  ['OH', 'Ohio', 3, 6], ['PA', 'Pennsylvania', 3, 7], ['NJ', 'New Jersey', 3, 8], ['CT', 'Connecticut', 3, 9],
  ['CA', 'California', 4, 0], ['UT', 'Utah', 4, 1], ['CO', 'Colorado', 4, 2], ['NE', 'Nebraska', 4, 3], ['MO', 'Missouri', 4, 4], ['KY', 'Kentucky', 4, 5],
  ['WV', 'West Virginia', 4, 6], ['VA', 'Virginia', 4, 7], ['MD', 'Maryland', 4, 8], ['DE', 'Delaware', 4, 9],
  ['AZ', 'Arizona', 5, 1], ['NM', 'New Mexico', 5, 2], ['KS', 'Kansas', 5, 3], ['AR', 'Arkansas', 5, 4], ['TN', 'Tennessee', 5, 5], ['NC', 'North Carolina', 5, 6],
  ['SC', 'South Carolina', 5, 7], ['DC', 'District of Columbia', 5, 8],
  ['OK', 'Oklahoma', 6, 3], ['LA', 'Louisiana', 6, 4], ['MS', 'Mississippi', 6, 5], ['AL', 'Alabama', 6, 6], ['GA', 'Georgia', 6, 7],
  ['HI', 'Hawaii', 7, 0], ['TX', 'Texas', 7, 3], ['FL', 'Florida', 7, 8],
];
const demo = (): Record<string, number> => Object.fromEntries(T.map(([code], i) => [code, 8 + ((code.charCodeAt(0) * 31 + code.charCodeAt(1) * 17 + i * 7) % 83)]));

export default function TileMapChart({ data, unit = 'per 1,000 people', title = 'Value by state' }: TileMapChartProps) {
  const vals = useMemo(() => data ?? demo(), [data]);
  const tiles = useMemo(() => T.map(([code, name, r, c]) => ({ code, name, r, c, v: vals[code] })), [vals]);
  const cells: Cell[] = tiles;
  const [hov, setHov] = useState<number | null>(null);
  const ip = useRoving(cells, setHov);
  const known = tiles.filter((t) => typeof t.v === 'number').map((t) => t.v);
  const min = Math.min(...known, 0), max = Math.max(...known, 1);
  const t = 22, g = 3, s = t + g, W = 11 * s - g, H = 8 * s - g;
  const act = hov === null ? null : tiles[hov];
  return (
    <figure className="ui-chart2">
      <Plot vb={[W, H]} label={`${title}: tile grid map of the United States, values from ${fmt(min)} to ${fmt(max)} ${unit}`}
        tip={act ? { x: r2(act.c * s + t / 2), y: r2(act.r * s), title: act.name, body: typeof act.v === 'number' ? `${fmt(act.v)} ${unit}` : 'no data' } : null}>
        {tiles.map((a, i) => {
          const has = typeof a.v === 'number', lv = has ? level(a.v, min, max, 4) : 0;
          return (
            <g key={a.code} {...ip(i)} className="ui-chart2-hit ui-chart2-fade" role="img" style={{ ['--d' as string]: `${(a.c + a.r) * 0.04}s` }}
              aria-label={`${a.name}: ${has ? `${fmt(a.v)} ${unit}` : 'no data'}`}>
              <rect className="ui-chart2-mark" x={a.c * s} y={a.r * s} width={t} height={t} rx={3} fill={heatFill(lv)} stroke="var(--line, #e5e7eb)" strokeOpacity={0.6} strokeWidth={1} />
              <text aria-hidden="true" pointerEvents="none" x={a.c * s + t / 2} y={a.r * s + t / 2 + 3} textAnchor="middle" style={{ fontSize: 8.5, fontWeight: 600, fill: lv >= 4 ? 'var(--on-primary, #fff)' : 'var(--ink, #111)' }}>{a.code}</text>
            </g>
          );
        })}
      </Plot>
      <ScaleLegend min={fmt(min)} max={fmt(max)} low="Low" high="High" />
      <DataTable caption={title} head={['State', 'Value']} rows={tiles.map((a) => [a.name, typeof a.v === 'number' ? `${fmt(a.v)} ${unit}` : 'no data'])} />
    </figure>
  );
}

export function Demo() {
  return <div style={{ width: '100%', maxWidth: 190, margin: '0 auto', padding: 2 }}><TileMapChart /></div>;
}
