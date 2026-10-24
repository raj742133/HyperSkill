import { NextRequest, NextResponse } from 'next/server';
import { migrate, query } from '@/lib/db';
import { currentAdmin, logActivity } from '@/lib/admin';
import { storage } from '@/lib/storage';
import { mimeFor } from '@/lib/releases';

export const runtime = 'nodejs';

type Params = { params: Promise<{ code: string }> };

/** The version's file, for a signed-in publisher - the Publishing page's Download button. Hidden and
 *  testing versions too, since this is how the team gets any build onto a device by hand. */
export async function GET(_req: NextRequest, { params }: Params) {
  if (!(await (await import('@/lib/admin')).hasGate())) return Response.json({ error: 'access code required' }, { status: 403 });
  await migrate();
  if (!(await currentAdmin())) return NextResponse.json({ error: 'sign in again' }, { status: 401 });
  const code = Number((await params).code);
  const r = (await query<{ object_key: string; version_name: string; size_bytes: string | number; file_name: string }>(
    `SELECT object_key, version_name, size_bytes, file_name FROM releases WHERE version_code = $1`, [code]))[0];
  if (!r) return NextResponse.json({ error: 'no such version' }, { status: 404 });
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

/** Rename, re-note, hide or show a published version, set its channel and home-page visibility.
 *  Hidden versions are never offered to phones. */
export async function PATCH(req: NextRequest, { params }: Params) {
  if (!(await (await import('@/lib/admin')).hasGate())) return Response.json({ error: 'access code required' }, { status: 403 });
  await migrate();
  const admin = await currentAdmin();
  if (!admin) return NextResponse.json({ error: 'sign in again' }, { status: 401 });
  const code = Number((await params).code);
  const body = await req.json().catch(() => ({}));
  const row = (await query<{ version_name: string }>(`SELECT version_name FROM releases WHERE version_code = $1`, [code]))[0];
  if (!row) return NextResponse.json({ error: 'no such version' }, { status: 404 });
  if (typeof body.hidden === 'boolean') {
    await query(`UPDATE releases SET hidden = $2 WHERE version_code = $1`, [code, body.hidden]);
    await logActivity(admin.username, body.hidden ? 'Hid a version' : 'Showed a version', row.version_name);
  }
  // Who it is for, and whether the public home page offers it (30 Sept 2026).
  if (body.channel === 'stable' || body.channel === 'testing') {
    await query(`UPDATE releases SET channel = $2 WHERE version_code = $1`, [code, body.channel]);
    await logActivity(admin.username, body.channel === 'testing' ? 'Moved a version to testing' : 'Made a version stable', row.version_name);
  }
  if (typeof body.onLanding === 'boolean') {
    await query(`UPDATE releases SET on_landing = $2 WHERE version_code = $1`, [code, body.onLanding]);
    await logActivity(admin.username, body.onLanding ? 'Showed a version on the home page' : 'Took a version off the home page', row.version_name);
  }
  if (body.kind === null || body.kind === 'new' || body.kind === 'improved' || body.kind === 'fixed') {
    await query(`UPDATE releases SET kind = $2 WHERE version_code = $1`, [code, body.kind]);
  }
  if (typeof body.releaseName === 'string' || typeof body.notes === 'string') {
    await query(
      `UPDATE releases SET release_name = COALESCE($2, release_name), notes = COALESCE($3, notes) WHERE version_code = $1`,
      [code, typeof body.releaseName === 'string' ? body.releaseName.slice(0, 80) : null,
        typeof body.notes === 'string' ? body.notes.slice(0, 2000) : null],
    );
    await logActivity(admin.username, 'Edited notes', row.version_name);
  }
  return NextResponse.json({ ok: true });
}

/** Removes a version and its file. Phones that installed it keep it. */
export async function DELETE(_req: NextRequest, { params }: Params) {
  if (!(await (await import('@/lib/admin')).hasGate())) return Response.json({ error: 'access code required' }, { status: 403 });
  await migrate();
  const admin = await currentAdmin();
  if (!admin) return NextResponse.json({ error: 'sign in again' }, { status: 401 });
  const code = Number((await params).code);
  const gone = await query<{ version_name: string; object_key: string }>(
    `DELETE FROM releases WHERE version_code = $1 RETURNING version_name, object_key`, [code],
  );
  if (!gone.length) return NextResponse.json({ error: 'no such version' }, { status: 404 });
  await (await storage()).delete(gone[0].object_key).catch(() => undefined);
  await logActivity(admin.username, 'Deleted a version', gone[0].version_name);
  return NextResponse.json({ ok: true });
}
