'use client';
import { useEffect, useState } from 'react';

/** true when the visitor asked for reduced motion (false during SSR / first render, updated in an effect). */
export function useMedia(query: string, initial = false): boolean {
  const [on, setOn] = useState(initial);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const m = window.matchMedia(query);
    const sync = () => setOn(m.matches);
    sync();
    m.addEventListener('change', sync);
    return () => m.removeEventListener('change', sync);
  }, [query]);
  return on;
}
export const useReducedMotion = () => useMedia('(prefers-reduced-motion: reduce)');
/** true only for a mouse-like pointer that can hover. */
export const useFinePointer = () => useMedia('(hover: hover) and (pointer: fine)');

const GLYPHS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const CODE_ALPHABET = GLYPHS;

/** A pseudo-random invite code like 7K4F-2Q9M-X8NV. Call from an event handler or effect, never during render. */
export function makeCode(groups = 3, size = 4): string {
  const out: string[] = [];
  for (let g = 0; g < groups; g++) {
    let s = '';
    for (let i = 0; i < size; i++) s += GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
    out.push(s);
  }
  return out.join('-');
}

/** Text with the first `settled` characters from `target` and the rest random glyphs (dashes/spaces are kept). */
export function scrambleFrame(target: string, settled: number): string {
  let s = '';
  for (let i = 0; i < target.length; i++) {
    const c = target[i] as string;
    s += i < settled || c === '-' || c === ' ' ? c : GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
  }
  return s;
}

/** Copy text: async clipboard API, falling back to a hidden textarea + execCommand. Resolves true on success. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); return true; }
  } catch { /* fall through */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;';
    document.body.appendChild(ta); ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch { return false; }
}
