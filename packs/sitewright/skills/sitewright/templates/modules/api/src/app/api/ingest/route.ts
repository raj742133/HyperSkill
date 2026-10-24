import { NextRequest, NextResponse } from 'next/server';
import { checkIngestToken } from '@/lib/ingest-auth';
import { getDb, migrate } from '@/lib/db';
import { storage, isSafeKey } from '@/lib/storage';
import type { IngestRequest } from '@/lib/contract';
import site from '@/content/site.json';

export const runtime = 'nodejs';
export const maxDuration = 60;

const STATUSES: string[] = (site as { dashboard: { statuses: { id: string }[] } }).dashboard.statuses.map((s) => s.id);

/**
 * Receives one __RECORD__.
 *
 * Small JSON only - the files went straight to storage in the step before this. What arrives here is the manifest that gives
 * them meaning.
 *
 * **Idempotent on `id`, and that is not a nicety.** Clients upload from a retrying background queue over whatever signal they
 * have, and a record gets re-sent later anyway because a person fills in a field afterwards. Both must converge on one row, so
 * this is an upsert plus a delete-and-reinsert of the children inside a transaction, rather than an append.
 */
export async function POST(req: NextRequest) {
  if (!checkIngestToken(req.headers.get('authorization'))) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: IngestRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'body is not JSON' }, { status: 400 });
  }

  const err = validate(body);
  if (err) return NextResponse.json({ error: err }, { status: 400 });

  await migrate();

  // Refuse a record whose files never arrived. A __RECORD__ whose images 404 forever is worse than a failed upload the queue
  // will retry, because it looks successful.
  const s = await storage();
  const missing: string[] = [];
  for (const f of body.files ?? []) if (!(await s.exists(f.objectKey))) missing.push(f.objectKey);
  if (missing.length) {
    return NextResponse.json({ error: 'these objects were never uploaded', missing: missing.slice(0, 10) }, { status: 409 });
  }

  const files = body.files ?? [];
  const thumb = files.find((f) => f.idx === (body.thumbIdx ?? files[0]?.idx))?.objectKey ?? null;
  const db = await getDb();
  try {
    const result = await db.transaction(async (tx) => {
      const existing = await tx.query('SELECT 1 FROM records WHERE id = $1', [body.id]);
      const updated = existing.length > 0;
      await tx.query(
        `INSERT INTO records (id, title, subtitle, status, category, owner, source, occurred_at, metrics, data, thumb_key, received_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, now())
         ON CONFLICT (id) DO UPDATE SET
           -- A later upload never blanks a field a person filled in: null keeps what is there.
           title = COALESCE(EXCLUDED.title, records.title),
           subtitle = COALESCE(EXCLUDED.subtitle, records.subtitle),
           status = EXCLUDED.status,
           category = COALESCE(EXCLUDED.category, records.category),
           owner = COALESCE(EXCLUDED.owner, records.owner),
           source = COALESCE(EXCLUDED.source, records.source),
           occurred_at = EXCLUDED.occurred_at,
           metrics = EXCLUDED.metrics,
           data = EXCLUDED.data,
           thumb_key = COALESCE(EXCLUDED.thumb_key, records.thumb_key),
           received_at = now()`,
        [
          body.id, body.title ?? null, body.subtitle ?? null, body.status ?? STATUSES[0] ?? 'new',
          body.category ?? null, body.owner ?? null, body.source ?? null,
          body.occurredAt ?? new Date().toISOString(),
          JSON.stringify(body.metrics ?? {}), JSON.stringify(body.data ?? {}), thumb,
        ],
      );
      await tx.query('DELETE FROM record_items WHERE record_id = $1', [body.id]);
      await tx.query('DELETE FROM record_files WHERE record_id = $1', [body.id]);
      for (const it of body.items ?? []) {
        await tx.query(
          `INSERT INTO record_items (id, record_id, label, status, value, note) VALUES ($1,$2,$3,$4,$5,$6)`,
          [`${body.id}:${it.id}`, body.id, it.label, it.status ?? null, it.value ?? null, it.note ?? null],
        );
      }
      for (const f of files) {
        await tx.query(
          `INSERT INTO record_files (record_id, idx, object_key, caption, bytes) VALUES ($1,$2,$3,$4,$5)`,
          [body.id, f.idx, f.objectKey, f.caption ?? null, f.bytes ?? null],
        );
      }
      return { ok: true as const, id: body.id, updated, items: (body.items ?? []).length, files: files.length };
    });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message ?? e) }, { status: 500 });
  }
}

/** Everything a client could get wrong, named precisely. A queued uploader retrying a request that can never succeed is worse
 *  than one that gives up, so the message has to say what to fix. */
function validate(b: IngestRequest): string | null {
  if (!b?.id || !/^[A-Za-z0-9_-]{8,64}$/.test(b.id)) return 'id missing or malformed (8-64 of A-Z a-z 0-9 _ -)';
  if (b.status !== undefined && !STATUSES.includes(b.status)) return `status must be one of ${STATUSES.join(', ')}`;
  if (b.occurredAt !== undefined && Number.isNaN(Date.parse(b.occurredAt))) return 'occurredAt must be an ISO timestamp';
  if (b.items !== undefined && !Array.isArray(b.items)) return 'items must be an array';
  if (b.files !== undefined && !Array.isArray(b.files)) return 'files must be an array';
  const seen = new Set<string>();
  for (const it of b.items ?? []) {
    if (!it.id) return 'every item needs an id';
    if (seen.has(it.id)) return `duplicate item id ${it.id} - ids must be unique within a record`;
    seen.add(it.id);
    if (!it.label) return `item ${it.id} has no label`;
  }
  for (const f of b.files ?? []) {
    if (typeof f.idx !== 'number') return 'every file needs a numeric idx';
    if (!isSafeKey(f.objectKey, b.id)) return `file key ${f.objectKey} is outside this record`;
  }
  return null;
}
