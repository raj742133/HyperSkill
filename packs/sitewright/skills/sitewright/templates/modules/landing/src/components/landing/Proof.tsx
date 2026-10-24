import site from '@/content/site.json';

interface ProofCfg {
  kicker: string; title: string; lead: string;
  /** The big figure drawn as flip tiles, like "89.39%". */
  figure: string;
  bigTitle: string; bigText: string;
  numbers?: { value: string; label: string }[];
  bars?: { label: string; value: number; them?: boolean }[];
  cards?: { icon?: string; title: string; text: string }[];
}

const P = site.landing.proof as unknown as ProofCfg;

const ICONS: Record<string, React.ReactNode> = {
  hex: <><path d="M12 3 20 7.5v9L12 21l-8-4.5v-9Z" /><circle cx="12" cy="12" r="2.6" /></>,
  phone: <><rect x="6" y="2.5" width="12" height="19" rx="2.5" /><path d="M10.5 18h3" /></>,
  check: <path d="M4 12.5 9 17.5 20 6.5" />,
  bolt: <path d="M13 2 4 14h7l-1 8 9-12h-7Z" />,
  shield: <path d="M12 3 4.5 6v5.5c0 4.6 3.2 8 7.5 9.5 4.3-1.5 7.5-4.9 7.5-9.5V6Z" />,
  chart: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  heart: <path d="M12 20s-7-4.4-7-10a4.2 4.2 0 0 1 7-3 4.2 4.2 0 0 1 7 3c0 5.6-7 10-7 10Z" />,
  leaf: <path d="M5 19C5 9 11 4 20 4c0 9-5 15-15 15Zm0 0 7-7" />,
};

/** The "why" block: a big figure that flips in, a headline card with numbers and comparison bars that grow, and small cards. */
export function Proof() {
  return (
    <>
      <div className="why-head rv">
        <div>
          <p className="lp-kicker">{P.kicker}</p>
          <h2 className="lp-h2">{P.title}</h2>
          <p className="lp-lead">{P.lead}</p>
        </div>
        <div className="flip-row" role="img" aria-label={P.figure}>
          {P.figure.split('').map((c, i) => (
            <span key={i} className={`flip${/[^0-9.,]/.test(c) ? ' sig' : ''}`} style={{ ['--d' as string]: `${i * 0.09}s` }}><span>{c}</span></span>
          ))}
        </div>
      </div>
      <div className="why-grid">
        <div className="why-big rv">
          <div>
            <h3>{P.bigTitle}</h3>
            <p>{P.bigText}</p>
          </div>
          {P.numbers?.length ? (
            <div className="why-nums">
              {P.numbers.map((n) => <div key={n.label}><b>{n.value}</b><span>{n.label}</span></div>)}
            </div>
          ) : null}
          {P.bars?.length ? (
            <div className="why-bench">
              {P.bars.map((b) => (
                <div key={b.label} className={`why-bar${b.them ? ' them' : ''}`}>
                  <span>{b.label}</span>
                  <span className="t"><i style={{ ['--w' as string]: `${b.value}%` }} /></span>
                  <b>{b.value}%</b>
                </div>
              ))}
            </div>
          ) : null}
        </div>
        {(P.cards ?? []).map((c) => (
          <div key={c.title} className="why-card rv">
            <svg viewBox="0 0 24 24" aria-hidden="true">{ICONS[c.icon ?? 'check'] ?? ICONS.check}</svg>
            <div><h4>{c.title}</h4><p>{c.text}</p></div>
          </div>
        ))}
      </div>
    </>
  );
}
