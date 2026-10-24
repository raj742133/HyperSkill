import { NextRequest, NextResponse } from 'next/server';
import { checkIngestToken } from '@/lib/ingest-auth';
import { migrate } from '@/lib/db';
import { storage } from '@/lib/storage';
import { latestRelease, type AppReleaseRow } from '@/lib/releases';
//#if testers
import { testerFromToken } from '@/lib/testers';
//#endif

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * The newest version, for a client's update check.
 * Same key as uploads. The client downloads straight from storage via the signed URL and checks the
 * bytes against `sha256` before installing. `{ "latest": null }` when nothing is published.
 *
 * Tester mode: with a good `X-Tester-Token` (from POST /api/app/tester) the answer also carries
 * `testing` - the newest testing build, when it is newer than the stable one - and `tester` with the
 * tester's name, so the app can offer both and let the person choose. A token that is no longer good
 * gives `tester: null`, which tells the app to leave tester mode. Phones without a token get exactly
 * what they got before.
 */
export async function GET(req: NextRequest) {
  if (!checkIngestToken(req.headers.get('authorization'))) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  await migrate();
  const store = await storage();
  const shape = async (r: AppReleaseRow) => ({
    versionCode: r.version_code,
    versionName: r.version_name,
    releaseName: r.release_name,
    notes: r.notes,
    channel: r.channel,
    url: await store.signDownload(r.object_key, 3600),
    sha256: r.sha256,
    sizeBytes: Number(r.size_bytes),
    minSdk: r.min_sdk,
    label: r.detection_model,
    publishedAt: new Date(r.published_at).toISOString(),
  });
  const r = await latestRelease();
  const out: Record<string, unknown> = { latest: r ? await shape(r) : null };
  //#if testers
  const token = req.headers.get('x-tester-token');
  if (token) {
    const tester = await testerFromToken(token);
    out.tester = tester ? { name: tester.name } : null;
    if (tester) {
      const t = await latestRelease('testing');
      out.testing = t && t.channel === 'testing' && (!r || t.version_code > r.version_code) ? await shape(t) : null;
    }
  }
  //#endif
  return NextResponse.json(out);
}
