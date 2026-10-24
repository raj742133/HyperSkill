import { NextRequest, NextResponse } from 'next/server';
import { checkIngestToken } from '@/lib/ingest-auth';
import { migrate } from '@/lib/db';
import { verifyTester } from '@/lib/testers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Tester mode, from the app's Settings: `{ email, code }` in, `{ token, name }` out. The app keeps
 * the token and sends it as `X-Tester-Token` with its update check. Same key as uploads.
 */
export async function POST(req: NextRequest) {
  if (!checkIngestToken(req.headers.get('authorization'))) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  await migrate();
  const body = await req.json().catch(() => ({}));
  const email = typeof body.email === 'string' ? body.email.slice(0, 254) : '';
  const code = typeof body.code === 'string' ? body.code.slice(0, 64) : '';
  if (!email || !code) return NextResponse.json({ error: 'Enter your email and tester code.' }, { status: 400 });
  const r = await verifyTester(email, code);
  if (r.ok) return NextResponse.json({ token: r.token, name: r.name });
  if (r.reason === 'locked') return NextResponse.json({ error: 'Too many tries. Wait 15 minutes, then try again.' }, { status: 429 });
  if (r.reason === 'revoked') return NextResponse.json({ error: 'Tester mode is turned off for this email. Ask the person who publishes the app.' }, { status: 403 });
  // a small fixed pause makes guessing slower still
  await new Promise((res) => setTimeout(res, 500));
  return NextResponse.json({ error: 'That email and code do not match.' }, { status: 401 });
}
