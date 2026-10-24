import { NextRequest } from 'next/server';
import { ADMIN_COOKIE, MFA_COOKIE } from '@/lib/admin';
import { back } from '@/lib/admin-http';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  if (!(await (await import('@/lib/admin')).hasGate())) return Response.json({ error: 'access code required' }, { status: 403 });
  const res = back(req, '/admin/login');
  res.cookies.delete(ADMIN_COOKIE);
  res.cookies.delete(MFA_COOKIE);
  return res;
}
