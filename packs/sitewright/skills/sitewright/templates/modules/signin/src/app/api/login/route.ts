import { NextRequest, NextResponse } from 'next/server';
import { checkPassword, sessionCookie, clearCookie } from '@/lib/auth';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const password = String(form.get('password') ?? '');
  const next = String(form.get('next') ?? '/dashboard');
  // Only ever redirect within this site: `next` comes from a query string, and an open redirect on
  // a login form is how a phishing link borrows your domain.
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard';

  if (!checkPassword(password)) {
    const url = new URL('/login', req.url);
    url.searchParams.set('next', safeNext);
    url.searchParams.set('error', '1');
    return NextResponse.redirect(url, { status: 303 });
  }

  const res = NextResponse.redirect(new URL(safeNext, req.url), { status: 303 });
  const c = sessionCookie();
  res.cookies.set(c.name, c.value, c.options);
  return res;
}

export async function DELETE(req: NextRequest) {
  const res = NextResponse.redirect(new URL('/login', req.url), { status: 303 });
  res.cookies.delete(clearCookie);
  return res;
}
