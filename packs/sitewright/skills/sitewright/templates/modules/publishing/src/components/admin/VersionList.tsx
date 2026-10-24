'use client';

import { NotesEditor } from './NotesEditor';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export interface VersionItem {
  versionCode: number;
  versionName: string;
  releaseName: string;
  notes: string;
  fileName: string;
  sizeMb: string;
  when: string;
  by: string;
  minSdk: number | null;
  model: string | null;
  hidden: boolean;
  latest: boolean;
  channel: 'stable' | 'testing';
  onLanding: boolean;
  kind: 'new' | 'improved' | 'fixed' | null;
}

/** Android's version name for an API level, for "needs Android 8.0". */
const ANDROID: Record<number, string> = { 24: '7.0', 25: '7.1', 26: '8.0', 27: '8.1', 28: '9', 29: '10', 30: '11', 31: '12', 32: '12L', 33: '13', 34: '14', 35: '15' };

export function VersionList({ versions }: { versions: VersionItem[] }) {
  return (
    <div className="card pad">
      <div className="card-top">
        <h2 className="card-h">Versions</h2>
        <span className="mono muted">{versions.length} in storage</span>
      </div>
      {versions.length === 0 ? <p className="muted">Nothing published yet. Phones keep the version they have.</p> : null}
      {versions.map((v) => <Version key={v.versionCode} v={v} />)}
    </div>
  );
}

function Version({ v }: { v: VersionItem }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(v.releaseName);
  const [notes, setNotes] = useState(v.notes);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async (method: 'PATCH' | 'DELETE', body?: object) => {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/releases/${v.versionCode}`, {
      method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined,
    });
    setBusy(false);
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error ?? `Failed (${res.status})`);
      return false;
    }
    router.refresh();
    return true;
  };

  const title = v.releaseName || `__BRAND__ ${v.versionName}`;
  return (
    <div className={`version${v.hidden ? ' is-hidden' : ''}`}>
      <div className="version-head">
        <div>
          <div className="version-title">
            {title}
            {v.latest ? <span className="badge latest">Latest</span> : null}
            {v.channel === 'testing' ? <span className="badge testing">Testing</span> : null}
            {v.onLanding && !v.hidden ? <span className="badge public">On the home page</span> : null}
            {v.hidden ? <span className="badge hidden">Hidden</span> : null}
          </div>
          <div className="mono muted">
            Version {v.versionName} · build {v.versionCode} · {v.when} · {v.sizeMb} MB · {v.by}
            {v.minSdk ? ` · Android ${ANDROID[v.minSdk] ?? v.minSdk}+` : ''}
            {v.model ? ` · ${v.model}` : ''}
          </div>
          <div className="mono muted">{v.fileName}</div>
        </div>
        <div className="version-actions">
          <a className="btn ghost" href={`/api/admin/releases/${v.versionCode}`} download={v.fileName}>Download</a>
          <button className="btn ghost" type="button" disabled={busy} onClick={() => setEditing(!editing)}>{editing ? 'Close' : 'Edit notes'}</button>
          <button className="btn ghost" type="button" disabled={busy} onClick={() => send('PATCH', { hidden: !v.hidden })}>{v.hidden ? 'Show' : 'Hide'}</button>
          <button className="btn ghost danger" type="button" disabled={busy}
            onClick={() => { if (confirm(`Delete ${v.versionName} and its file? Anyone who already has it keeps it.`)) void send('DELETE'); }}>
            Delete
          </button>
        </div>
      </div>
      {/* Who this version is for - saved as soon as it changes. */}
      <div className="audience" aria-label={`Who ${v.versionName} is for`}>
        <div className="seg" role="group" aria-label="Channel">
          {(['stable', 'testing'] as const).map((c) => (
            <button key={c} type="button" className={`seg-b${v.channel === c ? ' on' : ''}`} disabled={busy || v.channel === c}
              onClick={() => send('PATCH', { channel: c })}>
              {c === 'stable' ? 'Everyone' : 'Testers only'}
            </button>
          ))}
        </div>
        <label className="switch" title="Show this version on the public home page, where anyone can download it">
          <input type="checkbox" checked={v.onLanding} disabled={busy} onChange={(e) => send('PATCH', { onLanding: e.target.checked })} />
          <span className="track"><span className="thumb" /></span>
          On the home page
        </label>
        <label className="kind">
          <span className="muted small">Kind of change</span>
          <select value={v.kind ?? ''} disabled={busy}
            onChange={(e) => send('PATCH', { kind: e.target.value === '' ? null : e.target.value })}>
            <option value="">Not set</option>
            <option value="new">New</option>
            <option value="improved">Improved</option>
            <option value="fixed">Fixed</option>
          </select>
        </label>
      </div>
      {!editing && v.notes ? <p className="version-notes">{v.notes}</p> : null}
      {editing ? (
        <div className="version-edit">
          <div className="pub-form">
            <label><span>Release name</span><input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder={`__BRAND__ ${v.versionName}`} /></label>
            <div className="ne-field"><span>Notes</span><NotesEditor value={notes} onChange={setNotes} placeholder="What changed - a sentence, or a short list" /></div>
            <button className="btn primary" type="button" disabled={busy}
              onClick={async () => { if (await send('PATCH', { releaseName: name, notes })) setEditing(false); }}>Save</button>
          </div>
          <div className="phone-preview">
            <p className="eyebrow muted">Preview · as a client sees it</p>
            <div className="pp-card">
              <p className="pp-title">APP UPDATE</p>
              <p className="pp-status">__BRAND__ (current version)</p>
              <p className="pp-detail">
                Update available: {v.versionName} · {v.sizeMb} MB{v.model ? ` · ${v.model}` : ''}
                {name ? <><br />{name}</> : null}
                {notes ? <><br /><span className="pp-notes">{notes}</span></> : null}
              </p>
              <p className="pp-action">Download and install</p>
            </div>
          </div>
        </div>
      ) : null}
      {error ? <p className="err">{error}</p> : null}
    </div>
  );
}
