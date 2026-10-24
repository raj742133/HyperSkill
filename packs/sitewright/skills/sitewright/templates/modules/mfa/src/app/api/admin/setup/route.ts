import { NextRequest } from 'next/server';
import { migrate, query } from '@/lib/db';
import {
  adminCount, checkSetupCode, enrollCookie, hashPassword, logActivity, newToken, newTotpSecret,
  passwordProblem, tokenHash, usernameProblem,
} from '@/lib/admin';
import { back, formOf } from '@/lib/admin-http';

export const runtime = 'nodejs';

/** The first publisher. Only while there is none, and only with the setup code. */
export async function POST(req: NextRequest) {
  if (!(await (await import('@/lib/admin')).hasGate())) return Response.json({ error: 'access code required' }, { status: 403 });
  await migrate();
  if ((await adminCount()) > 0) return back(req, '/admin/login');
  const f = await formOf(req);
  const username = f('username').toLowerCase();
  const name = f('name');
  const password = f('password');
  if (!checkSetupCode(f('code'))) {
    await logActivity(null, 'Setup refused', 'wrong setup code');
    return back(req, '/admin/setup', { error: 'That setup code is not right.' });
  }
  const problem = !name ? 'Enter your name.' : usernameProblem(username) ?? passwordProblem(password, username);
  if (problem) return back(req, '/admin/setup', { error: problem });

  const token = newToken();
  await query(
    `INSERT INTO admin_invites (token_hash, kind, created_by, expires_at, pending_username, pending_name, pending_password, pending_totp)
     VALUES ($1, 'setup', 'first setup', now() + interval '30 minutes', $2, $3, $4, $5)`,
    [tokenHash(token), username, name, await hashPassword(password), newTotpSecret()],
  );
  const res = back(req, '/admin/enroll');
  const c = enrollCookie(token);
  res.cookies.set(c.name, c.value, c.options);
  return res;
}
