import { NextRequest, NextResponse } from 'next/server';

/** A 303 back to a Publishing page, optionally with a message the page shows. */
export function back(req: NextRequest, path: string, params: Record<string, string> = {}): NextResponse {
  const url = new URL(path, req.url);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return NextResponse.redirect(url, { status: 303 });
}

export async function formOf(req: NextRequest): Promise<(k: string) => string> {
  const f = await req.formData();
  return (k: string) => String(f.get(k) ?? '').trim();
}
