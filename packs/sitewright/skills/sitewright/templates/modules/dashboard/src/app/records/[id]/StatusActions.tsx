'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/** One click to change a __RECORD__'s status, and a confirmed delete. Both go through /api/records/[id]. */
export function StatusActions({ id, current, statuses }: { id: string; current: string; statuses: { id: string; label: string; tone: string }[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function call(method: 'PATCH' | 'DELETE', body?: object) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/records/${id}`, {
      method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined,
    });
    setBusy(false);
    if (!res.ok) { setError((await res.json().catch(() => ({}))).error ?? `Failed (${res.status})`); return false; }
    return true;
  }

  return (
    <>
      <div className="status-actions" role="group" aria-label="Set status">
        {statuses.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`btn sm${s.id === current ? ' primary' : ''}`}
            disabled={busy || s.id === current}
            aria-pressed={s.id === current}
            onClick={async () => { if (await call('PATCH', { status: s.id })) router.refresh(); }}
          >
            {s.label}
          </button>
        ))}
      </div>
      <p style={{ marginTop: 14 }}>
        <button
          type="button"
          className="btn sm danger"
          disabled={busy}
          onClick={async () => {
            if (!confirm('Delete this __RECORD__ and its files? This cannot be undone.')) return;
            if (await call('DELETE')) router.push('/dashboard');
          }}
        >
          Delete __RECORD__
        </button>
      </p>
      {error ? <p className="err" role="alert">{error}</p> : null}
    </>
  );
}
