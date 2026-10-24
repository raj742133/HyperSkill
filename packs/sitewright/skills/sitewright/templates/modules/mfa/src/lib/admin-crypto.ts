import { createHmac, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'crypto';
import { promisify } from 'util';

/**
 * The parts of Publishing's sign-in that are plain arithmetic - passwords and authenticator codes -
 * kept apart from the request handling in lib/admin.ts so they can be tested on their own.
 */

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

function equal(a: string, b: string): boolean {
  const ah = createHmac('sha256', 'cmp').update(a).digest();
  const bh = createHmac('sha256', 'cmp').update(b).digest();
  return timingSafeEqual(ah, bh);
}

// ---- passwords ------------------------------------------------------------------------------------

export async function hashPassword(pw: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(pw, salt, 32);
  return `scrypt$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function checkPassword(pw: string, stored: string): Promise<boolean> {
  const [kind, salt, key] = stored.split('$');
  if (kind !== 'scrypt' || !salt || !key) return false;
  const got = await scrypt(pw, Buffer.from(salt, 'base64'), 32);
  const want = Buffer.from(key, 'base64');
  return got.length === want.length && timingSafeEqual(got, want);
}

/** Why a password is not good enough, or null. */
export function passwordProblem(pw: string, username: string): string | null {
  if (pw.length < 10) return 'Use at least 10 characters.';
  if (pw.toLowerCase().includes(username.toLowerCase())) return 'The password must not contain the username.';
  return null;
}

export function usernameProblem(u: string): string | null {
  return /^[a-z0-9._-]{3,32}$/.test(u) ? null : 'Usernames are 3-32 of a-z 0-9 . _ -';
}

// ---- TOTP (RFC 6238: SHA-1, 6 digits, 30 s) --------------------------------------------------------

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function newTotpSecret(): string {
  const bytes = randomBytes(20);
  let bits = '';
  for (const b of bytes) bits += b.toString(2).padStart(8, '0');
  let out = '';
  for (let i = 0; i + 5 <= bits.length; i += 5) out += B32[parseInt(bits.slice(i, i + 5), 2)];
  return out;
}

function base32Decode(s: string): Buffer {
  let bits = '';
  for (const c of s.replace(/=+$/, '').toUpperCase()) {
    const v = B32.indexOf(c);
    if (v < 0) continue;
    bits += v.toString(2).padStart(5, '0');
  }
  const out: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) out.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(out);
}

export function totpAt(secretB32: string, step: number): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const h = createHmac('sha1', base32Decode(secretB32)).update(counter).digest();
  const o = h[h.length - 1] & 0x0f;
  const n = ((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(n % 1_000_000).padStart(6, '0');
}

/**
 * The time step [code] is valid for (this 30 s window, or one either side for a phone clock a
 * little off), or null. The caller refuses a step it has already accepted, so a code seen over a
 * shoulder cannot be used a second time.
 */
export function totpStep(secretB32: string, code: string, now = Date.now()): number | null {
  const c = code.replace(/\s+/g, '');
  if (!/^\d{6}$/.test(c)) return null;
  const step = Math.floor(now / 1000 / 30);
  for (const s of [step, step - 1, step + 1]) if (equal(totpAt(secretB32, s), c)) return s;
  return null;
}

export function otpauthUrl(username: string, secretB32: string): string {
  return `otpauth://totp/${encodeURIComponent('__ISSUER__:' + username)}?secret=${secretB32}&issuer=${encodeURIComponent('__ISSUER__')}&digits=6&period=30`;
}

