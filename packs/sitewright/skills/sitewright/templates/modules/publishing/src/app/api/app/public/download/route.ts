import { NextRequest, NextResponse } from 'next/server';
import { migrate } from '@/lib/db';
import { storage } from '@/lib/storage';
import { landingReleases, mimeFor } from '@/lib/releases';
import { isUnlocked } from '@/lib/landing-gate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * An APK from the public home page. Only builds approved for the home page on the Publishing page
 * (on_landing, not hidden) can be fetched here; `?v=` picks one, and without it the newest is sent.
 */
export async function GET(req: NextRequest) {
  if (!(await isUnlocked())) return NextResponse.redirect(new URL('/?unlock=1#get', req.url), { status: 303 });
  await migrate();
  const list = await landingReleases();
  const v = Number(req.nextUrl.searchParams.get('v'));
  const r = Number.isFinite(v) && v > 0 ? list.find((x) => x.version_code === v) : list[0];
  if (!r) return NextResponse.json({ error: 'That version is not available.' }, { status: 404 });
  const body = await (await storage()).get(r.object_key);
  return new NextResponse(body as unknown as BodyInit, {
    headers: {
      'Content-Type': mimeFor(r.file_name),
      'Content-Disposition': `attachment; filename="${r.file_name.replace(/"/g, '')}"`,
      'Content-Length': String(r.size_bytes),
      'Cache-Control': 'no-store',
    },
  });
}
