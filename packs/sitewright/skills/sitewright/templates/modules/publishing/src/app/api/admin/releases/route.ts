import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { migrate, query } from '@/lib/db';
import { currentAdmin, logActivity } from '@/lib/admin';
import { keys, putObject, storage } from '@/lib/storage';
//#if parseApk
import { readApk } from '@/lib/apk';
//#endif

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EXTENSIONS: string[] = __EXTENSIONS_JSON__;
const MAX_BYTES = 200 * 1024 * 1024;
//#if parseApk
const PACKAGE = '__PACKAGE_NAME__';
//#endif

/**
 * Publishes a version: the file's bytes are the request body (the page streams the dropped file with a progress bar); the
 * release name, notes and - unless they can be read from the file - the version name and build number come as headers.
 *
 * Everything a client would trip over is refused here instead, where the person publishing can fix it: a file type that is
 * not allowed, or a build number that is not higher than every one already published.
 */
export async function POST(req: NextRequest) {
  if (!(await (await import('@/lib/admin')).hasGate())) return Response.json({ error: 'access code required' }, { status: 403 });
  await migrate();
  const admin = await currentAdmin();
  if (!admin) return NextResponse.json({ error: 'Your sign-in has expired. Sign in again.' }, { status: 401 });

  const decode = (h: string) => { try { return decodeURIComponent(req.headers.get(h) ?? ''); } catch { return ''; } };
  const rawName = decode('x-file-name');
  const ext = (rawName.match(/\.[A-Za-z0-9]+$/)?.[0] ?? '').toLowerCase();
  if (!EXTENSIONS.includes(ext)) {
    return NextResponse.json({ error: `Only ${EXTENSIONS.join(', ')} files can be published here.` }, { status: 400 });
  }

  const buf = Buffer.from(await req.arrayBuffer());
  if (buf.length === 0) return NextResponse.json({ error: 'No file arrived.' }, { status: 400 });
  if (buf.length > MAX_BYTES) return NextResponse.json({ error: 'That file is over 200 MB.' }, { status: 413 });

  let versionCode = 0;
  let versionName = '';
  let minSdk: number | null = null;
  let signer: string | null = null;
  let model: string | null = null;

  //#if parseApk
  // Android: the version, minimum SDK and signing key are read from the APK itself.
  let info;
  try {
    info = readApk(buf);
  } catch (e) {
    return NextResponse.json({ error: `Not a usable APK: ${(e as Error).message}` }, { status: 400 });
  }
  if (PACKAGE && info.packageName !== PACKAGE) {
    return NextResponse.json({ error: `This APK is ${info.packageName}, not ${PACKAGE}.` }, { status: 400 });
  }
  if (!info.signerSha256) {
    return NextResponse.json({ error: 'This APK is not signed with an APK Signature Scheme v2/v3 key. Build the release APK.' }, { status: 400 });
  }
  versionCode = info.versionCode;
  versionName = info.versionName;
  minSdk = info.minSdk;
  signer = info.signerSha256;
  model = info.meta['detection.model'] ?? null;
  //#else
  versionCode = Number(decode('x-version-code'));
  versionName = decode('x-version-name').trim().slice(0, 40);
  if (!Number.isInteger(versionCode) || versionCode < 1) return NextResponse.json({ error: 'Enter a build number (a whole number, 1 or more).' }, { status: 400 });
  if (!versionName) return NextResponse.json({ error: 'Enter a version name, like 1.4.0.' }, { status: 400 });
  //#endif

  const newest = (await query<{ version_code: number; version_name: string }>(
    `SELECT version_code, version_name FROM releases ORDER BY version_code DESC LIMIT 1`,
  ))[0];
  if (newest && versionCode <= newest.version_code) {
    return NextResponse.json({
      error: `This is ${versionName} (build ${versionCode}); ${newest.version_name} (build ${newest.version_code}) is already published. A new version needs a higher build number.`,
    }, { status: 409 });
  }
  //#if parseApk
  // An APK signed with a different key from the published ones could not be installed over them: refuse it here.
  const signerOf = (await query<{ signer_sha256: string }>(
    `SELECT signer_sha256 FROM releases WHERE signer_sha256 IS NOT NULL ORDER BY version_code DESC LIMIT 1`,
  ))[0]?.signer_sha256;
  if (signerOf && signer && signerOf !== signer) {
    return NextResponse.json({
      error: 'This APK is signed with a different key from the versions already published, so devices could not install it as an update. Build it with the release keystore.',
    }, { status: 409 });
  }
  //#endif

  const fileName = rawName.replace(/[^A-Za-z0-9._ -]+/g, '-').slice(0, 120) || `__BRAND_SLUG__-${versionName}${ext}`;
  const releaseName = decode('x-release-name').slice(0, 80);
  const notes = decode('x-notes').slice(0, 2000);
  const sha256 = createHash('sha256').update(buf).digest('hex');
  const key = keys.release(versionCode, ext);

  try {
    await putObject(await storage(), key, buf, 'application/octet-stream');
  } catch (e) {
    return NextResponse.json({ error: `Could not store the file: ${(e as Error).message}` }, { status: 502 });
  }
  await query(
    `INSERT INTO releases (version_code, version_name, release_name, notes, object_key, file_name, sha256, size_bytes,
                           min_sdk, signer_sha256, published_by, detection_model)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
    [versionCode, versionName, releaseName, notes, key, fileName, sha256, buf.length, minSdk, signer, admin.name, model],
  );
  await logActivity(admin.username, 'Published a version', `${versionName} (build ${versionCode})${releaseName ? ' - ' + releaseName : ''}`);
  return NextResponse.json({ ok: true, versionCode, versionName });
}
