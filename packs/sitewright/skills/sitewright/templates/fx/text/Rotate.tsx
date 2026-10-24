'use client';

import { useEffect, useState } from 'react';
import type { Parts } from './split';

/**
 * The accent word cycles through a list (effects.rotateWords). All the words are stacked in one grid cell, so the headline
 * is always as wide as the longest and never jumps; only the current one is visible. Screen readers get the first word.
 */
export default function Rotate({ before, accent, after, words = [] }: Parts & { words?: string[] }) {
  const list = [accent ?? '', ...words.filter((w) => w && w !== accent)];
  const [i, setI] = useState(0);
  useEffect(() => {
    if (list.length < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const id = setInterval(() => setI((n) => (n + 1) % list.length), 2400);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list.length]);
  return (
    <>
      {before}
      <em className="fx-rot">
        {list.map((w, k) => <span key={w} aria-hidden={k !== 0} className={k === i ? 'on' : ''}>{w}</span>)}
      </em>
      {after}
    </>
  );
}
