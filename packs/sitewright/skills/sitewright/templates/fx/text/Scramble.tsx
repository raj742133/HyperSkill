'use client';

import { useEffect, useRef } from 'react';
import { plain, type Parts } from './split';

const GLYPHS = '!<>-_/[]{}=+*^?#abcdefghijklmnopqrstuvwxyz0123456789';

/**
 * Random glyphs resolve into the headline from left to right. The real text is what the server sends and what screen readers
 * get; the scramble only rewrites the visible copy for about a second after load, and is skipped for reduced-motion readers.
 */
export default function Scramble(p: Parts) {
  const { before, accent = '', after = '' } = p;
  const b = useRef<HTMLSpanElement>(null);
  const a = useRef<HTMLElement>(null);
  const z = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const full = [before, accent, after];
    const total = full.join('').length;
    const els = [b.current, a.current, z.current];
    const start = performance.now();
    const dur = Math.min(1400, 500 + total * 22);
    let raf = 0;
    const frame = (now: number) => {
      const done = Math.min(1, (now - start) / dur);
      let at = 0;
      full.forEach((seg, k) => {
        let out = '';
        for (const ch of seg) {
          const settled = at / total < done;
          out += ch === ' ' || settled ? ch : GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
          at++;
        }
        const el = els[k];
        if (el) el.textContent = out;
      });
      if (done < 1) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [before, accent, after]);
  return (
    <>
      <span className="fx-sr">{plain(p)}</span>
      <span aria-hidden="true" className="fx-scr">
        <span ref={b}>{before}</span>{accent ? <em ref={a}>{accent}</em> : null}<span ref={z}>{after}</span>
      </span>
    </>
  );
}
