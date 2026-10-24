import { createHash, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';

/**
 * The optional team code in front of the home page's downloads.
 *
 * A published build may have this site's address and upload key built in, so anyone who downloads it can
 * send data here. Set LANDING_DOWNLOAD_CODE and the home page asks for that code once (an
 * "Enter your team code" dialog) before any download; leave it unset and downloads are open.
 */
export const UNLOCK_COOKIE = '__COOKIE__-dl';

const digest = (s: string) => createHash('sha256').update(`__COOKIE__-dl:${s.trim().toUpperCase()}`).digest('hex');

export function gateEnabled(): boolean {
  return Boolean(process.env.LANDING_DOWNLOAD_CODE?.trim());
}

export function codeMatches(code: string): boolean {
  const want = process.env.LANDING_DOWNLOAD_CODE;
  if (!want) return true;
  const a = Buffer.from(digest(code));
  const b = Buffer.from(digest(want));
  return a.length === b.length && timingSafeEqual(a, b);
}

/** The cookie value a correct code earns: the digest, so the code itself is never stored. */
export function unlockValue(): string {
  return digest(process.env.LANDING_DOWNLOAD_CODE ?? '');
}

export async function isUnlocked(): Promise<boolean> {
  if (!gateEnabled()) return true;
  const got = (await cookies()).get(UNLOCK_COOKIE)?.value ?? '';
  const a = Buffer.from(got);
  const b = Buffer.from(unlockValue());
  return a.length === b.length && timingSafeEqual(a, b);
}
