import { NextRequest } from 'next/server';
import { migrate, query } from '@/lib/db';
import {
  ENROLL_COOKIE, adminSessionCookie, logActivity, pendingEnrollToken, tokenHash, totpStep,
} from '@/lib/admin';
import { back, formOf } from '@/lib/admin-http';

export const runtime = 'nodejs';

/**
 * Confirms the authenticator app with its first code, then creates the account and signs it in.
 * The account does not exist until this succeeds - nobody can end up with a password and no MFA.
 */
export async function POST(req: NextRequest) {
  if (!(await (await import('@/lib/admin')).hasGate())) return Response.json({ error: 'access code required' }, { status: 403 });
  await migrate();
  const token = await pendingEnrollToken();
  if (!token) return back(req, '/admin/login', { error: 'That took too long. Start again.' });
  const f = await formOf(req);
  const row = (await query<{
    kind: string; created_by: string; pending_username: string | null; pending_name: string; pending_password: string;
    pending_totp: string; ok: boolean;
  }>(
    `SELECT kind, created_by, pending_username, pending_name, pending_password, pending_totp,
            (used_at IS NULL AND expires_at > now()) AS ok
       FROM admin_invites WHERE token_hash = $1`,
    [tokenHash(token)],
  ))[0];
  if (!row?.ok || !row.pending_username) return back(req, '/admin/login', { error: 'That invite has expired. Ask for a new one.' });
  if (row.kind === 'setup') {
    const existing = await query(`SELECT 1 FROM admin_users LIMIT 1`);
    if (existing.length) return back(req, '/admin/login');
  }
  const step = totpStep(row.pending_totp, f('code'));
  if (step === null) return back(req, '/admin/enroll', { error: 'That code did not match. Check the clock on your device and try the next code.' });

  await query(
    `INSERT INTO admin_users (username, name, password_hash, totp_secret, totp_last_step, created_by, last_sign_in)
     VALUES ($1, $2, $3, $4, $5, $6, now())`,
    [row.pending_username, row.pending_name, row.pending_password, row.pending_totp, step, row.created_by],
  );
  await query(`UPDATE admin_invites SET used_at = now(), pending_password = NULL, pending_totp = NULL WHERE token_hash = $1`, [tokenHash(token)]);
  await logActivity(row.pending_username, row.kind === 'setup' ? 'Set up __AREA__' : `Joined (invited by ${row.created_by})`);

  const res = back(req, '/admin');
  const c = adminSessionCookie(row.pending_username);
  res.cookies.set(c.name, c.value, c.options);
  res.cookies.delete(ENROLL_COOKIE);
  return res;
}
