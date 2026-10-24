import { NextRequest } from 'next/server';
import { migrate, query } from '@/lib/db';
import { checkPassword, isLocked, logActivity, mfaPendingCookie, recordFailure } from '@/lib/admin';
import { back, formOf } from '@/lib/admin-http';

export const runtime = 'nodejs';

/** Step 1 of 2: username and password. A correct pair only earns the chance to enter the code. */
export async function POST(req: NextRequest) {
  if (!(await (await import('@/lib/admin')).hasGate())) return Response.json({ error: 'access code required' }, { status: 403 });
  await migrate();
  const f = await formOf(req);
  const username = f('username').toLowerCase();
  const password = f('password');
  // One message for every failure, so the form does not say which usernames exist.
  const refused = 'Wrong username or password.';
  const user = (await query<{ password_hash: string }>(`SELECT password_hash FROM admin_users WHERE username = $1`, [username]))[0];
  if (!user) {
    await logActivity(null, 'Failed sign-in', `unknown username "${username.slice(0, 40)}"`);
    return back(req, '/admin/login', { error: refused });
  }
  if (await isLocked(username)) {
    await logActivity(username, 'Failed sign-in', 'locked after too many attempts');
    return back(req, '/admin/login', { error: 'Too many attempts. Try again in 15 minutes.' });
  }
  if (!(await checkPassword(password, user.password_hash))) {
    await recordFailure(username);
    await logActivity(username, 'Failed sign-in', 'wrong password');
    return back(req, '/admin/login', { error: refused });
  }
  const res = back(req, '/admin/verify');
  const c = mfaPendingCookie(username);
  res.cookies.set(c.name, c.value, c.options);
  return res;
}
