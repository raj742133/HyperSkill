'use client';

import { useEffect, useState } from 'react';
import site from '@/content/site.json';
import { Icon } from '@/components/icons/Icon';

interface Card { title: string; sub?: string; pill?: string; tone?: string }
interface Screen {
  kind: 'list' | 'grid' | 'result' | 'progress';
  title: string; sub?: string; cards?: Card[]; cta?: string; guide?: string; bar?: number;
  gates?: string[]; big?: { label: string; value: string };
}
interface Step { time: string; title: string; text: string; tags?: string[]; icon?: string; screen: Screen }

const S = site.landing.story as unknown as { kicker: string; title: string; lead: string; steps: Step[]; end: string };
const STEPS = S.steps;

/**
 * "A visit with __BRAND__": stops down the road that runs out of the hero's mark (Route.tsx draws it and says how many stops it
 * has reached); the phone on the right shows the screen for the stop you are at. Everything comes from landing.story in site.json.
 */
export function Story() {
  const [reached, setReached] = useState(0);

  useEffect(() => {
    const on = (e: Event) => setReached((e as CustomEvent<number>).detail);
    window.addEventListener('route:reached', on);
    return () => window.removeEventListener('route:reached', on);
  }, []);

  const on = Math.min(STEPS.length - 1, Math.max(0, reached - 1));
  return (
    <div className="st">
      <div className="road" data-route-lane aria-hidden="true" />

      <div className="st-head rv" data-route-start>
        <p className="lp-kicker">{S.kicker}</p>
        <h2 className="lp-h2">{S.title}</h2>
        <p className="lp-lead">{S.lead}</p>
      </div>

      <div className="st-grid">
        <ol className="st-steps">
          {STEPS.map((s, i) => (
            <li key={s.title} className="st-step">
              <div className="st-rule" data-route-stop>
                <span className="t"><Icon name={s.icon} className="st-ic" />{s.time}</span><span className="l" /><span className="n">{String(i + 1).padStart(2, '0')} / {String(STEPS.length).padStart(2, '0')}</span>
              </div>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
              {s.tags?.length ? <ul className="st-tags">{s.tags.map((t) => <li key={t} className="st-tag">{t}</li>)}</ul> : null}
            </li>
          ))}
        </ol>
        <div className="st-phone-col" aria-hidden="true">
          <div className="st-phone-stick"><Phone step={on} /></div>
        </div>
      </div>

      <div className="st-end">
        <div data-route-stop>
          <p>{S.end}</p>
        </div>
      </div>
    </div>
  );
}

// The "tins" of the grid screen are drawn in the brand's own palette, so the mock-up always matches the page it sits on.
const TIN_VARS = ['--primary', '--signal', '--corrected', '--primary', '--unsure', '--signal', '--ok', '--primary', '--corrected', '--signal', '--added', '--primary', '--signal', '--primary', '--corrected', '--ok'];

function Top({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="ps-top">
      <div className="ps-status"><span>9:41</span><span>__BRAND__</span></div>
      <div className="ps-title">{title}</div>
      {sub ? <div className="ps-subt">{sub}</div> : null}
    </div>
  );
}

function Hive({ boxes }: { boxes: boolean }) {
  return (
    <div className="ps-hive">
      {TIN_VARS.map((c, i) => <span key={i} className={`ps-tin${boxes ? ' box' : ''}${boxes && i === 6 ? ' red' : ''}`} style={{ background: `var(${c})` }} />)}
    </div>
  );
}

function CardRow({ c }: { c: Card }) {
  return (
    <div className="ps-card">
      <div><b>{c.title}</b>{c.sub ? <small>{c.sub}</small> : null}</div>
      {c.pill ? <span className={`ps-pill ${c.tone ?? ''}`}>{c.pill}</span> : null}
    </div>
  );
}

function ScreenBody({ s }: { s: Screen }) {
  switch (s.kind) {
    case 'grid':
      return (
        <div className="ps-body">
          <div className="ps-cam"><Hive boxes={false} /><div className="ps-scan" />{s.guide ? <div className="ps-guide">{s.guide}</div> : null}</div>
          {s.gates?.length ? <div className="ps-gates">{s.gates.map((g) => <span key={g} className="ps-gate">✓ {g}</span>)}</div> : null}
          {typeof s.bar === 'number' ? <div className="ps-bar"><i style={{ width: `${s.bar}%` }} /></div> : null}
        </div>
      );
    case 'result':
      return (
        <div className="ps-body">
          {s.big ? <div className="ps-card"><div><small>{s.big.label}</small><div className="ps-big">{s.big.value}</div></div><span className="ps-pill green">Done</span></div> : null}
          <div className="ps-cam" style={{ flex: 'none', height: 110 }}><Hive boxes /></div>
          {(s.cards ?? []).map((c) => <CardRow key={c.title} c={c} />)}
          {s.cta ? <div className="ps-cta sig">{s.cta}</div> : null}
        </div>
      );
    case 'progress':
      return (
        <div className="ps-body">
          {(s.cards ?? []).map((c) => <CardRow key={c.title} c={c} />)}
          {typeof s.bar === 'number' ? <div className="ps-bar"><i style={{ width: `${s.bar}%` }} /></div> : null}
          {s.cta ? <div className="ps-cta">{s.cta}</div> : null}
        </div>
      );
    default:
      return (
        <div className="ps-body">
          {(s.cards ?? []).map((c) => <CardRow key={c.title} c={c} />)}
          {s.cta ? <div className="ps-cta">{s.cta}</div> : null}
        </div>
      );
  }
}

function Phone({ step }: { step: number }) {
  return (
    <div className="phone">
      <div className="phone-screen">
        <div className="phone-notch" />
        {STEPS.map((st, i) => (
          <div key={st.title} className={`ps${step === i ? ' on' : ''}`}>
            <Top title={st.screen.title} sub={st.screen.sub} />
            <ScreenBody s={st.screen} />
          </div>
        ))}
      </div>
    </div>
  );
}
