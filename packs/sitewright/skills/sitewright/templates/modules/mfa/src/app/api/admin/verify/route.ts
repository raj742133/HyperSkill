import { NextRequest } from 'next/server';
import { migrate, query } from '@/lib/db';
import {
  MFA_COOKIE, adminSessionCookie, isLocked, logActivity, pendingMfa, recordFailure, totpStep,
} from '@/lib/admin';
import { back, formOf } from '@/lib/admin-http';

export const runtime = 'nodejs';

/** Step 2 of 2: the authenticator code. Each code is accepted once. */
export async function POST(req: NextRequest) {
  if (!(await (await import('@/lib/admin')).hasGate())) return Response.json({ error: 'access code required' }, { status: 403 });
  await migrate();
  const username = await pendingMfa();
  if (!username) return back(req, '/admin/login', { error: 'That took too long. Sign in again.' });
  if (await isLocked(username)) return back(req, '/admin/login', { error: 'Too many attempts. Try again in 15 minutes.' });
  const f = await formOf(req);
  const user = (await query<{ totp_secret: string; totp_last_step: string }>(
    `SELECT totp_secret, totp_last_step FROM admin_users WHERE username = $1`, [username],
  ))[0];
  const step = user ? totpStep(user.totp_secret, f('code')) : null;
  if (!user || step === null || step <= Number(user.totp_last_step)) {
    await recordFailure(username);
    await logActivity(username, 'Failed sign-in', step !== null ? 'code already used' : 'wrong authenticator code');
    return back(req, '/admin/verify', { error: 'That code is not right. Enter the current one from your authenticator app.' });
  }
  await query(
    `UPDATE admin_users SET totp_last_step = $2, last_sign_in = now(), failed_attempts = 0, locked_until = NULL WHERE username = $1`,
    [username, step],
  );
  await logActivity(username, 'Signed in');
  const res = back(req, '/admin');
  const c = adminSessionCookie(username);
  res.cookies.set(c.name, c.value, c.options);
  res.cookies.delete(MFA_COOKIE);
  return res;
}
