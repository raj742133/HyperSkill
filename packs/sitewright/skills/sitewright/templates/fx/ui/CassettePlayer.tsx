'use client';
import { useEffect, useRef, useState } from 'react';
import { useActive } from './_k1';

export interface CassettePlayerProps {
  title?: string;
  artist?: string;
  /** Length of the simulated timeline in seconds. No audio is ever played. */
  duration?: number;
  autoPlay?: boolean;
  onPlayingChange?: (playing: boolean) => void;
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

function Reel({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill="#6b5a42" />
      <g className="ui-cassette-player-hub" style={{ transformOrigin: `${cx}px ${cy}px` }}>
        <circle cx={cx} cy={cy} r={6} fill="#e9e4da" />
        {[0, 60, 120, 180, 240, 300].map((a) => <rect key={a} x={cx - 1} y={cy - 5.500} width={2} height={3.500} rx={0.800} fill="#2a2522" transform={`rotate(${a} ${cx} ${cy})`} />)}
      </g>
    </g>
  );
}

/** A compact cassette whose reels turn while it "plays". Visual only: the timeline is simulated, nothing makes a sound. */
export default function CassettePlayer({ title = 'Midnight Tape', artist = 'The Soft Machines', duration = 214, autoPlay = false, onPlayingChange }: CassettePlayerProps) {
  const [playing, setPlaying] = useState(autoPlay);
  const [pos, setPos] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const active = useActive(root);
  const run = playing && active;
  const posRef = useRef(0);
  posRef.current = pos;

  useEffect(() => {
    if (!run) return;
    let last = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now();
      const next = posRef.current + (now - last) / 1000;
      last = now;
      if (next >= duration) { setPos(0); setPlaying(false); onPlayingChange?.(false); } else setPos(next);
    }, 200);
    return () => window.clearInterval(id);
  }, [run, duration, onPlayingChange]);

  const toggle = () => { const n = !playing; setPlaying(n); onPlayingChange?.(n); };
  const p = Math.min(1, pos / duration);
  return (
    <div className="ui-cassette-player" ref={root} data-playing={run || undefined}>
      <div className="ui-cassette-player-top">
        <svg viewBox="0 0 120 80" className="ui-cassette-player-art" aria-hidden="true" focusable="false">
          <rect x="1" y="1" width="118" height="78" rx="7" fill="#cbb892" stroke="#7a6a4a" strokeWidth="1.5" />
          <rect x="8" y="7" width="104" height="44" rx="3" fill="#f4efe4" />
          <rect x="8" y="7" width="104" height="13" rx="3" fill="#d8563f" />
          <text x="13" y="16.500" fontSize="8" fontWeight="700" fill="#fff" fontFamily="ui-monospace, monospace">{title.length > 20 ? `${title.slice(0, 19)}…` : title}</text>
          <rect x="22" y="24" width="76" height="24" rx="12" fill="#2a2522" />
          <Reel cx={38} cy={36} r={6.500 + 4 * (1 - p)} />
          <Reel cx={82} cy={36} r={6.500 + 4 * p} />
          <path d="M18 78 L28 58 H92 L102 78Z" fill="#a8956b" />
          {[40, 52, 64, 76].map((x) => <circle key={x} cx={x} cy={67} r={1.600} fill="#2a2522" />)}
        </svg>
        <div className="ui-cassette-player-meta">
          <strong>{title}</strong>
          <span>{artist}</span>
          <button type="button" className="ui-cassette-player-btn" onClick={toggle} aria-label={playing ? `Pause ${title}` : `Play ${title}`}>
            <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">{playing ? <path d="M4 3h3v10H4zM9 3h3v10H9z" fill="currentColor" /> : <path d="M4.5 2.5v11l9-5.5z" fill="currentColor" />}</svg>
          </button>
        </div>
      </div>
      <div className="ui-cassette-player-bar">
        <span className="ui-cassette-player-time">{fmt(pos)}</span>
        <input type="range" min={0} max={duration} step={1} value={Math.floor(pos)} onChange={(e) => setPos(Number(e.target.value))} aria-label={`Position in ${title}`} aria-valuetext={`${fmt(pos)} of ${fmt(duration)}`} style={{ ['--ui-cassette-player-p' as string]: `${p * 100}%` }} />
        <span className="ui-cassette-player-time">{fmt(duration)}</span>
      </div>
      <span className="ui-cassette-player-sr" role="status">{playing ? 'Playing (visual only)' : 'Paused'}</span>
    </div>
  );
}

export function Demo() {
  return <CassettePlayer />;
}
