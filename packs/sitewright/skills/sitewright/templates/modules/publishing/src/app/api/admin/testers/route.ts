import { NextRequest, NextResponse } from 'next/server';
import { migrate } from '@/lib/db';
import { currentAdmin, hasGate, logActivity } from '@/lib/admin';
import { addTester, normEmail, validEmail } from '@/lib/testers';

export const runtime = 'nodejs';

/** Add a tester. The code comes back once, here, and is never shown again (only its hash is kept). */
export async function POST(req: NextRequest) {
  if (!(await hasGate())) return NextResponse.json({ error: 'access code required' }, { status: 403 });
  await migrate();
  const admin = await currentAdmin();
  if (!admin) return NextResponse.json({ error: 'sign in again' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 80) : '';
  const email = typeof body.email === 'string' ? normEmail(body.email).slice(0, 254) : '';
  if (!name) return NextResponse.json({ error: 'Add their name.' }, { status: 400 });
  if (!validEmail(email)) return NextResponse.json({ error: 'That email does not look right.' }, { status: 400 });
  try {
    const { id, code } = await addTester(name, email, admin.username);
    await logActivity(admin.username, 'Added a tester', email);
    return NextResponse.json({ id, code });
  } catch {
    return NextResponse.json({ error: 'That email is already a tester.' }, { status: 409 });
  }
}
