'use client';
import { useId, useRef, useState } from 'react';
import type { ChangeEvent, DragEvent, KeyboardEvent } from 'react';

export interface InputCommand { id: string; label: string; hint?: string }
export interface InputSubmit { text: string; files: File[]; command: string | null }
export interface AiInputProps {
  commands?: InputCommand[];
  placeholder?: string;
  onSubmit?: (payload: InputSubmit) => void;
  maxFiles?: number;
  className?: string;
}

const DEFAULT_COMMANDS: InputCommand[] = [
  { id: 'summarize', label: '/summarize', hint: 'Short summary' },
  { id: 'translate', label: '/translate', hint: 'Into another language' },
  { id: 'rewrite', label: '/rewrite', hint: 'Clearer wording' },
];
interface Item { key: number; file: File }

export default function AiInput({ commands = DEFAULT_COMMANDS, placeholder = 'Message, or type /', onSubmit, maxFiles = 5, className = '' }: AiInputProps) {
  const uid = useId();
  const listId = `${uid}-list`;
  const [text, setText] = useState('');
  const [items, setItems] = useState<Item[]>([]);
  const [command, setCommand] = useState<InputCommand | null>(null);
  const [active, setActive] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const [over, setOver] = useState(false);
  const [status, setStatus] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const seq = useRef(0);

  const m = /^\/(\S*)$/.exec(text);
  const matches = m ? commands.filter((c) => c.label.slice(1).toLowerCase().startsWith((m[1] ?? '').toLowerCase())) : [];
  const open = !!m && !dismissed && matches.length > 0;
  const act = Math.min(active, Math.max(0, matches.length - 1));

  const addFiles = (list: FileList | File[] | null) => {
    if (!list) return;
    const add = Array.from(list).map((file) => ({ key: ++seq.current, file }));
    setItems((cur) => [...cur, ...add].slice(0, maxFiles));
    setStatus(`${add.length} file${add.length === 1 ? '' : 's'} attached`);
  };
  const choose = (c: InputCommand) => { setCommand(c); setText(''); setDismissed(false); setActive(0); inputRef.current?.focus(); };
  const canSend = text.trim() !== '' || items.length > 0 || command !== null;
  const send = () => {
    if (!canSend) return;
    onSubmit?.({ text: text.trim(), files: items.map((i) => i.file), command: command ? command.label : null });
    setText(''); setItems([]); setCommand(null); setStatus('Sent');
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (open) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setActive((act + 1) % matches.length); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setActive((act - 1 + matches.length) % matches.length); return; }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); const c = matches[act]; if (c) choose(c); return; }
      if (e.key === 'Escape') { e.preventDefault(); setDismissed(true); return; }
    }
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); send(); }
    else if (e.key === 'Backspace' && text === '' && command) setCommand(null);
  };
  const onChange = (e: ChangeEvent<HTMLInputElement>) => { setText(e.target.value); setDismissed(false); setActive(0); };
  const onDrop = (e: DragEvent) => { e.preventDefault(); setOver(false); addFiles(e.dataTransfer.files); };

  return (
    <div className={`ui-ai-input ${className}`.trim()} data-over={over || undefined}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={onDrop}>
      <div className="ui-ai-input-box">
        {(command || items.length > 0) && (
          <ul className="ui-ai-input-chips" aria-label="Attachments and command">
            {command && (
              <li className="ui-ai-input-chip" data-kind="command">
                <span>{command.label}</span>
                <button type="button" aria-label={`Remove command ${command.label}`} onClick={() => { setCommand(null); inputRef.current?.focus(); }}>×</button>
              </li>
            )}
            {items.map((it) => (
              <li className="ui-ai-input-chip" key={it.key}>
                <span title={it.file.name}>{it.file.name}</span>
                <button type="button" aria-label={`Remove ${it.file.name}`} onClick={() => { setItems((c) => c.filter((x) => x.key !== it.key)); inputRef.current?.focus(); }}>×</button>
              </li>
            ))}
          </ul>
        )}
        <div className="ui-ai-input-row">
          <button type="button" className="ui-ai-input-icon" aria-label="Attach files" onClick={() => fileRef.current?.click()}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 11.5 12.5 20a5.5 5.5 0 0 1-7.8-7.8l8.5-8.5a3.7 3.7 0 0 1 5.2 5.2l-8.5 8.5a1.8 1.8 0 0 1-2.6-2.6L15 7" /></svg>
          </button>
          <input ref={fileRef} type="file" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
          <input ref={inputRef} className="ui-ai-input-field" type="text" value={text} placeholder={placeholder} aria-label="Message"
            role="combobox" aria-expanded={open} aria-controls={listId} aria-autocomplete="list" aria-haspopup="listbox"
            aria-activedescendant={open ? `${uid}-opt-${act}` : undefined} autoComplete="off"
            onChange={onChange} onKeyDown={onKey} onBlur={() => setDismissed(true)} onFocus={() => setDismissed(false)} />
          <button type="button" className="ui-ai-input-icon ui-ai-input-send" aria-label="Send" disabled={!canSend} onClick={send}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
          </button>
        </div>
        <ul id={listId} role="listbox" aria-label="Commands" className="ui-ai-input-menu" hidden={!open}>
          {matches.map((c, i) => (
            <li key={c.id} id={`${uid}-opt-${i}`} role="option" aria-selected={i === act} data-active={i === act || undefined}
              onMouseDown={(e) => e.preventDefault()} onMouseEnter={() => setActive(i)} onClick={() => choose(c)}>
              <strong>{c.label}</strong>{c.hint && <span>{c.hint}</span>}
            </li>
          ))}
        </ul>
      </div>
      <p className="ui-ai-input-hint">{over ? 'Drop to attach' : 'Type / for commands. Drop files to attach.'}</p>
      <span className="ui-ai-input-sr" role="status" aria-live="polite">{status}</span>
    </div>
  );
}

export function Demo() {
  const [last, setLast] = useState('');
  return (
    <div style={{ padding: 12 }}>
      <AiInput onSubmit={(p) => setLast(`Sent ${p.command ?? 'text'}${p.files.length ? ` + ${p.files.length} file` : ''}: "${p.text.slice(0, 18)}"`)} />
      {last && <p style={{ margin: '6px 2px 0', fontSize: 11, color: 'var(--muted, #555)' }}>{last}</p>}
    </div>
  );
}
