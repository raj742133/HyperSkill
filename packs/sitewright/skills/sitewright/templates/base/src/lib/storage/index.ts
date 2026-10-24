/**
 * Where scan photographs and crops live.
 *
 * **This interface is the whole migration story.** Serverless hosts have no persistent disk and cap
 * a request body (Vercel: 4.5MB). So bytes never pass through this application: a client asks for a signed URL and PUTs
 * straight to the bucket.
 *
 * That makes the upload protocol part of the Android client, which is why the provider choice is
 * not a detail. R2 and Azure Blob are both "the server signs a URL, the client PUTs to it", so the
 * Kotlin uploader is byte-for-byte identical against either. Moving to Azure later means writing
 * one more implementation of this interface and copying the objects across - no schema change, no
 * app change, no UI change.
 *
 * Two rules keep it that way, and they are enforced everywhere in this codebase:
 *
 *  1. **The database stores KEYS, never URLs.** `sessions/<uuid>/photos/0.jpg`, never
 *     `https://<account>.r2.cloudflarestorage.com/...`. A row written today has to still resolve
 *     after the bucket moves to another continent and another vendor.
 *  2. **Nothing outside this folder imports a vendor SDK.** If `@aws-sdk` appears in a page or an
 *     API route, the abstraction has already failed.
 */

/** A signed request the client performs directly against the bucket. */
export interface SignedUpload {
  /** Where to send the bytes. */
  url: string;
  /** Always PUT for the providers used here; named so a provider needing POST can say so. */
  method: 'PUT' | 'POST';
  /** Headers the signature covers. The client must send these exactly or the signature fails. */
  headers: Record<string, string>;
  /** The key the object will have once uploaded, to be stored in Postgres. */
  key: string;
  /** When the signature stops working, as an ISO string, so a queued upload can tell that it has
   *  been sitting too long and ask for a fresh one rather than retrying into a 403. */
  expiresAt: string;
}

export interface Storage {
  /** Name of the backing provider, for the health endpoint and the log line at boot. */
  readonly provider: string;

  /**
   * A URL the Android app can PUT bytes to.
   *
   * [contentType] is signed into the request for the providers that support it, so a client that
   * later sends something else is rejected rather than quietly storing a JPEG as octet-stream.
   */
  signUpload(key: string, contentType: string): Promise<SignedUpload>;

  /**
   * A short-lived URL a browser can GET.
   *
   * Short-lived on purpose: these are private uploads, and a URL that
   * never expires is a URL that outlives the password protecting the page it came from.
   */
  signDownload(key: string, expiresInSeconds?: number): Promise<string>;

  /** Streams an object back through the server. Used only by the session ZIP, which has to read
   *  the bytes to put them in the archive. */
  get(key: string): Promise<ReadableStream<Uint8Array>>;

  /** Whether an object is actually there. The ingest endpoint uses this to refuse a manifest that
   *  references bytes the app never managed to upload, rather than creating a session whose
   *  images 404 forever. */
  exists(key: string): Promise<boolean>;

  delete(key: string): Promise<void>;
}

/** Keys are built in one place so the layout is a fact rather than a convention that drifts. */
export const keys = {
  record: (recordId: string) => `records/${recordId}/`,
  file: (recordId: string, index: number, ext = 'jpg') => `records/${recordId}/files/${index}.${ext}`,
  release: (versionCode: number, ext: string) => `releases/${versionCode}/__BRAND_SLUG__-${versionCode}${ext}`,
};

/**
 * Writes bytes from THIS server (an APK dropped on the Publishing page). The bucket answers a
 * browser with no CORS headers, so the browser cannot PUT to it directly; the server can, through
 * the same signed PUT the phones use.
 */
export async function putObject(store: Storage, key: string, body: Buffer, contentType: string): Promise<void> {
  const direct = (store as unknown as { put?: (k: string, b: Buffer) => Promise<void> }).put;
  if (typeof direct === 'function') return direct.call(store, key, body);
  const signed = await store.signUpload(key, contentType);
  const res = await fetch(signed.url, { method: signed.method, headers: signed.headers, body: new Uint8Array(body) });
  if (!res.ok) throw new Error(`storage refused the upload (${res.status})`);
}

/**
 * Rejects a key that could escape its session's prefix.
 *
 * The ingest endpoint takes keys from the app, and the app is a client like any other. Without
 * this, a crafted manifest could sign an upload over another session's photograph, or read one.
 */
export function isSafeKey(key: string, recordId: string): boolean {
  if (key.includes('..') || key.includes('//') || key.startsWith('/')) return false;
  if (!/^[A-Za-z0-9/_.-]+$/.test(key)) return false;
  return key.startsWith(keys.record(recordId));
}

let cached: Storage | null = null;

/**
 * The configured provider.
 *
 * Chosen by environment rather than by import so that a deployment can change backends without a
 * code change - which is the point of the whole file.
 */
export async function storage(): Promise<Storage> {
  if (cached) return cached;
  const provider = (process.env.STORAGE_PROVIDER ?? 'local').toLowerCase();
  switch (provider) {
    //#if s3
    case 's3': {
      const { S3Storage } = await import('./s3');
      cached = new S3Storage();
      break;
    }
    //#endif
    //#if azure
    case 'azure': {
      const { AzureStorage } = await import('./azure');
      cached = new AzureStorage();
      break;
    }
    //#endif
    case 'local': {
      const { LocalStorage } = await import('./local');
      cached = new LocalStorage();
      break;
    }
    default:
      throw new Error(
        `STORAGE_PROVIDER="${provider}" is not one of local | s3 | azure.`,
      );
  }
  return cached;
}
