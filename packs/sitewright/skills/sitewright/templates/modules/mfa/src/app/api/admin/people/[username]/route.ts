import { NextRequest, NextResponse } from 'next/server';
import { migrate, query } from '@/lib/db';
import { currentAdmin, logActivity } from '@/lib/admin';

export const runtime = 'nodejs';

/** Removes a publisher. They are signed out at once (every request re-reads the account). */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ username: string }> }) {
  if (!(await (await import('@/lib/admin')).hasGate())) return Response.json({ error: 'access code required' }, { status: 403 });
  await migrate();
  const admin = await currentAdmin();
  if (!admin) return NextResponse.json({ error: 'sign in again' }, { status: 401 });
  const { username } = await params;
  const count = Number((await query<{ n: string }>(`SELECT COUNT(*) AS n FROM admin_users`))[0]?.n ?? 0);
  if (count <= 1) return NextResponse.json({ error: 'The last person cannot be removed - add someone first.' }, { status: 409 });
  const gone = await query<{ name: string }>(`DELETE FROM admin_users WHERE username = $1 RETURNING name`, [username]);
  if (!gone.length) return NextResponse.json({ error: 'no such person' }, { status: 404 });
  await logActivity(admin.username, 'Removed a person', gone[0].name);
  return NextResponse.json({ ok: true });
}
