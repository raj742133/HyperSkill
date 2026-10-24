import { createHmac, timingSafeEqual } from 'crypto';
import { cookies } from 'next/headers';

/**
 * Two different doors, deliberately.
 *
 * **People** get a shared password. The thing that keeps private pages off the
 * open web should not be "nobody has guessed the URL". A shared
 * password is not per-user accounting, and it is not pretending to be; it is the smallest thing
 * that makes the link safe to send to a colleague.
 *
 * **Clients** (a phone app, a script) get a bearer token, not the password - see lib/ingest-auth.ts. If a client carried the
 * human password, unpacking it would hand somebody the site, and rotating the password would lock every client out.
 * They rotate independently.
 *
 * Both comparisons are constant-time. A timing oracle on a six-character shared secret is not
 * theoretical.
 */

const COOKIE = '__COOKIE__-session';

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error('SESSION_SECRET is not set - see .env.example.');
  return s;
}

function sign(value: string): string {
  return createHmac('sha256', secret()).update(value).digest('hex');
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  // timingSafeEqual throws on length mismatch, which is itself a length oracle - so compare a
  // fixed-size digest of each instead of the raw values.
  const ah = createHmac('sha256', secret()).update(ab).digest();
  const bh = createHmac('sha256', secret()).update(bb).digest();
  return timingSafeEqual(ah, bh);
}

/** True when the request carries a valid dashboard cookie. */
export async function isSignedIn(): Promise<boolean> {
  const jar = await cookies();
  const raw = jar.get(COOKIE)?.value;
  if (!raw) return false;
  const [issued, mac] = raw.split('.');
  if (!issued || !mac) return false;
  if (!safeEqual(sign(issued), mac)) return false;
  const age = Date.now() - Number(issued);
  return Number.isFinite(age) && age >= 0 && age < 30 * 24 * 60 * 60 * 1000;
}

export function checkPassword(candidate: string): boolean {
  const expected = process.env.DASHBOARD_PASSWORD;
  if (!expected) throw new Error('DASHBOARD_PASSWORD is not set - see .env.example.');
  return safeEqual(candidate, expected);
}

export function sessionCookie(): { name: string; value: string; options: Record<string, unknown> } {
  const issued = String(Date.now());
  return {
    name: COOKIE,
    value: `${issued}.${sign(issued)}`,
    options: {
      httpOnly: true,
      sameSite: 'lax' as const,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 30 * 24 * 60 * 60,
    },
  };
}

export const clearCookie = COOKIE;
