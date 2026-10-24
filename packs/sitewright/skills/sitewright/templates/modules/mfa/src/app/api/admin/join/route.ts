import { NextRequest } from 'next/server';
import { migrate, query } from '@/lib/db';
import {
  enrollCookie, hashPassword, newTotpSecret, passwordProblem, tokenHash, usernameProblem,
} from '@/lib/admin';
import { back, formOf } from '@/lib/admin-http';

export const runtime = 'nodejs';

/** An invited person chooses their name, username and password; the authenticator comes next. */
export async function POST(req: NextRequest) {
  if (!(await (await import('@/lib/admin')).hasGate())) return Response.json({ error: 'access code required' }, { status: 403 });
  await migrate();
  const f = await formOf(req);
  const token = f('t');
  const username = f('username').toLowerCase();
  const name = f('name');
  const password = f('password');
  // Once someone has chosen a username with this link it is theirs: a second person with the same
  // link must not be able to replace the password mid-setup and end up with the account.
  const invite = (await query<{ ok: boolean }>(
    `SELECT (used_at IS NULL AND expires_at > now() AND pending_username IS NULL) AS ok
       FROM admin_invites WHERE token_hash = $1 AND kind = 'invite'`,
    [tokenHash(token)],
  ))[0];
  if (!invite?.ok) return back(req, '/admin/join', { t: token, error: 'This invite link has been used or has expired. Ask for a new one.' });

  const problem = !name ? 'Enter your name.' : usernameProblem(username) ?? passwordProblem(password, username);
  if (problem) return back(req, '/admin/join', { t: token, error: problem });
  const taken = await query(`SELECT 1 FROM admin_users WHERE username = $1`, [username]);
  if (taken.length) return back(req, '/admin/join', { t: token, error: 'That username is taken.' });

  const claimed = await query(
    `UPDATE admin_invites SET pending_username = $2, pending_name = $3, pending_password = $4, pending_totp = $5
      WHERE token_hash = $1 AND pending_username IS NULL RETURNING 1`,
    [tokenHash(token), username, name, await hashPassword(password), newTotpSecret()],
  );
  if (!claimed.length) return back(req, '/admin/join', { t: token, error: 'This invite link has been used or has expired. Ask for a new one.' });
  const res = back(req, '/admin/enroll');
  const c = enrollCookie(token);
  res.cookies.set(c.name, c.value, c.options);
  return res;
}
