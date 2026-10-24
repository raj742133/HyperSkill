import { NextRequest, NextResponse } from 'next/server';
import { migrate, query } from '@/lib/db';
import { INVITE_HOURS, currentAdmin, logActivity, newToken, tokenHash } from '@/lib/admin';

export const runtime = 'nodejs';

/** A one-use link that lets one more person set up a publishing account. Valid for 48 hours. */
export async function POST(req: NextRequest) {
  if (!(await (await import('@/lib/admin')).hasGate())) return Response.json({ error: 'access code required' }, { status: 403 });
  await migrate();
  const admin = await currentAdmin();
  if (!admin) return NextResponse.json({ error: 'sign in again' }, { status: 401 });
  const token = newToken();
  await query(
    `INSERT INTO admin_invites (token_hash, kind, created_by, expires_at) VALUES ($1, 'invite', $2, now() + ($3 || ' hours')::interval)`,
    [tokenHash(token), admin.name, String(INVITE_HOURS)],
  );
  await logActivity(admin.username, 'Created an invite link');
  const base = process.env.PUBLIC_BASE_URL?.replace(/\/+$/, '') ?? new URL(req.url).origin;
  return NextResponse.json({ url: `${base}/admin/join?t=${token}`, hours: INVITE_HOURS });
}
