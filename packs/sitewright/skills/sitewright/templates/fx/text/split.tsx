import type { CSSProperties, ReactNode } from 'react';

/** The headline in the pieces the landing page already has: words before the accent, the accent, and the words after it. */
export type Parts = { before: string; accent?: string; after?: string };

export const plain = (p: Parts) => `${p.before}${p.accent ?? ''}${p.after ?? ''}`;

const idx = (n: number) => ({ '--i': n }) as CSSProperties;

/**
 * Wraps the headline in spans: every word, or every letter inside its word. Words are inline-block so a line never breaks
 * in the middle of one. `--i` is the running index across the whole headline; the css turns it into a staggered delay.
 * The accent stays inside an <em> so the brand colour still applies.
 */
export function pieces(p: Parts, unit: 'word' | 'char'): ReactNode {
  let n = 0;
  const run = (text: string, key: string): ReactNode[] =>
    text.split(/(\s+)/).map((tok, k) => {
      if (tok === '') return null;
      if (/^\s+$/.test(tok)) return tok;
      if (unit === 'word') return <span key={`${key}${k}`} className="fx-w" style={idx(n++)}><span className="fx-wi">{tok}</span></span>;
      return (
        <span key={`${key}${k}`} className="fx-w">
          {Array.from(tok).map((ch, c) => <span key={c} className="fx-c" style={idx(n++)}>{ch}</span>)}
        </span>
      );
    });
  return (
    <>
      {run(p.before, 'b')}
      {p.accent ? <em>{run(p.accent, 'a')}</em> : null}
      {p.after ? run(p.after, 'z') : null}
    </>
  );
}
