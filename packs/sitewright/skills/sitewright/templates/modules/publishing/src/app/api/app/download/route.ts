import { NextRequest, NextResponse } from 'next/server';
import { isSignedIn } from '@/lib/auth';
import { migrate } from '@/lib/db';
import { storage } from '@/lib/storage';
import { latestRelease, mimeFor } from '@/lib/releases';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * The newest APK, for a person signed in to the dashboard - the Connect page's "Get the app". It is
 * how a phone on an app older than self-updating (1.35 - 2.0.44) gets the first new version: open
 * the dashboard in the phone's browser, sign in, tap it. From then on the app updates itself.
 */
export async function GET(req: NextRequest) {
  if (!(await isSignedIn())) return NextResponse.redirect(new URL('/login?next=/connect', req.url), { status: 303 });
  await migrate();
  const r = await latestRelease();
  if (!r) return NextResponse.redirect(new URL('/connect?noapp=1', req.url), { status: 303 });
  const body = await (await storage()).get(r.object_key);
  return new NextResponse(body as unknown as BodyInit, {
    headers: {
      'Content-Type': mimeFor(r.file_name),
      'Content-Disposition': `attachment; filename="${r.file_name.replace(/"/g, '')}"`,
      'Content-Length': String(r.size_bytes),
    },
  });
}
