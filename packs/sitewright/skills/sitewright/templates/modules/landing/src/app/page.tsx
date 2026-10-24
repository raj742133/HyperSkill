import { headers } from 'next/headers';
import QRCode from 'qrcode';
import site from '@/content/site.json';
//#if publishing
import { migrate } from '@/lib/db';
import { landingReleases, type AppReleaseRow } from '@/lib/releases';
import { isUnlocked } from '@/lib/landing-gate';
import { Releases, type ReleaseCard } from '@/components/landing/Releases';
//#endif
import { LogoMark } from '@/components/brand/Logo';
import { LandingHeader } from '@/components/landing/LandingHeader';
import { RevealOnScroll } from '@/components/landing/Reveal';
import { Story } from '@/components/landing/Story';
import { DownloadBar, DownloadCard, HowToInstall, type DownloadInfo } from '@/components/landing/Download';
import { Figure, HeroBackground, Headline } from '@/components/fx';
import { SmoothScroll } from '@/components/landing/SmoothScroll';
import { Route } from '@/components/landing/Route';
//#if proof
import { Proof } from '@/components/landing/Proof';
//#endif
//#if features
import { Features } from '@/components/landing/Features';
//#endif
//#if compat
import { Timeline } from '@/components/landing/Timeline';
//#endif
import '@/components/landing/landing.css';

export const dynamic = 'force-dynamic';

/**
 * The public home page: what __BRAND__ is, a download (or one clear action), the story as a road with a phone beside it,
 * and - when the matching sections are in site.json - proof, features, compatibility, a call to action, releases and FAQ.
 * Anyone can open it; the private pages stay behind sign-in.
 */
const L = site.landing;

//#if publishing
const mb = (r: AppReleaseRow) => `${Math.round(Number(r.size_bytes) / 1048576) || 1} MB`;
const day = (d: string | Date) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
//#endif

/** "Every cup, {accent} to order." -> the words around the accent, so <Headline> can draw the accent in the brand colour (and animate it, if an effect is chosen). */
function headlineParts() {
  const [before, after] = L.headline.split('{accent}');
  return after === undefined ? { before: L.headline } : { before: before ?? '', accent: L.accent, after };
}

