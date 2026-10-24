import { NextRequest, NextResponse } from 'next/server';
import { checkIngestToken } from '@/lib/ingest-auth';
import { storage, isSafeKey } from '@/lib/storage';
import type { SignRequest } from '@/lib/contract';

export const runtime = 'nodejs';

/** How many objects one call may sign. Anything far past a few dozen is a client bug or someone probing. */
const MAX_FILES = 200;

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf', 'text/plain', 'application/json']);

/**
 * Hands the client URLs to PUT bytes to.
 *
 * Every key is checked against the record it claims to belong to. Without that, a caller holding a valid token could sign an
 * upload over another record's file - the token authorises uploading, not uploading anywhere.
 */
export async function POST(req: NextRequest) {
  if (!checkIngestToken(req.headers.get('authorization'))) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: SignRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'body is not JSON' }, { status: 400 });
  }

  const { recordId, files } = body ?? {};
  if (!recordId || !/^[A-Za-z0-9_-]{8,64}$/.test(recordId)) {
    return NextResponse.json({ error: 'recordId missing or malformed' }, { status: 400 });
  }
  if (!Array.isArray(files) || files.length === 0) {
    return NextResponse.json({ error: 'files must be a non-empty array' }, { status: 400 });
  }
  if (files.length > MAX_FILES) {
    return NextResponse.json({ error: `at most ${MAX_FILES} files per call` }, { status: 400 });
  }

  for (const f of files) {
    if (!f?.key || !isSafeKey(f.key, recordId)) {
      return NextResponse.json({ error: `key ${f?.key ?? '(missing)'} is not inside records/${recordId}/` }, { status: 400 });
    }
    if (!ALLOWED.has(f.contentType)) {
      return NextResponse.json({ error: `contentType ${f.contentType} not allowed` }, { status: 400 });
    }
  }

  const s = await storage();
  const signed = await Promise.all(files.map((f) => s.signUpload(f.key, f.contentType)));
  return NextResponse.json(signed);
}
