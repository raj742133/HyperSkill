import { NextRequest, NextResponse } from 'next/server';
import { checkIngestToken } from '@/lib/ingest-auth';
import { query } from '@/lib/db';
import { storage } from '@/lib/storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * What a client calls when someone types this site's address into it.
 *
 * It answers the three questions "does this address work?" is really made of, separately, because each failure needs a
 * different fix and a single yes/no would leave the person guessing:
 *
 *  1. **Is this the right site at all?** `service` - a typo'd address that happens to serve a web page must not pass.
 *  2. **Is it working?** `database` and `storage` - a deployment with a missing connection string answers here but would
 *     fail every upload.
 *  3. **Will it accept this client?** `authorized` - only computed when the request carries a bearer token, and only ever
 *     reported as true/false, never echoing anything about the expected value.
 *
 * Deliberately outside the password gate (see middleware.ts): it holds no data, and a client has no password to present.
 */
export async function GET(req: NextRequest) {
  let database: 'ok' | 'error' = 'ok';
  let storageStatus: 'ok' | 'error' = 'ok';
  let provider: string | null = null;

  try {
    await query('SELECT 1');
  } catch {
    database = 'error';
  }
  try {
    provider = (await storage()).provider;
  } catch {
    storageStatus = 'error';
  }

  const header = req.headers.get('authorization');
  let authorized: boolean | null = null;
  if (header) {
    try {
      authorized = checkIngestToken(header);
    } catch {
      authorized = false;
    }
  }

  const ok = database === 'ok' && storageStatus === 'ok';
  return NextResponse.json(
    { service: '__BRAND_SLUG__-site', ok, apiVersion: 1, database, storage: storageStatus, storageProvider: provider, authorized, time: new Date().toISOString() },
    { status: ok ? 200 : 503, headers: { 'Cache-Control': 'no-store' } },
  );
}