export default async function Home() {
  // `as` keeps TypeScript from narrowing this to `null` on sites without the publishing module (it is never assigned there).
  let info = null as DownloadInfo | null;
  let locked = false;
  let latestName: string | null = null;
  let latestMeta: string | null = null;
  let newBadge: string | null = L.badge?.text ?? null;
  //#if publishing
  await migrate();
  const list = await landingReleases();
  locked = !(await isUnlocked());
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  const proto = h.get('x-forwarded-proto') ?? (/^(localhost|127\.)/.test(host) ? 'http' : 'https');
  const base = `${proto}://${host}`;
  const href = (code: number) => `/api/app/public/download?v=${code}`;
  const latest = list[0] ?? null;
  if (latest) {
    info = {
      href: href(latest.version_code),
      qr: await QRCode.toDataURL(`${base}${href(latest.version_code)}`, { margin: 1, width: 240, color: { dark: '#0b1116', light: '#ffffff' } }),
      meta: `v${latest.version_name} · ${mb(latest)} · ${day(latest.published_at)}`,
    };
    latestName = `v${latest.version_name}`;
    latestMeta = `${mb(latest)}`;
    newBadge = `${latest.release_name || `Version ${latest.version_name}`} · See what changed →`;
  }
  const cards: ReleaseCard[] = list.map((r) => ({
    code: r.version_code,
    title: r.release_name || `Version ${r.version_name}`,
    notes: r.notes,
    meta: `v${r.version_name} · ${day(r.published_at)}`,
    mb: mb(r),
    kind: r.kind,
    href: href(r.version_code),
  }));
  //#endif

  const nav = [
    ...(L.story ? [['Story', '#story']] : []),
    //#if proof
    ...(L.proof ? [[L.navLabels?.proof ?? 'Why __BRAND__', '#proof']] : []),
    //#endif
    //#if publishing
    ...[[L.navLabels?.releases ?? "What's new", '#releases']],
    //#endif
    //#if faq
    ...[[L.navLabels?.help ?? 'Help', '#help']],
    //#endif
  ] as [string, string][];

  return (
    <div className="lp" id="top">
      <SmoothScroll />
      <LandingHeader nav={nav} action={{ label: info ? 'Download' : L.primaryAction.label, href: info ? '#get' : L.primaryAction.href }} />
      <RevealOnScroll />

      <main>
        {/* The hero and the story share one road. In the classic theme it starts as the hero's mark (Route.tsx); in the studio theme the hero shows the brand's own logo shape and the road starts at the story. */}
        <div className="route-host">
          <Route />
          <section className="lp-hero" id="get">
            <HeroBackground />
            <div className="lp-wrap lp-hero-grid">
              <div>
                {newBadge ? (
                  <a href={info ? '#releases' : '#story'} className="lp-badge"><b>{L.badge?.tag ?? 'New'}</b>{newBadge}</a>
                ) : null}
                <h1 className="lp-h1">
                  <Headline {...headlineParts()} />
                </h1>
                <p className="lp-sub">{L.sub}</p>
                <DownloadCard info={info} locked={locked} autoAsk label={L.downloadLabel} action={L.primaryAction} />
                {info ? <HowToInstall steps={L.howToInstall} /> : null}
              </div>
              <div className="lp-art">
                <Figure place="hero" />
                {/*#if studio*/}
                <div className="lp-mark-static" data-hero-mark aria-hidden="true"><LogoMark size={240} animated /></div>
                {/*#else*/}
                <div className="lp-mark-box" data-route-logo aria-hidden="true" />
                {/*#endif*/}
              </div>
            </div>
          </section>

          <section className="lp-section" id="story">
            <div className="lp-wrap">
              <Story />
            </div>
          </section>
        </div>

        {/*#if proof*/}
        <section className="lp-section" id="proof">
          <div className="lp-wrap"><Proof /></div>
        </section>
        {/*#endif*/}

        {/*#if features*/}
        <section className="lp-section" id="features">
          <div className="lp-wrap"><Features /></div>
        </section>
        {/*#endif*/}

        {/*#if compat*/}
        <section className="lp-section" id="compat">
          <div className="lp-wrap"><Timeline /></div>
        </section>
        {/*#endif*/}

        <section className="lp-section">
          <div className="lp-wrap">
            <div className="cta rv">
              <LogoMark size={72} />
              <h2>{L.cta.title}</h2>
              <p className="lp-lead">{L.cta.text}</p>
              <DownloadCard info={info} locked={locked} label={L.downloadLabel} action={L.primaryAction} />
            </div>
          </div>
        </section>

        {/*#if publishing*/}
        <section className="lp-section" id="releases">
          <div className="lp-wrap"><Releases list={cards} locked={locked} title={L.releasesTitle} /></div>
        </section>
        {/*#endif*/}

        {/*#if faq*/}
        <section className="lp-section" id="help">
          <div className="lp-wrap side">
            <div className="side-head rv">
              <p className="lp-kicker">{L.navLabels?.help ?? 'Help'}</p>
              <h2 className="lp-h2">{L.faqTitle ?? 'Questions people ask'}</h2>
              <p className="lp-lead">{L.faqLead ?? 'Something else? Just ask.'}</p>
            </div>
            <div className="faq rv">
              {(L.faq as [string, string][]).map(([q, a]) => (
                <details key={q}><summary>{q}</summary><p>{a}</p></details>
              ))}
            </div>
          </div>
        </section>
        {/*#endif*/}
      </main>

      <footer className="lp-foot">
        <div className="lp-wrap lp-foot-in">
          <div>
            <span className="brand"><span className="brand-mark"><LogoMark /></span><span className="brand-t">__BRAND__</span></span>
            <p>{site.brand.tagline}</p>
            <small>{site.brand.footerNote}{latestName ? <> · Latest: <b>{latestName}</b></> : null}</small>
          </div>
          <a href="#top" className="btn">Back to top ↑</a>
        </div>
      </footer>
      {info ? <DownloadBar href={info.href} locked={locked} label={latestName ?? ''} meta={latestMeta ?? ''} /> : null}
    </div>
  );
}
