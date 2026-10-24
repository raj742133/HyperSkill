'use client';
import { useEffect, useRef, useState } from 'react';

export interface BellButtonProps {
  count?: number;
  label?: string;
  onRing?: () => void;
  className?: string;
}

export default function BellButton({ count = 3, label = 'Notifications', onRing, className = '' }: BellButtonProps) {
  const [rings, setRings] = useState(0);
  const [msg, setMsg] = useState('');
  const t = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(t.current), []);

  const ring = () => {
    setRings((r) => r + 1);
    setMsg('');
    clearTimeout(t.current);
    t.current = setTimeout(() => setMsg('Notification bell rung'), 40);
    onRing?.();
  };
  const shown = count > 99 ? '99+' : String(count);

  return (
    <button type="button" className={`ui-bell-button ${className}`.trim()} onClick={ring}
      aria-label={`${label}, ${count} unread. Ring the bell`}>
      <span className="ui-bell-button-icon" key={`i${rings}`} data-ringing={rings > 0 || undefined}>
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 2.8v1.4" />
          <path className="ui-bell-button-body" d="M12 4.2a5.8 5.8 0 0 0-5.8 5.8v3.2c0 .7-.2 1.3-.7 1.8l-1.3 1.3h15.6l-1.3-1.3c-.5-.5-.7-1.1-.7-1.8V10A5.8 5.8 0 0 0 12 4.2z" />
          <path className="ui-bell-button-clapper" d="M9.8 19a2.3 2.3 0 0 0 4.4 0" />
        </svg>
      </span>
      <span className="ui-bell-button-text" aria-hidden="true">{label}</span>
      {count > 0 && <span className="ui-bell-button-badge" key={`b${rings}`} aria-hidden="true">{shown}</span>}
      <span className="ui-bell-button-sr" role="status" aria-live="polite">{msg}</span>
    </button>
  );
}

export function Demo() {
  const [n, setN] = useState(3);
  return (
    <div style={{ display: 'grid', placeItems: 'center', height: '100%' }}>
      <BellButton count={n} onRing={() => setN((v) => Math.min(99, v + 1))} />
    </div>
  );
}
