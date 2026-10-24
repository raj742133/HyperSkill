'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Figure } from '@/components/fx';
import { Icon } from '@/components/icons/Icon';

export interface RecordCard {
  id: string;
  title: string | null;
  subtitle: string | null;
  status: string;
  statusLabel: string;
  statusTone: string;
  statusIcon?: string;
  category: string | null;
  owner: string | null;
  source: string | null;
  startedAt: string;
  /** Formatted once on the server, so the page and the browser never disagree about it. */
  when: string;
  metrics: Record<string, number>;
  items: number;
  files: number;
  thumbUrl: string | null;
}

type Facet = 'category' | 'owner' | 'source' | 'status' | 'subtitle';

const facetValue = (c: RecordCard, f: Facet): string =>
  (f === 'status' ? c.statusLabel : c[f]) || 'Not set';

/** The list: search and filter as you type. Everything is filtered in the browser - the page sends at most 300 records. */
export function RecordBrowser({ records, statuses, facets, metrics, searchPlaceholder }: {
  records: RecordCard[];
  statuses: { id: string; label: string; tone: string; icon?: string }[];
  facets: [string, string][];
  metrics: { key: string; label: string; unit?: string }[];
  searchPlaceholder: string;
}) {
  const [status, setStatus] = useState('all');
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState<Record<string, string>>({});
  const F = facets as [Facet, string][];

  // Each list offers what exists among the records the OTHER filters leave, with how many - so no choice ever leads to "No matches".
  const options = useMemo(() => {
    const out: Record<string, [string, number][]> = {};
    for (const [f] of F) {
      const counts = new Map<string, number>();
      for (const c of records) {
        if (F.some(([g]) => g !== f && picked[g] && facetValue(c, g) !== picked[g])) continue;
        counts.set(facetValue(c, f), (counts.get(facetValue(c, f)) ?? 0) + 1);
      }
      out[f] = [...counts.keys()].sort((a, b) => a.localeCompare(b)).map((v) => [v, counts.get(v)!]);
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [records, picked]);
  const anyPicked = F.some(([f]) => picked[f]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return records.filter((c) => {
      if (F.some(([f]) => picked[f] && facetValue(c, f) !== picked[f])) return false;
      if (status !== 'all' && c.status !== status) return false;
      if (!needle) return true;
      return [c.title, c.subtitle, c.owner, c.category, c.source].some((v) => v?.toLowerCase().includes(needle));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [records, status, q, picked]);

  const count = (id: string) => (id === 'all' ? records.length : records.filter((c) => c.status === id).length);

  return (
    <div className="browser">
      <div className="browser-bar">
        <div className="chips" role="tablist" aria-label="Filter by status">
          {[{ id: 'all', label: 'All', icon: undefined as string | undefined }, ...statuses].map((s) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={status === s.id}
              className={`chip${status === s.id ? ' on' : ''}`}
              onClick={() => setStatus(s.id)}
            >
              <span className="chip-t"><Icon name={s.icon} className="chip-ic" />{s.label} · {count(s.id)}</span>
            </button>
          ))}
        </div>
        <label className="search">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          <input id="record-search" type="search" placeholder={searchPlaceholder} aria-label={searchPlaceholder} value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
      </div>

      {F.length ? (
        <div className="facets" aria-label="Filters">
          {F.map(([f, label]) => (
            <label key={f} className={`facet${picked[f] ? ' on' : ''}`}>
              <span>{label}</span>
              <select value={picked[f] ?? ''} onChange={(e) => setPicked({ ...picked, [f]: e.target.value })} aria-label={label}>
                <option value="">All</option>
                {(options[f] ?? []).map(([v, n]) => <option key={v} value={v}>{v} · {n}</option>)}
                {picked[f] && !(options[f] ?? []).some(([v]) => v === picked[f]) ? <option value={picked[f]}>{picked[f]}</option> : null}
              </select>
            </label>
          ))}
          {anyPicked ? (
            <button type="button" className="btn ghost facet-clear" onClick={() => setPicked({})}>Clear · {shown.length} shown</button>
          ) : null}
        </div>
      ) : null}

      {shown.length === 0 ? (
        <div className="card empty" role="status"><Figure place="empty" />Nothing matches.</div>
      ) : (
        <div className="rec-grid">
          {shown.map((c) => (
            <div key={c.id}>
              <Link href={`/records/${c.id}`} className="rec-card">
                <div className="rec-thumb">
                  {c.thumbUrl ? <img src={c.thumbUrl} alt="" loading="lazy" /> : <div className="nothumb" />}
                  <span className={`mode t tone-${c.statusTone}`}><Icon name={c.statusIcon} className="mode-ic" />{c.statusLabel}</span>
                </div>
                <div className="rec-body">
                  <div className="rec-store">{c.title ?? <span className="muted">Untitled</span>}</div>
                  <div className="rec-when">{c.when}{c.subtitle ? <> · {c.subtitle}</> : null}</div>
                  <div className="rec-nums">
                    {metrics.slice(0, 2).map((m) => (
                      c.metrics[m.key] !== undefined ? <span key={m.key}><b>{m.unit ?? ''}{Number(c.metrics[m.key]).toLocaleString('en-GB')}</b> {m.label}</span> : null
                    ))}
                    {c.items ? <span><b>{c.items}</b> {c.items === 1 ? 'item' : 'items'}</span> : null}
                    {c.files ? <span><b>{c.files}</b> {c.files === 1 ? 'file' : 'files'}</span> : null}
                  </div>
                  <div className="rec-foot mono">{[c.owner, c.category, c.source].filter(Boolean).join(' · ') || ' '}</div>
                </div>
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
