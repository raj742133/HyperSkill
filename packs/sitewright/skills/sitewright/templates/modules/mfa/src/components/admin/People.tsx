'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export interface Person {
  username: string;
  name: string;
  added: string;
  by: string;
  lastSignIn: string | null;
  you: boolean;
}

export function People({ people }: { people: Person[] }) {
  const router = useRouter();
  const [invite, setInvite] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const addPerson = async () => {
    setBusy(true);
    setError(null);
    const res = await fetch('/api/admin/invites', { method: 'POST' });
    setBusy(false);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) { setError(body.error ?? `Failed (${res.status})`); return; }
    setInvite(body.url);
    setCopied(false);
    router.refresh();
  };

  const remove = async (p: Person) => {
    if (!confirm(`Remove ${p.name}? They are signed out at once.`)) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/people/${encodeURIComponent(p.username)}`, { method: 'DELETE' });
    setBusy(false);
    if (!res.ok) { setError((await res.json().catch(() => ({}))).error ?? `Failed (${res.status})`); return; }
    router.refresh();
  };

  return (
    <div className="card pad">
      <div className="card-top">
        <h2 className="card-h">People</h2>
        <button className="btn" type="button" disabled={busy} onClick={addPerson}>Add a person</button>
      </div>
      {invite ? (
        <div className="invite">
          <p className="muted small">Send this link to the person. It works once, for 48 hours; they choose a password and add an authenticator app.</p>
          <p className="mono linkline">{invite}</p>
          <button className="btn" type="button" onClick={async () => { await navigator.clipboard.writeText(invite); setCopied(true); }}>
            {copied ? 'Copied' : 'Copy link'}
          </button>
        </div>
      ) : null}
      {people.map((p) => (
        <div className="person" key={p.username}>
          <div>
            <div className="person-name">{p.name} <span className="muted">{p.you ? '(you)' : `@${p.username}`}</span></div>
            <div className="mono muted">
              Added {p.added} by {p.by}{p.lastSignIn ? ` · last sign-in ${p.lastSignIn}` : ' · never signed in'}
            </div>
          </div>
          <button className="btn ghost" type="button" disabled={busy} onClick={() => remove(p)}>Remove</button>
        </div>
      ))}
      <p className="muted small">Lost the device? Remove the person, then add them again with a new invite.</p>
      {error ? <p className="err">{error}</p> : null}
    </div>
  );
}
