'use client';

import { useEffect, useState } from 'react';

export interface DownloadInfo {
  href: string;
  qr: string;
  meta: string;
}

/**
 * The QR card: scan it from a computer, or tap the button on the phone itself. When the team code is
 * switched on (LANDING_DOWNLOAD_CODE) and this browser has not entered it yet, the download asks first.
 */
export function DownloadCard({ info, locked, autoAsk = false, label = 'Download', action }: {
  info: DownloadInfo | null; locked: boolean; autoAsk?: boolean; label?: string; action?: { label: string; href: string };
}) {
  const [ask, setAsk] = useState(false);

  useEffect(() => {
    // The QR code leads a locked phone back here with ?unlock=1 - open the dialog for it.
    if (autoAsk && locked && new URLSearchParams(window.location.search).get('unlock') === '1') setAsk(true);
  }, [autoAsk, locked]);

  if (!info) {
    // Nothing to download (yet): one clear action instead.
    return action ? <a className="btn primary lp-action" href={action.href}>{action.label}</a> : null;
  }

  function go(e: React.MouseEvent) {
    if (!locked) return;
    e.preventDefault();
    setAsk(true);
  }

  return (
    <>
      <div className="dl-card">
        <div className="dl-qr">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={info.qr} alt="QR code that downloads __BRAND__" width={100} height={100} />
        </div>
        <div>
          <p className="dl-t computer">On a computer? Scan this with your __DEVICE__&apos;s camera to download.</p>
          <p className="dl-meta">{info.meta}</p>
          <a className="btn primary dl-phone" href={info.href} onClick={go}>{label}</a>
          <a className="dl-link dl-desk" href={info.href} onClick={go}>
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2v9M4 7.5 8 11.5l4-4M3 14h10" /></svg>
            Download to this computer
          </a>
        </div>
      </div>
      {ask ? <UnlockDialog href={info.href} onClose={() => setAsk(false)} /> : null}
    </>
  );
}

/** "How to install", under the hero's card - the few things a device asks the first time. */
export function HowToInstall({ steps }: { steps: string[] }) {
  return (
    <details className="dl-how">
      <summary>How to install</summary>
      <ol>
        {steps.map((s) => <li key={s}>{s}</li>)}
      </ol>
    </details>
  );
}

/** On a phone, a download bar slides up once the hero has scrolled away. */
export function DownloadBar({ href, label, meta, locked }: { href: string; label: string; meta: string; locked: boolean }) {
  const [on, setOn] = useState(false);
  const [ask, setAsk] = useState(false);
  useEffect(() => {
    const hero = document.getElementById('get');
    if (!hero) return;
    const io = new IntersectionObserver(([e]) => setOn(!e.isIntersecting), { rootMargin: '-40% 0px 0px 0px' });
    io.observe(hero);
    return () => io.disconnect();
  }, []);
  return (
    <>
      <div className={`dl-bar${on ? ' on' : ''}`} aria-hidden={!on}>
        <a href={href} tabIndex={on ? 0 : -1} onClick={(e) => { if (locked) { e.preventDefault(); setAsk(true); } }}>
          <span><b>Download __BRAND__ · {label}</b><small>{meta}</small></span>
          <i aria-hidden="true">↓</i>
        </a>
      </div>
      {ask ? <UnlockDialog href={href} onClose={() => setAsk(false)} /> : null}
    </>
  );
}

export function DownloadLink({ href, locked, children, className }: { href: string; locked: boolean; children: React.ReactNode; className?: string }) {
  const [ask, setAsk] = useState(false);
  return (
    <>
      <a className={className} href={href} onClick={(e) => { if (locked) { e.preventDefault(); setAsk(true); } }}>{children}</a>
      {ask ? <UnlockDialog href={href} onClose={() => setAsk(false)} /> : null}
    </>
  );
}

function UnlockDialog({ href, onClose }: { href: string; onClose: () => void }) {
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    const r = await fetch('/api/app/public/unlock', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }),
    }).catch(() => null);
    setBusy(false);
    if (r?.ok) { onClose(); window.location.href = href; return; }
    setErr(r?.status === 401 ? 'That code is not right. Ask your team for it.' : 'Could not check the code. Try again.');
  }

  return (
    <div className="dlg-back" onClick={onClose}>
      <form className="dlg" role="dialog" aria-modal="true" aria-labelledby="dlg-t" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h3 id="dlg-t">Enter your team code</h3>
        <p className="dlg-sub">__BRAND__ is private. Ask your team for the code.</p>
        <input autoFocus value={code} onChange={(e) => setCode(e.target.value)} placeholder="Team code" aria-label="Team code" autoComplete="off" spellCheck={false} />
        {err ? <p className="dlg-err" role="alert">{err}</p> : null}
        <button className="btn primary" type="submit" disabled={busy || !code.trim()}>{busy ? 'Checking…' : 'Unlock and download'}</button>
        <button type="button" className="later" onClick={onClose}>Not now</button>
      </form>
    </div>
  );
}
