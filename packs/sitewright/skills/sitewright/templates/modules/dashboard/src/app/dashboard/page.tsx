import { query, migrate } from '@/lib/db';
import { SiteHeader } from '@/components/SiteHeader';
import { Stat } from '@/components/Stat';
import { Figure } from '@/components/fx';
import { RecordBrowser, type RecordCard } from '@/components/RecordBrowser';
import site from '@/content/site.json';

export const dynamic = 'force-dynamic';

interface Row {
  id: string;
  title: string | null;
  subtitle: string | null;
  status: string;
  category: string | null;
  owner: string | null;
  source: string | null;
  occurred_at: string;
  metrics: Record<string, number>;
  thumb_key: string | null;
  items: string;
  files: string;
}

interface StatDef { label: string; kind: 'count' | 'sum' | 'distinct' | 'status'; metric?: string; field?: string; status?: string; tone?: string; prefix?: string; suffix?: string; hint?: string; icon?: string }
interface StatusDef { id: string; label: string; tone: string; icon?: string }

const D = site.dashboard as unknown as {
  eyebrow: string; title: string; sub: string; empty: string; search: string;
  statuses: StatusDef[]; labels: Record<string, string>; facets: string[];
  metrics: { key: string; label: string; unit?: string }[]; stats: StatDef[];
};

const file = (key: string) => `/api/file?key=${encodeURIComponent(key)}`;

function stat(cards: RecordCard[], s: StatDef): number {
  switch (s.kind) {
    case 'sum': return cards.reduce((a, c) => a + (Number(c.metrics[s.metric ?? '']) || 0), 0);
    case 'distinct': {
      const f = (s.field ?? 'title') as 'title' | 'subtitle' | 'category' | 'owner' | 'source';
      return new Set(cards.map((c) => c[f]).filter(Boolean)).size;
    }
    case 'status': return cards.filter((c) => c.status === s.status).length;
    default: return cards.length;
  }
}

export default async function Dashboard() {
  let rows: Row[] = [];
  let error: string | null = null;

  try {
    await migrate();
    rows = await query<Row>(`
      SELECT r.id, r.title, r.subtitle, r.status, r.category, r.owner, r.source, r.occurred_at, r.metrics, r.thumb_key,
             (SELECT COUNT(*) FROM record_items i WHERE i.record_id = r.id) AS items,
             (SELECT COUNT(*) FROM record_files f WHERE f.record_id = r.id) AS files
      FROM records r
      ORDER BY r.occurred_at DESC
      LIMIT 300
    `);
  } catch (e) {
    error = String((e as Error).message ?? e);
  }

  const byStatus = new Map(D.statuses.map((s) => [s.id, s]));
  const cards: RecordCard[] = rows.map((r) => ({
    id: r.id,
    title: r.title,
    subtitle: r.subtitle,
    status: r.status,
    statusLabel: byStatus.get(r.status)?.label ?? r.status,
    statusTone: byStatus.get(r.status)?.tone ?? 'muted',
    statusIcon: byStatus.get(r.status)?.icon,
    category: r.category,
    owner: r.owner,
    source: r.source,
    startedAt: new Date(r.occurred_at).toISOString(),
    when: new Date(r.occurred_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }),
    metrics: r.metrics ?? {},
    items: Number(r.items),
    files: Number(r.files),
    thumbUrl: r.thumb_key ? file(r.thumb_key) : null,
  }));

  return (
    <>
      <SiteHeader active="dashboard" />
      <main className="wrap">
        <section className="hero">
          <p className="eyebrow">{D.eyebrow}</p>
          <h1 className="hero-title">{D.title}</h1>
          <p className="hero-sub">{D.sub}</p>
        </section>

        {error ? (
          <div className="card empty" role="alert">
            <p className="warn-t">The database is not reachable.</p>
            <p className="mono small">{error}</p>
          </div>
        ) : cards.length === 0 ? (
          <div className="card empty">
            <Figure place="empty" />
            <p className="strong">{D.empty}</p>
            {/*#if connect*/}
            <p>See <a className="link" href="/connect">__NAV_CONNECT__</a> for the link that lets a client send them.</p>
            {/*#endif*/}
          </div>
        ) : (
          <>
            <div className="stat-grid">
              {D.stats.map((s) => (
                <Stat key={s.label} n={stat(cards, s)} label={s.label} tone={s.tone as never} suffix={s.suffix} prefix={s.prefix} hint={s.hint} icon={s.icon} />
              ))}
            </div>
            <RecordBrowser
              records={cards}
              statuses={D.statuses}
              facets={D.facets.map((k) => [k, D.labels[k] ?? k] as [string, string])}
              metrics={D.metrics}
              searchPlaceholder={D.search}
            />
          </>
        )}
      </main>
    </>
  );
}
