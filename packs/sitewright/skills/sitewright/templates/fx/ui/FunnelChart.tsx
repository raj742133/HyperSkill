'use client';
import { useState } from 'react';
import { Plot, DataTable, fmt, r2, useRoving } from './_b2';

export interface FunnelStage { label: string; value: number }
export interface FunnelChartProps { data?: FunnelStage[]; title?: string }
const DEF: FunnelStage[] = [
  { label: 'Visitors', value: 12400 }, { label: 'Sign-ups', value: 5200 }, { label: 'Trials', value: 2800 }, { label: 'Paid', value: 1150 }, { label: 'Retained', value: 820 },
];

export default function FunnelChart({ data = DEF, title = 'Conversion funnel' }: FunnelChartProps) {
  const [hov, setHov] = useState<number | null>(null);
  const ip = useRoving(data.length, setHov);
  const n = data.length, RH = 40, W = 320, H = n * RH, cx = 92, maxW = 176, top = data[0]?.value || 1;
  const wOf = (i: number) => Math.max(34, (maxW * (data[i]?.value ?? 0)) / top);
  const st = data.map((d, i) => {
    const wt = wOf(i), wb = i < n - 1 ? wOf(i + 1) : wt * 0.8;
    const y0 = i * RH + 1, y1 = (i + 1) * RH - 1, mid = i * RH + RH / 2;
    const pct = Math.round((d.value / top) * 1000) / 10, drop = i ? Math.round((1 - d.value / data[i - 1].value) * 1000) / 10 : 0;
    return { d, i, wt, wb, y0, y1, mid, pct, drop, inside: Math.min(wt, wb) >= 96 };
  });
  const act = hov === null ? null : st[hov];
  const dropTxt = (s: (typeof st)[number]) => (s.i ? `-${s.drop}% vs previous` : 'entry stage');
  return (
    <figure className="ui-chart2">
      <Plot vb={[W, H]} label={`${title}: ${st.map((s) => `${s.d.label} ${fmt(s.d.value)} (${s.pct}%)`).join(', ')}`}
        tip={act ? { x: cx, y: act.y0 + 2, title: act.d.label, body: `${fmt(act.d.value)} · ${act.pct}% of top · ${dropTxt(act)}` } : null}>
        {st.map((s) => {
          const pts = `${r2(cx - s.wt / 2)},${s.y0} ${r2(cx + s.wt / 2)},${s.y0} ${r2(cx + s.wb / 2)},${s.y1} ${r2(cx - s.wb / 2)},${s.y1}`;
          const dim = hov !== null && hov !== s.i;
          return (
            <g key={s.i} className="ui-chart2-fade" style={{ ['--d' as string]: `${s.i * 0.1}s` }}>
              <g {...ip(s.i)} className={`ui-chart2-hit${dim ? ' ui-chart2-dim' : ''}`} role="img"
                aria-label={`${s.d.label}: ${fmt(s.d.value)}, ${s.pct}% of the first stage${s.i ? `, ${s.drop}% drop-off from previous` : ''}`}>
                <polygon className="ui-chart2-mark" points={pts} fill="var(--primary, #2563eb)" stroke="var(--surface, #fff)" strokeWidth={1} strokeLinejoin="round" />
                {s.inside && (
                  <g textAnchor="middle" aria-hidden="true" pointerEvents="none">
                    <text x={cx} y={s.mid - 2} style={{ fill: 'var(--on-primary, #fff)', fontWeight: 600 }}>{s.d.label}</text>
                    <text x={cx} y={s.mid + 11} style={{ fill: 'var(--on-primary, #fff)' }}>{fmt(s.d.value)}</text>
                  </g>
                )}
              </g>
              <g aria-hidden="true">
                {s.inside ? (
                  <>
                    <text x={194} y={s.mid - 1} style={{ fontWeight: 600 }}>{s.pct}% of top</text>
                    <text className="ui-chart2-muted" x={194} y={s.mid + 13}>{dropTxt(s)}</text>
                  </>
                ) : (
                  <>
                    <text x={194} y={s.mid - 6} style={{ fontWeight: 600 }}>{s.d.label} · {fmt(s.d.value)}</text>
                    <text x={194} y={s.mid + 6}>{s.pct}% of top</text>
                    <text className="ui-chart2-muted" x={194} y={s.mid + 18}>{dropTxt(s)}</text>
                  </>
                )}
              </g>
            </g>
          );
        })}
      </Plot>
      <DataTable caption={title} head={['Stage', 'Count', 'Percent of first stage', 'Drop-off from previous']} rows={st.map((s) => [s.d.label, fmt(s.d.value), `${s.pct}%`, s.i ? `${s.drop}%` : '-'])} />
    </figure>
  );
}

export function Demo() {
  return <div style={{ width: '100%', padding: 4 }}><FunnelChart data={DEF.slice(0, 4)} /></div>;
}
