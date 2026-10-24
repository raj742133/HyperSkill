import { NextRequest, NextResponse } from 'next/server';
import { isSignedIn } from '@/lib/auth';
import { storage } from '@/lib/storage';
import { query } from '@/lib/db';

export const runtime = 'nodejs';

/**
 * Serves one object to a signed-in browser.
 *
 * A redirect to a short-lived signed URL rather than proxying the bytes: a serverless function streaming megabytes is slow,
 * costs execution time, and gains nothing the bucket does not already do better.
 *
 * **The key is checked against the database, not just against a prefix.** Guessing an id is hard, but "hard to guess" is not an
 * access rule. Only keys this site actually recorded can be fetched, so a valid cookie cannot be used to walk the bucket.
 */
export async function GET(req: NextRequest) {
  if (!(await isSignedIn())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const key = req.nextUrl.searchParams.get('key');
  if (!key) return NextResponse.json({ error: 'key required' }, { status: 400 });

  const known = await query<{ n: string }>(
    `SELECT 1 AS n FROM record_files WHERE object_key = $1
     UNION ALL SELECT 1 FROM records WHERE thumb_key = $1
     LIMIT 1`,
    [key],
  );
  if (!known.length) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const s = await storage();

  // `download` turns the same link into a save-as.
  if (req.nextUrl.searchParams.get('download') === '1') {
    const body = await s.get(key);
    const stored = key.split('/').pop() ?? 'file';
    const ext = stored.includes('.') ? stored.slice(stored.lastIndexOf('.')) : '';
    const asked = (req.nextUrl.searchParams.get('name') ?? '').replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
    const name = asked ? asked.replace(/\.[A-Za-z0-9]+$/, '') + ext : stored;
    return new NextResponse(body as unknown as BodyInit, {
      headers: { 'Content-Disposition': `attachment; filename="${name}"`, 'Content-Type': 'application/octet-stream' },
    });
  }

  // `inline` serves the bytes from this origin instead of redirecting to the bucket (needed where something is drawn over an image).
  if (req.nextUrl.searchParams.get('inline') === '1') {
    const body = await s.get(key);
    const type = /\.png$/i.test(key) ? 'image/png' : /\.webp$/i.test(key) ? 'image/webp' : /\.gif$/i.test(key) ? 'image/gif' : /\.pdf$/i.test(key) ? 'application/pdf' : 'image/jpeg';
    return new NextResponse(body as unknown as BodyInit, {
      headers: { 'Content-Type': type, 'Cache-Control': 'private, max-age=600' },
    });
  }

  return NextResponse.redirect(await s.signDownload(key, 60 * 10));
}
