import { createHmac, randomInt, timingSafeEqual } from 'crypto';
import { query } from '@/lib/db';

/**
 * Tester mode.
 *
 * A tester is a person, by email, who may see testing builds as well as stable ones. Publishing adds
 * them and shows a code once; they enter email and code in the app (Settings > Tester mode), the app
 * swaps them here for a token (POST /api/app/tester) and sends that token with its update check
 * (GET /api/app/latest), which then also offers the newest testing build.
 *
 * Only an HMAC of the code is stored. A token carries the tester's id and when it was issued; it
 * stops working when the tester is revoked or given a new code. Five wrong codes lock the email for
 * fifteen minutes.
 */

export interface TesterRow {
  id: number;
  name: string;
  email: string;
  code_set_at: string | Date;
  created_by: string;
  created_at: string | Date;
  revoked_at: string | Date | null;
  last_seen_at: string | Date | null;
  failed_attempts: number;
  locked_until: string | Date | null;
}

const MAX_TRIES = 5;
const LOCK_MINUTES = 15;
// No 0/O, 1/I/L: the code is read off a screen and typed on a phone.
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error('SESSION_SECRET is not set - see .env.example.');
  return s;
}
const mac = (v: string) => createHmac('sha256', secret()).update(v).digest('hex');
const same = (a: string, b: string) => {
  const x = createHmac('sha256', secret()).update(a).digest();
  const y = createHmac('sha256', secret()).update(b).digest();
  return timingSafeEqual(x, y);
};

export const normEmail = (e: string) => e.trim().toLowerCase();
const normCode = (c: string) => c.toUpperCase().replace(/[^0-9A-Z]/g, '');
const hashCode = (code: string) => mac(`tester-code:${normCode(code)}`);

export function newCode(): string {
  const group = () => Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');
  return `TST-${group()}-${group()}-${group()}`;
}

export function validEmail(e: string): boolean {
  return /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/.test(e);
}

export async function listTesters(): Promise<TesterRow[]> {
  return query<TesterRow>(
    `SELECT id, name, email, code_set_at, created_by, created_at, revoked_at, last_seen_at, failed_attempts, locked_until
     FROM testers ORDER BY revoked_at IS NOT NULL, created_at DESC`,
  );
}

/** Adds a tester; returns the code, which is never shown again. */
export async function addTester(name: string, email: string, by: string): Promise<{ id: number; code: string }> {
  const code = newCode();
  const rows = await query<{ id: number }>(
    `INSERT INTO testers (name, email, code_hash, created_by) VALUES ($1, $2, $3, $4) RETURNING id`,
    [name, normEmail(email), hashCode(code), by],
  );
  return { id: rows[0].id, code };
}

/** A new code for an existing tester: the old code and every token issued with it stop working. */
export async function resetCode(id: number): Promise<string | null> {
  const code = newCode();
  const rows = await query<{ id: number }>(
    `UPDATE testers SET code_hash = $2, code_set_at = now(), failed_attempts = 0, locked_until = NULL WHERE id = $1 RETURNING id`,
    [id, hashCode(code)],
  );
  return rows.length ? code : null;
}

export async function setRevoked(id: number, revoked: boolean): Promise<boolean> {
  const rows = await query<{ id: number }>(
    `UPDATE testers SET revoked_at = ${revoked ? 'now()' : 'NULL'} WHERE id = $1 RETURNING id`,
    [id],
  );
  return rows.length > 0;
}

export async function deleteTester(id: number): Promise<boolean> {
  return (await query<{ id: number }>(`DELETE FROM testers WHERE id = $1 RETURNING id`, [id])).length > 0;
}

function tokenFor(id: number, issuedMs: number): string {
  return `t1.${id}.${issuedMs}.${mac(`tester-token:${id}:${issuedMs}`)}`;
}

export type VerifyResult =
  | { ok: true; token: string; name: string }
  | { ok: false; reason: 'wrong' | 'locked' | 'revoked' };

/** Email + code from the app. The same "wrong" answer for an unknown email and a wrong code. */
export async function verifyTester(email: string, code: string): Promise<VerifyResult> {
  const row = (await query<TesterRow & { code_hash: string }>(
    `SELECT * FROM testers WHERE email = $1`, [normEmail(email)],
  ))[0];
  if (!row) { same(hashCode(code), hashCode('x')); return { ok: false, reason: 'wrong' }; }
  if (row.locked_until && new Date(row.locked_until).getTime() > Date.now()) return { ok: false, reason: 'locked' };
  if (!same(hashCode(code), row.code_hash)) {
    const tries = row.failed_attempts + 1;
    if (tries >= MAX_TRIES) {
      await query(`UPDATE testers SET failed_attempts = 0, locked_until = now() + interval '${LOCK_MINUTES} minutes' WHERE id = $1`, [row.id]);
      return { ok: false, reason: 'locked' };
    }
    await query(`UPDATE testers SET failed_attempts = $2 WHERE id = $1`, [row.id, tries]);
    return { ok: false, reason: 'wrong' };
  }
  if (row.revoked_at) return { ok: false, reason: 'revoked' };
  await query(`UPDATE testers SET failed_attempts = 0, locked_until = NULL, last_seen_at = now() WHERE id = $1`, [row.id]);
  return { ok: true, token: tokenFor(row.id, Date.now()), name: row.name };
}

/** The tester a token belongs to, if it is still good; marks them as seen. */
export async function testerFromToken(token: string | null): Promise<{ id: number; name: string } | null> {
  const m = /^t1\.(\d+)\.(\d+)\.([a-f0-9]{64})$/.exec(token?.trim() ?? '');
  if (!m) return null;
  const [, idS, issuedS, sig] = m;
  const id = Number(idS), issued = Number(issuedS);
  if (!same(sig, mac(`tester-token:${id}:${issued}`))) return null;
  const row = (await query<TesterRow>(`SELECT * FROM testers WHERE id = $1`, [id]))[0];
  if (!row || row.revoked_at) return null;
  // issued before the code was last changed: no longer good (1 s slack for the same request)
  if (issued + 1000 < new Date(row.code_set_at).getTime()) return null;
  await query(`UPDATE testers SET last_seen_at = now() WHERE id = $1`, [id]);
  return { id, name: row.name };
}
