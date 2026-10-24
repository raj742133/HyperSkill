import { headers } from 'next/headers';
import { CopyButton } from './CopyButton';
import { SiteHeader } from '@/components/SiteHeader';
import { Figure } from '@/components/fx';
import site from '@/content/site.json';
//#if publishing
import { migrate } from '@/lib/db';
import { latestRelease } from '@/lib/releases';
//#endif

export const dynamic = 'force-dynamic';

const C = site.connect;

/**
 * The one thing a person setting up a __DEVICE__ needs: a single line to paste into the client.
 *
 * The line is this site's own address with the upload key after `#key=`. The client splits the two apart, checks the address
 * against /api/health with the key, and starts sending - so nobody types a key, and nobody has to explain which of two values
 * goes in which box.
 *
 * Behind the sign-in like every private page: the key lets a client write here.
 */
export default async function Connect() {
  //#if publishing
  await migrate();
  const latest = await latestRelease();
  //#endif
  const h = await headers();
  const configured = process.env.PUBLIC_BASE_URL?.replace(/\/+$/, '');
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  const proto = h.get('x-forwarded-proto') ?? (/^(localhost|127\.)/.test(host) ? 'http' : 'https');
  // The address as the browser reached it is the one a __DEVICE__ can reach too; PUBLIC_BASE_URL wins when set, because behind a
  // proxy the Host header can be an internal name.
  const base = configured && !configured.includes('localhost') ? configured : `${proto}://${host}`;
  const token = process.env.INGEST_TOKEN ?? '';
  const link = token ? `${base}/#key=${encodeURIComponent(token)}` : '';
  const curl = `curl -X POST ${base}/api/ingest \\
  -H "Authorization: Bearer <the key after #key=>" \\
  -H "Content-Type: application/json" \\
  -d '{"id":"demo-0001","title":"First __RECORD__","status":"new"}'`;

  return (
    <>
      <SiteHeader active="connect" />
      <main className="wrap">
        <section className="hero">
          <Figure place="connect" />
          <h1 className="hero-title">{C.title}</h1>
          <p className="hero-sub">{C.sub}</p>
        </section>
        <div className="card pad">
          {link ? (
            <>
              <p className="strong">Link</p>
              <p className="muted">
                In the client open <b>{C.where}</b>, paste this line into the address box and save. It checks the address, then
                starts sending.
              </p>
              <p className="mono linkline" data-testid="connect-link">{link}</p>
              <CopyButton text={link} />
              <p className="muted small" style={{ marginTop: 18 }}>
                The part after <span className="mono">#key=</span> is the upload key (<span className="mono">INGEST_TOKEN</span>). Share
                the link only with people who set up {'__DEVICE__'}s. Changing <span className="mono">INGEST_TOKEN</span> stops every
                client sending until it is given the new link.
              </p>
            </>
          ) : (
            <div className="empty">
              <p className="warn-t">INGEST_TOKEN is not set.</p>
              <p>Set it where the site is hosted, restart, and this page shows the link.</p>
            </div>
          )}
        </div>

        {C.curl ? (
          <div className="card pad" style={{ marginTop: 18 }}>
            <p className="strong">Send a __RECORD__ from a script</p>
            <p className="muted small">Every call carries the key as a bearer token. See <span className="mono">src/lib/contract.ts</span> for all the fields.</p>
            <pre className="mono codeblock">{curl}</pre>
          </div>
        ) : null}

        {/*#if publishing*/}
        <div className="card pad" style={{ marginTop: 18 }}>
          <p className="strong">Get the __ARTIFACT__</p>
          {latest ? (
            <>
              <p className="muted">
                __BRAND__ {latest.version_name}{latest.release_name ? ` - ${latest.release_name}` : ''}, published{' '}
                {new Date(latest.published_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}.
              </p>
              <a className="btn primary" href="/api/app/download">Download __BRAND__ {latest.version_name} ({Math.max(1, Math.round(Number(latest.size_bytes) / 1048576))} MB)</a>
            </>
          ) : (
            <p className="muted">Nothing is published yet. Publish a version on the <a className="link" href="/admin">__AREA__</a> page.</p>
          )}
        </div>
        {/*#endif*/}
      </main>
    </>
  );
}
