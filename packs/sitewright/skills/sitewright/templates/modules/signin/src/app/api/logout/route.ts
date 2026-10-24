import { NextRequest, NextResponse } from 'next/server';
import { clearCookie } from '@/lib/auth';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const res = NextResponse.redirect(new URL('/login', req.url), { status: 303 });
  res.cookies.delete(clearCookie);
  return res;
}
