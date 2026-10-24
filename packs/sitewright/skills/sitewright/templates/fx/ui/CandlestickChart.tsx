'use client';
import { Frame, GridY, LabelsX, fmt, niceTicks, rng, scaleBand, scaleLinear } from './_b1';

export interface Candle { label: string; open: number; high: number; low: number; close: number; volume?: number }
export interface CandlestickChartProps {
  data?: Candle[];
  /** Volume bars under the candles (only for candles that carry a volume). */
  volume?: boolean;
  title?: string;
  height?: number;
  format?: (v: number) => string;
}

function demo(n: number): Candle[] {
  const r = rng(21);
  let p = 100;
  return Array.from({ length: n }, (_, i) => {
    const open = p, close = Math.max(20, open + (r() - 0.46) * 8);
    const high = Math.max(open, close) + r() * 3, low = Math.min(open, close) - r() * 3;
    p = close;
    return { label: `Day ${i + 1}`, open: +open.toFixed(2), high: +high.toFixed(2), low: +low.toFixed(2), close: +close.toFixed(2), volume: Math.round(800 + r() * 2200) };
  });
}
const DATA = demo(30);
const price = (v: number) => v.toFixed(2);

export default function CandlestickChart({ data = DATA, volume = true, title = 'Price and volume', height, format = price }: CandlestickChartProps) {
  const n = data.length;
  const hasVol = volume && data.some((d) => d.volume);
  const yt = niceTicks(Math.min(...data.map((d) => d.low)), Math.max(...data.map((d) => d.high)), 5);
  const vmax = Math.max(1, ...data.map((d) => d.volume ?? 0));
  const ml = 40, mr = 8, mt = 8, mb = 22;
  const zones = (h: number) => { const vh = hasVol ? (h - mt - mb) * 0.2 : 0; return { vh, pb: h - mb - vh - (hasVol ? 8 : 0) }; };
  return (
    <Frame
      title={title} height={height} aspect={0.62} count={n} summary={`${n} candles. Hollow candles closed up, filled candles closed down.`}
      table={{ head: ['', 'Open', 'High', 'Low', 'Close', ...(hasVol ? ['Volume'] : [])], rows: data.map((d) => [d.label, format(d.open), format(d.high), format(d.low), format(d.close), ...(hasVol ? [fmt(d.volume ?? 0)] : [])]) }}
      pick={(vx, _vy, w) => { const i = Math.floor((vx - ml) / scaleBand(n, ml, w - mr).step); return i < 0 || i >= n ? -1 : i; }}
      tip={(i, w, h) => {
        const d = data[i]!, up = d.close >= d.open, ch = ((d.close - d.open) / d.open) * 100;
        const rows = [{ label: 'O', value: format(d.open) }, { label: 'H', value: format(d.high) }, { label: 'L', value: format(d.low) }, { color: up ? 'var(--ui-chart-up)' : 'var(--ui-chart-down)', label: 'C', value: `${format(d.close)} (${ch >= 0 ? '+' : '−'}${Math.abs(ch).toFixed(1)}%)` }];
        if (hasVol) rows.push({ color: '', label: 'Vol', value: fmt(d.volume ?? 0) });
        return { x: scaleBand(n, ml, w - mr).mid(i), y: scaleLinear(yt.min, yt.max, zones(h).pb, mt)(d.high), title: `${d.label} ${up ? '▲ up' : '▼ down'}`, rows };
      }}
      render={({ w, h, active }) => {
        const b = scaleBand(n, ml, w - mr, 0.35), { vh, pb } = zones(h);
        const y = scaleLinear(yt.min, yt.max, pb, mt), vy = scaleLinear(0, vmax, h - mb, h - mb - vh);
        return (
          <>
            <GridY ticks={yt.ticks} y={y} x0={ml} x1={w - mr} f={(t) => String(+t.toFixed(1))} />
            {active !== null && <rect x={b.x(active) - 2} y={mt} width={b.bw + 4} height={h - mb - mt} fill="var(--ink, #111)" opacity={0.07} />}
            <g className="ui-chart-fade">
              {data.map((d, i) => {
                const up = d.close >= d.open, c = up ? 'var(--ui-chart-up)' : 'var(--ui-chart-down)', cx = b.mid(i);
                const top = y(Math.max(d.open, d.close)), bh = Math.max(1.5, Math.abs(y(d.open) - y(d.close)));
                return (
                  <g key={i}>
                    <line x1={cx} x2={cx} y1={y(d.high)} y2={y(d.low)} stroke={c} strokeWidth={1.5} />
                    <rect x={b.x(i)} y={top} width={b.bw} height={bh} rx={1.5} fill={up ? 'var(--surface, #fff)' : c} stroke={c} strokeWidth={1.5} />
                    {hasVol && d.volume ? <rect x={b.x(i)} y={vy(d.volume)} width={b.bw} height={vy(0) - vy(d.volume)} fill={c} fillOpacity={up ? 0.18 : 0.5} stroke={c} strokeWidth={up ? 1 : 0} /> : null}
                  </g>
                );
              })}
            </g>
            <LabelsX labels={data.map((d) => d.label)} x={b.mid} y={h - 6} width={w - ml - mr} active={active} />
            {active !== null && <line className="ui-chart-cross" x1={b.mid(active)} x2={b.mid(active)} y1={mt} y2={h - mb} />}
          </>
        );
      }}
    />
  );
}

export function Demo() {
  return <div style={{ width: '100%', padding: '2px 8px' }}><CandlestickChart height={126} data={DATA.slice(0, 22)} /></div>;
}
