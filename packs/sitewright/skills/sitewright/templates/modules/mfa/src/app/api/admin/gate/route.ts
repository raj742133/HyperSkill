import { NextRequest } from 'next/server';
import { checkAccessCode, gateCookie, logActivity } from '@/lib/admin';
import { migrate } from '@/lib/db';
import { back, formOf } from '@/lib/admin-http';

export const runtime = 'nodejs';

/** The Publishing access code (see checkAccessCode). Opens the section for 12 hours. */
export async function POST(req: NextRequest) {
  await migrate();
  const f = await formOf(req);
  if (!checkAccessCode(f('code'))) {
    await logActivity(null, 'Access code refused');
    return back(req, '/admin/gate', { error: 'That access code is not right.' });
  }
  const res = back(req, '/admin');
  const c = gateCookie();
  res.cookies.set(c.name, c.value, c.options);
  return res;
}
