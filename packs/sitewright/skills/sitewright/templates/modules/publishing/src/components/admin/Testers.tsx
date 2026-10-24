'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export interface TesterItem {
  id: number;
  name: string;
  email: string;
  added: string;
  by: string;
  lastSeen: string | null;
  off: boolean;
  locked: boolean;
}

/**
 * Who may see testing builds. Adding someone shows their code once; they turn on Tester mode in
 * the client with their email and that code, and from then on the update check offers them the
 * newest testing build next to the stable one. Turning someone off, or giving them a new code, ends
 * tester mode at the next update check.
 */
export function Testers({ testers }: { testers: TesterItem[] }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [shown, setShown] = useState<{ who: string; code: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const call = async (url: string, init: RequestInit) => {
    setBusy(true);
    setError(null);
    const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...init });
    setBusy(false);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) { setError(body.error ?? `Failed (${res.status})`); return null; }
    return body;
  };

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = await call('/api/admin/testers', { method: 'POST', body: JSON.stringify({ name, email }) });
    if (!body) return;
    setShown({ who: `${name} (${email.trim().toLowerCase()})`, code: body.code });
    setCopied(false);
    setName(''); setEmail('');
    router.refresh();
  };

  const act = async (t: TesterItem, action: 'revoke' | 'restore' | 'new-code') => {
    if (action === 'new-code' && !confirm(`Give ${t.name} a new code? Their old code stops working and they leave tester mode until they enter the new one.`)) return;
    const body = await call(`/api/admin/testers/${t.id}`, { method: 'PATCH', body: JSON.stringify({ action }) });
    if (!body) return;
    if (action === 'new-code') { setShown({ who: `${t.name} (${t.email})`, code: body.code }); setCopied(false); }
    router.refresh();
  };

  const remove = async (t: TesterItem) => {
    if (!confirm(`Remove ${t.name} as a tester?`)) return;
    if (await call(`/api/admin/testers/${t.id}`, { method: 'DELETE' })) router.refresh();
  };

  return (
    <div className="card pad" id="testers">
      <div className="card-top">
        <h2 className="card-h">Testers</h2>
        <span className="badge testing">{testers.filter((t) => !t.off).length} on</span>
      </div>
      <p className="muted small">
        Testers see versions marked <b>Testers only</b> as well as the ones for everyone. They enter their email
        and the code shown here once in the client; its update check then offers both versions and they choose.
        Only versions newer than the one installed are offered.
      </p>

      <form className="tester-add" onSubmit={add}>
        <label>Name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Anna Kowalska" autoComplete="off" required maxLength={80} /></label>
        <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="anna@example.com" autoComplete="off" required maxLength={254} /></label>
        <button className="btn primary" type="submit" disabled={busy || !name.trim() || !email.trim()}>Add tester</button>
      </form>

      {shown ? (
        <div className="invite">
          <p className="muted small">Tester code for <b>{shown.who}</b>. It is shown once - send it to them privately.</p>
          <p className="mono linkline code-big">{shown.code}</p>
          <div className="row-gap">
            <button className="btn" type="button" onClick={async () => { await navigator.clipboard.writeText(shown.code); setCopied(true); }}>{copied ? 'Copied' : 'Copy code'}</button>
            <button className="btn ghost" type="button" onClick={() => setShown(null)}>Done</button>
          </div>
        </div>
      ) : null}

      {testers.length === 0 ? <p className="muted small tester-empty">No testers yet.</p> : null}
      {testers.map((t) => (
        <div className={`person${t.off ? ' is-off' : ''}`} key={t.id}>
          <div>
            <div className="person-name">
              {t.name} <span className="muted">{t.email}</span>
              {t.off ? <span className="badge hidden">Off</span> : null}
              {t.locked ? <span className="badge warn-b">Locked 15 min</span> : null}
            </div>
            <div className="mono muted">Added {t.added} by {t.by}{t.lastSeen ? ` · last check ${t.lastSeen}` : ' · not used yet'}</div>
          </div>
          <div className="version-actions">
            <button className="btn ghost" type="button" disabled={busy} onClick={() => act(t, 'new-code')}>New code</button>
            <button className="btn ghost" type="button" disabled={busy} onClick={() => act(t, t.off ? 'restore' : 'revoke')}>{t.off ? 'Turn on' : 'Turn off'}</button>
            <button className="btn ghost danger" type="button" disabled={busy} onClick={() => remove(t)}>Remove</button>
          </div>
        </div>
      ))}
      {error ? <p className="err">{error}</p> : null}
    </div>
  );
}
