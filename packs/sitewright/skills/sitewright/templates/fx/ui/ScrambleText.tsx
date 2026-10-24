'use client';
import { useEffect, useRef, useState, type ElementType } from 'react';
import { useReducedMotion } from './_k1';

export interface ScrambleTextProps {
  text?: string;
  /** Change this number/string to replay the scramble even if `text` is the same. */
  trigger?: number | string;
  /** Milliseconds between one character settling and the next. */
  stagger?: number;
  glyphs?: string;
  as?: ElementType;
  className?: string;
  /** Scramble once on first render too. */
  animateOnMount?: boolean;
}

const GLYPHS = 'abcdefghijklmnopqrstuvwxyz0123456789#%&*+=?';

/** Changed characters spin through random glyphs and settle left to right. Screen readers get a real, static copy. */
export default function ScrambleText({ text = 'Ship it faster', trigger, stagger = 45, glyphs = GLYPHS, as: Tag = 'span', className, animateOnMount = false }: ScrambleTextProps) {
  const [shown, setShown] = useState(text);
  const reduced = useReducedMotion();
  const prev = useRef<string | null>(animateOnMount ? '' : null);
  const prevTrigger = useRef(trigger);

  useEffect(() => {
    const from = prev.current ?? text;
    const forceAll = prevTrigger.current !== trigger && from === text;
    prev.current = text;
    prevTrigger.current = trigger;
    if (reduced || (from === text && !forceAll)) { setShown(text); return; }
    const pool = Array.from(glyphs);
    const start = performance.now();
    const settleAt = (i: number) => 120 + i * stagger;
    let raf = 0;
    let last = 0;
    const tick = (now: number) => {
      const t = now - start;
      if (now - last >= 34 || t >= settleAt(text.length)) {
        last = now;
        let out = '';
        for (let i = 0; i < text.length; i++) {
          const ch = text.charAt(i);
          const changed = forceAll || ch !== from.charAt(i);
          out += !changed || ch === ' ' || t >= settleAt(i) ? ch : pool[Math.floor(Math.random() * pool.length)] ?? ch;
        }
        setShown(out);
      }
      if (t < settleAt(text.length)) raf = requestAnimationFrame(tick);
      else setShown(text);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [text, trigger, stagger, glyphs, reduced]);

  return (
    <Tag className={`ui-scramble-text${className ? ` ${className}` : ''}`}>
      <span className="ui-scramble-text-sr">{text}</span>
      <span aria-hidden="true" className="ui-scramble-text-live">{shown}</span>
    </Tag>
  );
}

const LINES = ['Ship it faster', 'Review every change', 'Roll back in one click'];

export function Demo() {
  const [i, setI] = useState(0);
  const [replay, setReplay] = useState(0);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, textAlign: 'center' }}>
      <ScrambleText text={LINES[i]} trigger={replay} className="ui-scramble-text-demo" />
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" className="ui-scramble-text-btn" onClick={() => setI((v) => (v + 1) % LINES.length)}>Next line</button>
        <button type="button" className="ui-scramble-text-btn" onClick={() => setReplay((v) => v + 1)}>Replay</button>
      </div>
    </div>
  );
}
