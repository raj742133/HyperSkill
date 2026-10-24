import { NextRequest, NextResponse } from 'next/server';
import { isSignedIn } from '@/lib/auth';
import { migrate, query } from '@/lib/db';
import { storage } from '@/lib/storage';
import site from '@/content/site.json';

export const runtime = 'nodejs';

const STATUSES: string[] = (site as { dashboard: { statuses: { id: string }[] } }).dashboard.statuses.map((s) => s.id);

type Params = { params: Promise<{ id: string }> };

/** Changes a __RECORD__'s status. For a signed-in person; the status must be one of site.json dashboard.statuses. */
export async function PATCH(req: NextRequest, { params }: Params) {
  if (!(await isSignedIn())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  await migrate();
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { status?: unknown };
  if (typeof body.status !== 'string' || !STATUSES.includes(body.status)) {
    return NextResponse.json({ error: `status must be one of ${STATUSES.join(', ')}` }, { status: 400 });
  }
  const done = await query(`UPDATE records SET status = $2 WHERE id = $1 RETURNING id`, [id, body.status]);
  if (!done.length) return NextResponse.json({ error: 'no such record' }, { status: 404 });
  return NextResponse.json({ ok: true });
}

/** Deletes a __RECORD__ and its files. For a signed-in person. */
export async function DELETE(_req: NextRequest, { params }: Params) {
  if (!(await isSignedIn())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  await migrate();
  const { id } = await params;
  const files = await query<{ object_key: string }>(`SELECT object_key FROM record_files WHERE record_id = $1`, [id]);
  const gone = await query(`DELETE FROM records WHERE id = $1 RETURNING id`, [id]);
  if (!gone.length) return NextResponse.json({ error: 'no such record' }, { status: 404 });
  const s = await storage();
  await Promise.all(files.map((f) => s.delete(f.object_key).catch(() => undefined)));
  return NextResponse.json({ ok: true });
}
