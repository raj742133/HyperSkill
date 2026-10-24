'use client';
import { useEffect, useRef, useState } from 'react';
import { Frame, GridY, areaPath, clamp, curve, fmt, niceTicks, rng, scaleLinear, type Pt } from './_b1';
import { useInView } from './_b1';

export interface LiveLineChartProps {
  /** Called every `interval` ms for the next value (sync or async). Default: a seeded random walk. */
  stream?: () => number | Promise<number>;
  /** Values already on the chart (oldest first). */
  initial?: number[];
  interval?: number;
  /** How many points stay visible. */
  windowSize?: number;
  seed?: number;
  title?: string;
  unit?: string;
  height?: number;
  format?: (v: number) => string;
}

function walk(seed: number) {
  const r = rng(seed);
  let v = 60;
  return () => { v = clamp(v + (r() - 0.5) * 14 + (60 - v) * 0.06, 8, 120); return Math.round(v * 10) / 10; };
}

export default function LiveLineChart({ stream, initial, interval = 1000, windowSize = 40, seed = 7, title = 'Live requests per second', unit = 'req/s', height, format = fmt }: LiveLineChartProps) {
  const [gen] = useState(() => walk(seed));
  const [vals, setVals] = useState<number[]>(() => initial ?? (stream ? [] : Array.from({ length: windowSize }, () => gen())));
  const [paused, setPaused] = useState(false);
  const [tabHidden, setTabHidden] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const seen = useInView(wrap, false);
  const touching = useRef(false);
  const running = !paused && seen && !tabHidden;
  useEffect(() => {
    const on = () => setTabHidden(document.hidden);
    on(); document.addEventListener('visibilitychange', on);
    return () => document.removeEventListener('visibilitychange', on);
  }, []);
  useEffect(() => {
    if (!running) return;
    let alive = true;
    const id = window.setInterval(async () => {
      if (touching.current) return;
      let v: number;
      try { v = stream ? await stream() : gen(); } catch { return; }
      if (alive && Number.isFinite(v)) setVals((o) => [...o, v].slice(-windowSize));
    }, interval);
    return () => { alive = false; window.clearInterval(id); };
  }, [running, interval, stream, gen, windowSize]);

  const n = vals.length, off = windowSize - n;
  const lo = Math.min(...vals, 0), hi = Math.max(...vals, 1);
  const yt = niceTicks(Math.max(0, lo === 0 ? 0 : Math.floor(lo / 10) * 10 - 10), hi, 4);
  const ml = 36, mr = 10, mt = 8, mb = 20;
  const xs = (w: number, i: number) => ml + ((off + i) / Math.max(1, windowSize - 1)) * (w - ml - mr);
  const last = vals[n - 1];
  return (
    <div ref={wrap} style={{ width: '100%' }}>
      <Frame
        title={title} height={height} count={n} summary={`Streaming chart, newest value ${last === undefined ? 'none yet' : format(last)} ${unit}.`}
        table={{ head: ['Seconds ago', unit], rows: vals.map((v, i) => [String(n - 1 - i), format(v)]) }}
        onActive={(i) => { touching.current = i !== null; }}
        legend={
          <div className="ui-chart-bar">
            <span className="ui-chart-live"><span className="ui-chart-pulse" aria-hidden="true" style={paused || !running ? { animation: 'none', opacity: 0.4 } : undefined} />{last === undefined ? '-' : format(last)} <span className="ui-chart-tick" style={{ fontSize: 12 }}>{unit}</span></span>
            <button type="button" className="ui-chart-btn" style={{ marginLeft: 'auto' }} onClick={() => setPaused((p) => !p)}>{paused ? 'Resume' : 'Pause'}</button>
          </div>
        }
        pick={(vx, _vy, w) => (n ? clamp(Math.round(((vx - ml) / (w - ml - mr)) * (windowSize - 1)) - off, 0, n - 1) : -1)}
        tip={(i, w, h) => ({ x: xs(w, i), y: scaleLinear(yt.min, yt.max, h - mb, mt)(vals[i] ?? 0), title: i === n - 1 ? 'Now' : `${n - 1 - i}s ago`, rows: [{ color: 'var(--ui-chart-c1)', label: unit, value: format(vals[i] ?? 0) }] })}
        render={({ w, h, active, uid }) => {
          const y = scaleLinear(yt.min, yt.max, h - mb, mt);
          const pts: Pt[] = vals.map((v, i) => [xs(w, i), y(v)]);
          return (
            <>
              <defs><linearGradient id={`${uid}g`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--ui-chart-c1)" stopOpacity={0.35} /><stop offset="1" stopColor="var(--ui-chart-c1)" stopOpacity={0.02} /></linearGradient></defs>
              <GridY ticks={yt.ticks} y={y} x0={ml} x1={w - mr} f={format} />
              {n > 1 && <path d={areaPath(pts, y(yt.min))} fill={`url(#${uid}g)`} />}
              {n > 1 && <path d={curve(pts)} fill="none" stroke="var(--ui-chart-c1)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />}
              <g aria-hidden="true">
                <text className="ui-chart-tick" x={xs(w, 0)} y={h - 5}>{`-${Math.max(0, n - 1)}s`}</text>
                <text className="ui-chart-tick" x={w - mr} y={h - 5} textAnchor="end">now</text>
              </g>
              {n > 0 && active === null && <circle cx={pts[n - 1]![0]} cy={pts[n - 1]![1]} r={4} fill="var(--ui-chart-c1)" stroke="var(--surface, #fff)" strokeWidth={2} />}
              {active !== null && (
                <g>
                  <line className="ui-chart-cross" x1={xs(w, active)} x2={xs(w, active)} y1={mt} y2={h - mb} />
                  <circle className="ui-chart-dot" cx={xs(w, active)} cy={y(vals[active] ?? 0)} r={4.5} fill="var(--ui-chart-c1)" />
                </g>
              )}
            </>
          );
        }}
      />
    </div>
  );
}

export function Demo() {
  return <div style={{ width: '100%', padding: '2px 8px' }}><LiveLineChart height={92} windowSize={30} /></div>;
}
