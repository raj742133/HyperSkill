import { NextRequest, NextResponse } from 'next/server';
import { codeMatches, gateEnabled, UNLOCK_COOKIE, unlockValue } from '@/lib/landing-gate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Checks the team code from the home page's dialog and, if it is right, remembers it for 30 days. */
export async function POST(req: NextRequest) {
  if (!gateEnabled()) return NextResponse.json({ ok: true });
  const body = (await req.json().catch(() => ({}))) as { code?: unknown };
  const code = typeof body.code === 'string' ? body.code.slice(0, 64) : '';
  if (!code || !codeMatches(code)) {
    // A small, fixed pause so guessing is slow; the code is long enough that this is enough.
    await new Promise((r) => setTimeout(r, 600));
    return NextResponse.json({ ok: false, error: 'That code is not right.' }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(UNLOCK_COOKIE, unlockValue(), {
    httpOnly: true, sameSite: 'lax', secure: req.nextUrl.protocol === 'https:', path: '/', maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
