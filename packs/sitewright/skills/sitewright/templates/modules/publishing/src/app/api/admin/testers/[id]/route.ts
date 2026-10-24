import { NextRequest, NextResponse } from 'next/server';
import { migrate, query } from '@/lib/db';
import { currentAdmin, hasGate, logActivity } from '@/lib/admin';
import { deleteTester, resetCode, setRevoked } from '@/lib/testers';

export const runtime = 'nodejs';

type Params = { params: Promise<{ id: string }> };

async function guard(params: Params['params']) {
  if (!(await hasGate())) return { error: NextResponse.json({ error: 'access code required' }, { status: 403 }) };
  await migrate();
  const admin = await currentAdmin();
  if (!admin) return { error: NextResponse.json({ error: 'sign in again' }, { status: 401 }) };
  const id = Number((await params).id);
  const row = (await query<{ email: string }>(`SELECT email FROM testers WHERE id = $1`, [id]))[0];
  if (!row) return { error: NextResponse.json({ error: 'no such tester' }, { status: 404 }) };
  return { admin, id, email: row.email };
}

/** { action: 'revoke' | 'restore' | 'new-code' }. A new code comes back once. */
export async function PATCH(req: NextRequest, { params }: Params) {
  const g = await guard(params);
  if ('error' in g) return g.error;
  const body = await req.json().catch(() => ({}));
  if (body.action === 'revoke' || body.action === 'restore') {
    await setRevoked(g.id, body.action === 'revoke');
    await logActivity(g.admin.username, body.action === 'revoke' ? 'Turned off a tester' : 'Turned a tester back on', g.email);
    return NextResponse.json({ ok: true });
  }
  if (body.action === 'new-code') {
    const code = await resetCode(g.id);
    await logActivity(g.admin.username, 'Gave a tester a new code', g.email);
    return NextResponse.json({ code });
  }
  return NextResponse.json({ error: 'unknown action' }, { status: 400 });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const g = await guard(params);
  if ('error' in g) return g.error;
  await deleteTester(g.id);
  await logActivity(g.admin.username, 'Removed a tester', g.email);
  return NextResponse.json({ ok: true });
}
