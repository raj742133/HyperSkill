'use client';
import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useCoarsePointer, useReducedMotion } from './_k1';

export interface MagneticDropZoneProps {
  /** Same syntax as <input accept>, e.g. "image/*,.pdf". */
  accept?: string;
  multiple?: boolean;
  /** Called with the accepted files. Nothing is uploaded. */
  onFiles?: (files: File[]) => void;
  label?: string;
  /** How far (px) the zone may lean toward the cursor. */
  pull?: number;
  /** Distance (px) from the zone at which it starts to notice a drag. */
  reach?: number;
}

function matches(file: File, accept?: string) {
  if (!accept) return true;
  const name = file.name.toLowerCase();
  return accept.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean).some((a) =>
    a.startsWith('.') ? name.endsWith(a) : a.endsWith('/*') ? file.type.toLowerCase().startsWith(a.slice(0, -1)) : file.type.toLowerCase() === a);
}
const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files');

/** A file drop target that eases toward a file being dragged near it. Also a normal click-to-browse input. */
export default function MagneticDropZone({ accept, multiple = true, onFiles, label = 'Drop files here', pull = 14, reach = 240 }: MagneticDropZoneProps) {
  const [names, setNames] = useState<string[]>([]);
  const [skipped, setSkipped] = useState(0);
  const [near, setNear] = useState<'idle' | 'near' | 'over'>('idle');
  const zone = useRef<HTMLDivElement>(null);
  const coarse = useCoarsePointer();
  const reduced = useReducedMotion();
  const cb = useRef(onFiles);
  cb.current = onFiles;

  const take = (list: File[]) => {
    const ok = list.filter((f) => matches(f, accept));
    const use = multiple ? ok : ok.slice(0, 1);
    setSkipped(list.length - use.length);
    setNames(use.map((f) => f.name));
    if (use.length) cb.current?.(use);
  };
  const takeRef = useRef(take);
  takeRef.current = take;

  useEffect(() => {
    const el = zone.current;
    if (!el) return;
    const lean = !coarse && !reduced;
    let raf = 0;
    let dragging = false;
    const target = { x: 0, y: 0, s: 1 };
    const cur = { x: 0, y: 0, s: 1 };
    const paint = () => { el.style.transform = cur.x || cur.y || cur.s !== 1 ? `translate(${cur.x.toFixed(2)}px, ${cur.y.toFixed(2)}px) scale(${cur.s.toFixed(3)})` : ''; };
    const loop = () => {
      cur.x += (target.x - cur.x) * 0.16; cur.y += (target.y - cur.y) * 0.16; cur.s += (target.s - cur.s) * 0.16;
      paint();
      const settled = Math.abs(target.x - cur.x) + Math.abs(target.y - cur.y) + Math.abs(target.s - cur.s) < 0.01;
      if (!dragging && settled) { cur.x = cur.y = 0; cur.s = 1; paint(); raf = 0; return; }
      raf = requestAnimationFrame(loop);
    };
    const kick = () => { if (!raf) raf = requestAnimationFrame(loop); };
    const measure = (e: DragEvent) => {
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const dx = e.clientX - cx, dy = e.clientY - cy;
      const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      const dist = Math.hypot(Math.max(0, Math.abs(dx) - r.width / 2), Math.max(0, Math.abs(dy) - r.height / 2));
      return { dx, dy, inside, dist };
    };
    const over = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      const m = measure(e);
      if (m.dist > reach) { target.x = target.y = 0; target.s = 1; setNear('idle'); dragging = true; kick(); return; }
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
      const k = 1 - m.dist / reach;
      const len = Math.hypot(m.dx, m.dy) || 1;
      if (lean) { target.x = (m.dx / len) * pull * k; target.y = (m.dy / len) * pull * k; target.s = m.inside ? 1.04 : 1 + 0.02 * k; }
      setNear(m.inside ? 'over' : 'near');
      dragging = true;
      kick();
    };
    const end = () => { dragging = false; target.x = target.y = 0; target.s = 1; setNear('idle'); kick(); };
    const drop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      const m = measure(e);
      const wasNear = m.dist <= reach;
      end();
      if (!wasNear) return;
      e.preventDefault();
      takeRef.current(Array.from(e.dataTransfer?.files ?? []));
    };
    const leave = (e: DragEvent) => { if (!e.relatedTarget) end(); };
    window.addEventListener('dragenter', over);
    window.addEventListener('dragover', over);
    window.addEventListener('dragleave', leave);
    window.addEventListener('drop', drop);
    window.addEventListener('dragend', end);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('dragenter', over);
      window.removeEventListener('dragover', over);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('drop', drop);
      window.removeEventListener('dragend', end);
      el.style.transform = '';
    };
  }, [coarse, reduced, pull, reach]);

  const shown = names.slice(0, 3);
  return (
    <div className="ui-magnetic-drop-zone" ref={zone} data-state={near}>
      <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" className="ui-magnetic-drop-zone-icon"><path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
      <p className="ui-magnetic-drop-zone-label">{near === 'idle' ? label : 'Release to add'}</p>
      <label className="ui-magnetic-drop-zone-browse">
        <input type="file" accept={accept} multiple={multiple} onChange={(e: ChangeEvent<HTMLInputElement>) => { take(Array.from(e.target.files ?? [])); e.target.value = ''; }} />
        <span>or browse</span>
      </label>
      <div role="status" aria-live="polite" className="ui-magnetic-drop-zone-files">
        {names.length > 0 && (
          <ul>
            {shown.map((n, i) => <li key={`${n}-${i}`}>{n}</li>)}
            {names.length > shown.length && <li>+{names.length - shown.length} more</li>}
          </ul>
        )}
        <span className="ui-magnetic-drop-zone-sr">{names.length ? `${names.length} file${names.length > 1 ? 's' : ''} added: ${names.join(', ')}.` : ''}{skipped ? ` ${skipped} skipped, wrong type.` : ''}</span>
        {skipped > 0 && <small aria-hidden="true">{skipped} skipped (wrong type)</small>}
      </div>
    </div>
  );
}

export function Demo() {
  return <MagneticDropZone />;
}
