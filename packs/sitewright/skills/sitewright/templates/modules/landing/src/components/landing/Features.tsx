import site from '@/content/site.json';
import { Icon } from '@/components/icons/Icon';

interface FeaturesCfg {
  kicker: string; title: string;
  readyTitle?: string; nextTitle?: string; countLabel?: string;
  /** [name, description, icon] - the icon is optional */
  ready: [string, string, string?][];
  /** [name, description, beingBuiltNow, icon] */
  next?: [string, string, boolean?, string?][];
}

const F = site.landing.features as unknown as FeaturesCfg;

/** The features board: how much is ready, a row of dots that fill in, and two columns - ready now, and on the way. */
export function Features() {
  const ready = F.ready;
  const next = F.next ?? [];
  const total = ready.length + next.length;
  return (
    <>
      <div className="mod-head rv">
        <div>
          <p className="lp-kicker">{F.kicker}</p>
          <h2 className="lp-h2">{F.title}</h2>
        </div>
        <div>
          <div className="mod-count">{ready.length} <span>of {total} {F.countLabel ?? 'ready'}</span></div>
          <div className="mod-dots" aria-hidden="true">
            {Array.from({ length: total }, (_, i) => <i key={i} style={{ ['--i' as string]: i }} className={i < ready.length ? 'r' : i === ready.length && next[0]?.[2] ? 'b' : ''} />)}
          </div>
          <div className="mod-key"><span>● Ready</span><span>◐ Being built</span><span>○ Planned</span></div>
        </div>
      </div>
      <div className="mod-grid">
        <div className="mod-col rv">
          <h3>{F.readyTitle ?? 'Ready now'} <span>{ready.length}</span></h3>
          {ready.map(([t, d, ic]) => (
            <div key={t} className="mod-item"><span className={`mod-ic${ic ? ' has' : ''}`}><Icon name={ic} /></span><div><b>{t}</b><small>{d}</small></div></div>
          ))}
        </div>
        {next.length ? (
          <div className="mod-col next rv">
            <h3>{F.nextTitle ?? 'On the way'} <span>{next.length}</span></h3>
            {next.map(([t, d, now, ic]) => (
              <div key={t} className={`mod-item${now ? ' now' : ''}`}><span className={`mod-ic${ic ? ' has' : ''}`}><Icon name={ic} /></span><div><b>{t}{now ? <span className="mod-now">Being built</span> : null}</b><small>{d}</small></div></div>
            ))}
          </div>
        ) : null}
      </div>
    </>
  );
}
