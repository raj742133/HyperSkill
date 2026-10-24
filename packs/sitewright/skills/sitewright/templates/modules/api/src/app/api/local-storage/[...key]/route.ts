import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export const runtime = 'nodejs';

/**
 * Serves and accepts objects when STORAGE_PROVIDER is `local`.
 *
 * Development and seeding only. It refuses to run under any other provider so a misconfigured
 * deployment cannot quietly start writing your files onto an ephemeral
 * serverless filesystem, where they would be both unprotected and gone at the next cold start.
 */
function root(): string {
  // Built at runtime, like LocalStorage's: a literal '.storage' here made Next's file tracer copy
  // the folder's photographs into the deployable standalone build.
  const fallback = ['.', 'storage'].join('');
  return path.resolve(process.cwd(), process.env.LOCAL_STORAGE_DIR || fallback);
}

function resolve(parts: string[]): string | null {
  const base = root();
  const full = path.resolve(base, parts.join('/'));
  // Containment check after resolution, so `..` cannot walk out of the storage directory.
  return full.startsWith(base + path.sep) || full === base ? full : null;
}

function guard(): NextResponse | null {
  if ((process.env.STORAGE_PROVIDER ?? 'local').toLowerCase() !== 'local') {
    return NextResponse.json({ error: 'local storage is not enabled' }, { status: 404 });
  }
  return null;
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ key: string[] }> }) {
  const blocked = guard();
  if (blocked) return blocked;

  const { key } = await ctx.params;
  const file = resolve(key);
  if (!file) return NextResponse.json({ error: 'bad key' }, { status: 400 });

  try {
    const bytes = await fs.readFile(file);
    const ext = path.extname(file).toLowerCase();
    const type =
      ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg'
      : ext === '.png' ? 'image/png'
      : ext === '.json' ? 'application/json'
      : ext === '.jsonl' ? 'application/x-ndjson'
      : 'text/plain; charset=utf-8';
    // Buffered rather than streamed on purpose. This route only runs in development, the objects
    // are a few megabytes, and a Node stream handed to Next's fetch response was stalling the
    // request. Production never reaches here: it redirects to a signed bucket URL.
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        'Content-Type': type,
        'Content-Length': String(bytes.length),
        'Cache-Control': 'private, max-age=300',
      },
    });
  } catch {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ key: string[] }> }) {
  const blocked = guard();
  if (blocked) return blocked;

  const { key } = await ctx.params;
  const file = resolve(key);
  if (!file) return NextResponse.json({ error: 'bad key' }, { status: 400 });

  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, Buffer.from(await req.arrayBuffer()));
  return new NextResponse(null, { status: 200 });
}
