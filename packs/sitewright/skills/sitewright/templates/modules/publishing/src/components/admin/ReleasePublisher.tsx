'use client';

import { NotesEditor } from './NotesEditor';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

const EXTENSIONS: string[] = __EXTENSIONS_JSON__;

/**
 * Drop the file, name it, publish. The file streams to the site with a progress bar; the server checks what it can (file type,
 * a build number that is higher than every one published) and refuses what a client could not use.
 */
export function ReleasePublisher({ nextHint }: { nextHint: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [over, setOver] = useState(false);
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  //#if !parseApk
  const [versionName, setVersionName] = useState('');
  const [versionCode, setVersionCode] = useState('');
  //#endif
  const [progress, setProgress] = useState<number | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const pick = (f: File | undefined | null) => {
    if (!f) return;
    const ext = (f.name.match(/\.[A-Za-z0-9]+$/)?.[0] ?? '').toLowerCase();
    if (!EXTENSIONS.includes(ext)) {
      setMessage({ ok: false, text: `That is not a ${EXTENSIONS.join(' / ')} file.` });
      return;
    }
    setFile(f);
    setMessage(null);
  };

  const publish = () => {
    if (!file) return;
    setProgress(0);
    setMessage(null);
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/admin/releases');
    xhr.setRequestHeader('Content-Type', 'application/octet-stream');
    xhr.setRequestHeader('X-File-Name', encodeURIComponent(file.name));
    xhr.setRequestHeader('X-Release-Name', encodeURIComponent(name.trim()));
    xhr.setRequestHeader('X-Notes', encodeURIComponent(notes.trim()));
    //#if !parseApk
    xhr.setRequestHeader('X-Version-Name', encodeURIComponent(versionName.trim()));
    xhr.setRequestHeader('X-Version-Code', encodeURIComponent(versionCode.trim()));
    //#endif
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100)); };
    xhr.onload = () => {
      setProgress(null);
      let body: { error?: string; versionName?: string } = {};
      try { body = JSON.parse(xhr.responseText); } catch { /* keep {} */ }
      if (xhr.status >= 200 && xhr.status < 300) {
        setMessage({ ok: true, text: `Published ${body.versionName}.` });
        setFile(null);
        setName('');
        setNotes('');
        //#if !parseApk
        setVersionName('');
        setVersionCode('');
        //#endif
        router.refresh();
      } else {
        setMessage({ ok: false, text: body.error ?? `The upload failed (${xhr.status}).` });
      }
    };
    xhr.onerror = () => { setProgress(null); setMessage({ ok: false, text: 'The connection dropped. Try again.' }); };
    xhr.send(file);
  };

  const busy = progress !== null;
  return (
    <div className="card pad">
      <h2 className="card-h">Publish a new version</h2>
      <div
        className={`dropzone${over ? ' over' : ''}${file ? ' has' : ''}`}
        onClick={() => !busy && input.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); if (!busy) pick(e.dataTransfer.files[0]); }}
        role="button"
        tabIndex={0}
        aria-label="Choose a file to publish"
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') input.current?.click(); }}
      >
        <input ref={input} type="file" accept="__ACCEPT_ATTR__" hidden data-testid="release-file" onChange={(e) => pick(e.target.files?.[0])} />
        {file ? (
          <>
            <p className="dz-title">{file.name}</p>
            <p className="muted small">{(file.size / 1048576).toFixed(1)} MB · click to choose a different file</p>
          </>
        ) : (
          <>
            <p className="dz-title">Drop the __ARTIFACT__ file here, or choose one.</p>
            <p className="muted small">{EXTENSIONS.join(', ')}. It stays on your computer until you publish. {nextHint}</p>
          </>
        )}
      </div>
      {file ? (
        <div className="pub-form">
          {/*#if !parseApk*/}
          <div className="two-up">
            <label>
              <span>Version name</span>
              <input value={versionName} onChange={(e) => setVersionName(e.target.value)} placeholder="1.4.0" maxLength={40} disabled={busy} />
            </label>
            <label>
              <span>Build number</span>
              <input value={versionCode} onChange={(e) => setVersionCode(e.target.value)} placeholder="12" inputMode="numeric" disabled={busy} />
            </label>
          </div>
          {/*#endif*/}
          <label>
            <span>Release name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="What people see, like “Faster start”" maxLength={80} disabled={busy} />
          </label>
          <div className="ne-field">
            <span>Notes</span>
            <NotesEditor value={notes} onChange={setNotes} placeholder="What changed - a sentence, or a short list" disabled={busy} />
          </div>
          {busy ? (
            <div className="upbar"><i style={{ width: `${progress}%` }} /><span>Uploading… {progress}%</span></div>
          ) : (
            <button type="button" className="btn primary" onClick={publish}>Publish</button>
          )}
        </div>
      ) : null}
      {message ? <p className={message.ok ? 'ok-msg' : 'err'} role="status">{message.text}</p> : null}
    </div>
  );
}
