import { createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { cookies, headers } from 'next/headers';
import { query } from '@/lib/db';
export {
  checkPassword, hashPassword, newTotpSecret, otpauthUrl, passwordProblem, totpAt, totpStep, usernameProblem,
} from '@/lib/admin-crypto';

/**
 * Publishing's own door: the people who may put a new app version on every phone.
 *
 * Deliberately separate from the shared dashboard password (lib/auth.ts). Anyone who reviews scans
 * knows that one; publishing an APK installs code on every phone in the field, so it takes a named
 * account, a password and a code from an authenticator app (TOTP, RFC 6238 - Google Authenticator,
 * Microsoft Authenticator, 1Password ...). Every sign-in, invite, publish and removal is recorded
 * with the address it came from.
 *
 * The first account is made with a setup code only the person who deployed the dashboard has
 * (ADMIN_SETUP_CODE, or SESSION_SECRET when that is not set); everyone after is invited by link.
 */

export const ADMIN_COOKIE = '__COOKIE__-admin';
export const MFA_COOKIE = '__COOKIE__-admin-mfa';
export const ENROLL_COOKIE = '__COOKIE__-admin-enroll';
export const GATE_COOKIE = '__COOKIE__-admin-gate';

/**
 * The first lock on Publishing: a private access code (PUBLISHING_ACCESS_CODE) asked before any
 * Publishing page - sign-in, setup or invite - is shown. The shared dashboard password lets people
 * look at scans; only those given this code even see where versions are published. Unset = closed.
 */
export function checkAccessCode(code: string): boolean {
  const expected = process.env.PUBLISHING_ACCESS_CODE;
  return !!expected && !!code && equal(code.trim(), expected);
}

export function gateCookie() {
  return { name: GATE_COOKIE, value: signed(`gate|${Date.now()}`), options: cookieOptions(12 * 3600) };
}

export async function hasGate(): Promise<boolean> {
  if (!process.env.PUBLISHING_ACCESS_CODE) return true; // no access code configured: no extra lock
  const v = unsigned((await cookies()).get(GATE_COOKIE)?.value);
  if (!v) return false;
  const age = Date.now() - Number(v.split('|')[1]);
  return age >= 0 && age < 12 * 3600 * 1000;
}

/** For Publishing pages: sends anyone without the access code to enter it first. */
export async function requireGate(): Promise<void> {
  if (!(await hasGate())) {
    const { redirect } = await import('next/navigation');
    redirect('/admin/gate');
  }
}
const SESSION_HOURS = 12;
const MFA_MINUTES = 5;
const MAX_FAILURES = 5;
const LOCK_MINUTES = 15;
export const INVITE_HOURS = 48;

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error('SESSION_SECRET is not set - see .env.example.');
  return s;
}

const mac = (value: string) => createHmac('sha256', 'admin:' + secret()).update(value).digest('hex');

function equal(a: string, b: string): boolean {
  const ah = createHash('sha256').update(a).digest();
  const bh = createHash('sha256').update(b).digest();
  return timingSafeEqual(ah, bh);
}

// ---- cookies --------------------------------------------------------------------------------------

function signed(value: string): string {
  return `${Buffer.from(value).toString('base64url')}.${mac(value)}`;
}

function unsigned(raw: string | undefined): string | null {
  if (!raw) return null;
  const [b64, m] = raw.split('.');
  if (!b64 || !m) return null;
  const value = Buffer.from(b64, 'base64url').toString();
  return equal(mac(value), m) ? value : null;
}

const cookieOptions = (maxAgeSeconds: number) => ({
  httpOnly: true,
  // Strict: a publishing form posted from another site never carries the cookie.
  sameSite: 'strict' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: maxAgeSeconds,
});

export function adminSessionCookie(username: string) {
  return { name: ADMIN_COOKIE, value: signed(`${username}|${Date.now()}`), options: cookieOptions(SESSION_HOURS * 3600) };
}

export function mfaPendingCookie(username: string) {
  return { name: MFA_COOKIE, value: signed(`${username}|${Date.now()}`), options: cookieOptions(MFA_MINUTES * 60) };
}

export function enrollCookie(token: string) {
  return { name: ENROLL_COOKIE, value: signed(token), options: cookieOptions(30 * 60) };
}

export interface Admin {
  username: string;
  name: string;
}

/** The signed-in publisher, or null. Checked against the database, so a removed person is out at once. */
export async function currentAdmin(): Promise<Admin | null> {
  const v = unsigned((await cookies()).get(ADMIN_COOKIE)?.value);
  if (!v) return null;
  const [username, issued] = v.split('|');
  const age = Date.now() - Number(issued);
  if (!username || !(age >= 0 && age < SESSION_HOURS * 3600 * 1000)) return null;
  const rows = await query<Admin>(`SELECT username, name FROM admin_users WHERE username = $1`, [username]);
  return rows[0] ?? null;
}

/** The username waiting for its authenticator code after a correct password, or null. */
export async function pendingMfa(): Promise<string | null> {
  const v = unsigned((await cookies()).get(MFA_COOKIE)?.value);
  if (!v) return null;
  const [username, issued] = v.split('|');
  const age = Date.now() - Number(issued);
  return username && age >= 0 && age < MFA_MINUTES * 60 * 1000 ? username : null;
}

export async function pendingEnrollToken(): Promise<string | null> {
  return unsigned((await cookies()).get(ENROLL_COOKIE)?.value);
}

// ---- lockout, invites, activity ---------------------------------------------------------------------

export async function isLocked(username: string): Promise<boolean> {
  const rows = await query<{ locked: boolean }>(
    `SELECT (locked_until IS NOT NULL AND locked_until > now()) AS locked FROM admin_users WHERE username = $1`,
    [username],
  );
  return rows[0]?.locked ?? false;
}

export async function recordFailure(username: string): Promise<void> {
  await query(
    `UPDATE admin_users
        SET failed_attempts = failed_attempts + 1,
            locked_until = CASE WHEN failed_attempts + 1 >= $2 THEN now() + ($3 || ' minutes')::interval ELSE locked_until END
      WHERE username = $1`,
    [username, MAX_FAILURES, String(LOCK_MINUTES)],
  );
}

export const tokenHash = (t: string) => createHash('sha256').update(t).digest('hex');
export const newToken = () => randomBytes(24).toString('base64url');

/** The setup code the first account needs: ADMIN_SETUP_CODE, else SESSION_SECRET. */
export function checkSetupCode(code: string): boolean {
  const expected = process.env.ADMIN_SETUP_CODE || process.env.SESSION_SECRET;
  return !!expected && !!code && equal(code.trim(), expected);
}

export async function adminCount(): Promise<number> {
  const rows = await query<{ n: string }>(`SELECT COUNT(*) AS n FROM admin_users`);
  return Number(rows[0]?.n ?? 0);
}

export async function clientIp(): Promise<string> {
  const h = await headers();
  const ip = (h.get('x-forwarded-for')?.split(',')[0] ?? h.get('x-real-ip') ?? '').trim();
  // A hosting front end appends the client port to an IPv4 address ("1.2.3.4:5678").
  return (/^\d+\.\d+\.\d+\.\d+:\d+$/.test(ip) ? ip.replace(/:\d+$/, '') : ip) || 'unknown';
}

export async function logActivity(username: string | null, action: string, detail = ''): Promise<void> {
  await query(`INSERT INTO admin_activity (username, action, detail, ip) VALUES ($1, $2, $3, $4)`, [
    username, action, detail.slice(0, 300), await clientIp(),
  ]);
}
