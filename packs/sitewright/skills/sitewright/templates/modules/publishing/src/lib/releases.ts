import { query } from '@/lib/db';

export type Channel = 'stable' | 'testing';
export type ReleaseKind = 'new' | 'improved' | 'fixed';

export interface AppReleaseRow {
  version_code: number;
  version_name: string;
  release_name: string;
  notes: string;
  object_key: string;
  file_name: string;
  sha256: string;
  size_bytes: string | number;
  min_sdk: number | null;
  published_by: string;
  published_at: string | Date;
  hidden: boolean;
  /** The build's default detection model ("v3"), read from its manifest; null for older builds. */
  detection_model: string | null;
  /** 'stable' for everyone, 'testing' for testers only. */
  channel: Channel;
  /** Shown and downloadable on the public home page. */
  on_landing: boolean;
  kind: ReleaseKind | null;
}

/**
 * The version clients are offered on [channel]: the highest build number that is not hidden.
 * Testers see testing builds as well as stable ones, so asking for 'testing' returns the
 * newest of either.
 */
export async function latestRelease(channel: Channel = 'stable'): Promise<AppReleaseRow | null> {
  const rows = await query<AppReleaseRow>(
    channel === 'stable'
      ? `SELECT * FROM releases WHERE hidden = false AND channel = 'stable' ORDER BY version_code DESC LIMIT 1`
      : `SELECT * FROM releases WHERE hidden = false ORDER BY version_code DESC LIMIT 1`,
  );
  return rows[0] ?? null;
}

export async function allReleases(): Promise<AppReleaseRow[]> {
  return query<AppReleaseRow>(`SELECT * FROM releases ORDER BY version_code DESC`);
}

/** What the public home page may show and offer: approved, not hidden, stable (tester builds never
 *  go public), newest first. */
export async function landingReleases(): Promise<AppReleaseRow[]> {
  return query<AppReleaseRow>(
    `SELECT * FROM releases WHERE on_landing = true AND hidden = false AND channel = 'stable' ORDER BY version_code DESC`,
  );
}

/** The Content-Type for a published file, from its name. Unknown types download as plain bytes. */
export function mimeFor(fileName: string): string {
  const ext = (fileName.match(/\.[A-Za-z0-9]+$/)?.[0] ?? '').toLowerCase();
  const types: Record<string, string> = {
    '.apk': 'application/vnd.android.package-archive', '.zip': 'application/zip', '.pdf': 'application/pdf',
    '.exe': 'application/vnd.microsoft.portable-executable', '.msi': 'application/x-msi', '.dmg': 'application/x-apple-diskimage',
    '.ipa': 'application/octet-stream', '.json': 'application/json', '.txt': 'text/plain; charset=utf-8',
  };
  return types[ext] ?? 'application/octet-stream';
}
