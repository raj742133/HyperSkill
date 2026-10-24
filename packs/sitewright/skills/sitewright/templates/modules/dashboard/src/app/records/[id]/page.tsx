import { Fragment } from 'react';
import { notFound } from 'next/navigation';
import { migrate, query } from '@/lib/db';
import { SiteHeader } from '@/components/SiteHeader';
import { StatusActions } from './StatusActions';
import site from '@/content/site.json';

export const dynamic = 'force-dynamic';

const D = site.dashboard as unknown as {
  statuses: { id: string; label: string; tone: string }[];
  labels: Record<string, string>;
  metrics: { key: string; label: string; unit?: string }[];
  itemsLabel: string; filesLabel: string;
};

const file = (key: string) => `/api/file?key=${encodeURIComponent(key)}`;
const download = (key: string, name: string) => `/api/file?key=${encodeURIComponent(key)}&download=1&name=${encodeURIComponent(name)}`;

export default async function RecordPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await migrate();
  const rec = (await query<{
    id: string; title: string | null; subtitle: string | null; status: string; category: string | null; owner: string | null;
    source: string | null; occurred_at: string; received_at: string; metrics: Record<string, number>; data: Record<string, unknown>;
  }>(`SELECT * FROM records WHERE id = $1`, [id]))[0];
  if (!rec) notFound();

  const [items, files] = await Promise.all([
    query<{ id: string; label: string; status: string | null; value: number | null; note: string | null }>(
      `SELECT id, label, status, value, note FROM record_items WHERE record_id = $1 ORDER BY id`, [id]),
    query<{ idx: number; object_key: string; caption: string | null }>(
      `SELECT idx, object_key, caption FROM record_files WHERE record_id = $1 ORDER BY idx`, [id]),
  ]);

  const status = D.statuses.find((s) => s.id === rec.status);
  const when = new Date(rec.occurred_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
  const facts: [string, string][] = [
    [D.labels.category ?? 'Type', rec.category ?? ''],
    [D.labels.owner ?? 'Owner', rec.owner ?? ''],
    [D.labels.source ?? 'Source', rec.source ?? ''],
    ...D.metrics.filter((m) => rec.metrics?.[m.key] !== undefined).map((m) => [m.label, `${m.unit ?? ''}${Number(rec.metrics[m.key]).toLocaleString('en-GB')}`] as [string, string]),
    ...Object.entries(rec.data ?? {}).map(([k, v]) => [k, String(v)] as [string, string]),
    ['Received', new Date(rec.received_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })],
  ].filter(([, v]) => v) as [string, string][];

  return (
    <>
      <SiteHeader active="dashboard" />
      <main className="wrap">
        <section className="d-head">
          <a href="/dashboard" className="back">← All __RECORDS__</a>
          <h1 className="hero-title d-title">{rec.title ?? 'Untitled'}</h1>
          <div className="d-meta">
            <span className={`pill t tone-${status?.tone ?? 'muted'}`} data-testid="record-status">{status?.label ?? rec.status}</span>
            <span className="muted">{when}</span>
            {rec.subtitle ? <span className="tag-soft">{rec.subtitle}</span> : null}
          </div>
        </section>

        <div className="d-grid">
          <div className="d-side">
            {files.length ? (
              <div className="card pad">
                <h2 className="card-h">{D.filesLabel}</h2>
                <div className="gallery">
                  {files.map((f) => (
                    <figure key={f.idx}>
                      <a href={download(f.object_key, `${id}-${f.idx}`)} aria-label={`Download file ${f.idx + 1}`}><img src={file(f.object_key)} alt={f.caption ?? `File ${f.idx + 1}`} loading="lazy" /></a>
                      <figcaption>{f.caption ?? `File ${f.idx + 1}`}</figcaption>
                    </figure>
                  ))}
                </div>
              </div>
            ) : null}

            {items.length ? (
              <div className="card pad">
                <h2 className="card-h">{D.itemsLabel}</h2>
                <div className="table-scroll">
                  <table>
                    <thead><tr><th>Item</th><th>Status</th><th className="num">Value</th><th>Note</th></tr></thead>
                    <tbody>
                      {items.map((i) => {
                        const st = D.statuses.find((s) => s.id === i.status);
                        return (
                          <tr key={i.id}>
                            <td className="strong">{i.label}</td>
                            <td>{i.status ? <span className={`pill t tone-${st?.tone ?? 'muted'}`}>{st?.label ?? i.status}</span> : <span className="muted">-</span>}</td>
                            <td className="num">{i.value ?? ''}</td>
                            <td className="muted">{i.note ?? ''}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
          </div>

          <aside className="d-side">
            <div className="card pad">
              <h2 className="card-h">Details</h2>
              <dl className="facts">
                {facts.map(([k, v]) => (<Fragment key={k}><dt>{k}</dt><dd>{v}</dd></Fragment>))}
              </dl>
            </div>
            <div className="card pad">
              <h2 className="card-h">Status</h2>
              <StatusActions id={rec.id} current={rec.status} statuses={D.statuses} />
            </div>
          </aside>
        </div>
      </main>
    </>
  );
}
