'use client';
import { useMemo, useState } from 'react';
import { Plot, DataTable, sankeyLayout, fmt, r2, series, useRoving, type SNode, type SLink } from './_b2';

export interface SankeyChartProps {
  data?: { nodes: SNode[]; links: SLink[] };
  unit?: string;
  title?: string;
}
const DEF = {
  nodes: [
    { id: 'search', label: 'Search' }, { id: 'social', label: 'Social' }, { id: 'direct', label: 'Direct' },
    { id: 'home', label: 'Home' }, { id: 'pricing', label: 'Pricing' }, { id: 'blog', label: 'Blog' },
    { id: 'signup', label: 'Sign-up' }, { id: 'bounce', label: 'Bounce' },
  ],
  links: [
    { source: 'search', target: 'home', value: 420 }, { source: 'search', target: 'blog', value: 380 }, { source: 'social', target: 'blog', value: 260 },
    { source: 'social', target: 'home', value: 90 }, { source: 'direct', target: 'home', value: 210 }, { source: 'direct', target: 'pricing', value: 160 },
    { source: 'home', target: 'pricing', value: 330 }, { source: 'home', target: 'bounce', value: 390 }, { source: 'blog', target: 'bounce', value: 480 },
    { source: 'blog', target: 'pricing', value: 160 }, { source: 'pricing', target: 'signup', value: 270 }, { source: 'pricing', target: 'bounce', value: 380 },
  ],
};

export default function SankeyChart({ data = DEF, unit = '', title = 'Visitor flow' }: SankeyChartProps) {
  const W = 320, H = 170, NW = 10, M = 48;
  const lay = useMemo(() => sankeyLayout(data.nodes, data.links, W - 2 * M, H, NW, 8), [data]);
  const [hov, setHov] = useState<number | null>(null);
  const ip = useRoving(lay.nodes.length, setHov);
  const act = hov === null ? null : lay.nodes[hov];
  const related = (l: { s: { id: string }; t: { id: string } }) => !!act && (l.s.id === act.id || l.t.id === act.id);
  const idx = (id: string) => lay.nodes.findIndex((n) => n.id === id);
  const name = (n: { id: string; label?: string }) => n.label ?? n.id;
  return (
    <figure className="ui-chart2">
      <Plot vb={[W, H]} label={`${title}: ${lay.links.map((l) => `${name(l.s)} to ${name(l.t)} ${fmt(l.value)}${unit}`).join(', ')}`}
        tip={act ? { x: M + act.x + NW / 2, y: act.y, title: name(act), body: `in ${fmt(act.in)}${unit} · out ${fmt(act.out)}${unit}` } : null}>
        <g transform={`translate(${M} 0)`}>
          {lay.links.map((l, i) => (
            <path key={i} d={l.d} fill="none" stroke={series(idx(l.s.id))} strokeWidth={r2(Math.max(1, l.w))} className="ui-chart2-fade"
              style={{ opacity: act ? (related(l) ? 0.6 : 0.08) : 0.3, transition: 'opacity .2s' }} pointerEvents="none">
              <title>{`${name(l.s)} to ${name(l.t)}: ${fmt(l.value)}${unit}`}</title>
            </path>
          ))}
          {lay.nodes.map((n, i) => {
            const first = n.col === 0, last = n.col === lay.cols - 1 && lay.cols > 1;
            return (
              <g key={n.id} {...ip(i)} className="ui-chart2-hit ui-chart2-fade" role="img" aria-label={`${name(n)}: in ${fmt(n.in)}${unit}, out ${fmt(n.out)}${unit}`}>
                <rect x={n.x - 4} y={n.y - 2} width={NW + 8} height={Math.max(4, n.h) + 4} fill="transparent" />
                <rect className="ui-chart2-mark" x={n.x} y={r2(n.y)} width={NW} height={r2(Math.max(2, n.h))} rx={2} fill={series(i)} />
                <text className="ui-chart2-halo" aria-hidden="true" y={r2(n.y + n.h / 2 + 4)} x={first ? n.x - 5 : last ? n.x + NW + 5 : n.x + NW + 5} textAnchor={first ? 'end' : 'start'}>{name(n)}</text>
              </g>
            );
          })}
        </g>
      </Plot>
      <DataTable caption={title} head={['From', 'To', 'Value']} rows={lay.links.map((l) => [name(l.s), name(l.t), `${fmt(l.value)}${unit}`])} />
    </figure>
  );
}

export function Demo() {
  return <div style={{ width: '100%', padding: 4 }}><SankeyChart /></div>;
}
