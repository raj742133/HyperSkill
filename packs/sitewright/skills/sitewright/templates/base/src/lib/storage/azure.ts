import type { Storage, SignedUpload } from './index';
import { createHmac } from 'crypto';

/**
 * Azure Blob Storage, signed with a user-delegation-free account-key SAS.
 *
 * **Written now, on purpose, although R2 is what runs today.** The reason this project uses signed
 * PUT URLs at all is that the Android app uploads straight to the bucket, so the upload protocol
 * leaks into the Kotlin client - and the cost of discovering on migration day that the new provider
 * speaks a different protocol is a rewrite of the app, a new release, and every phone in the field
 * needing an update. Having the Azure path exist and produce the same [SignedUpload] shape as the
 * S3 one is what makes "flip an env var" true rather than aspirational.
 *
 * No `@azure/storage-blob` dependency: a service SAS is an HMAC over a documented string, and
 * pulling in a large SDK to build one URL would add weight to every serverless cold start for a
 * provider that is not yet in use.
 *
 * To switch: set STORAGE_PROVIDER=azure, AZURE_ACCOUNT, AZURE_CONTAINER, AZURE_KEY, then copy the
 * objects across (`azcopy copy` handles R2 as an S3 source). Nothing in Postgres changes, because
 * rows hold keys rather than URLs, and nothing in the Android app changes, because it is still
 * "PUT these bytes to this URL with these headers".
 */
export class AzureStorage implements Storage {
  readonly provider = 'azure-blob';
  private account: string;
  private container: string;
  private key: Buffer;

  constructor() {
    this.account = required('AZURE_ACCOUNT');
    this.container = required('AZURE_CONTAINER');
    this.key = Buffer.from(required('AZURE_KEY'), 'base64');
  }

  /**
   * Where the container lives. Defaults to the public Azure endpoint; AZURE_BLOB_ENDPOINT overrides
   * it for Azurite (the local emulator, `http://127.0.0.1:10000/devstoreaccount1`) or a sovereign
   * cloud. The emulator is what this class was tested against before anyone deployed it.
   */
  private base(key: string) {
    const endpoint = (process.env.AZURE_BLOB_ENDPOINT ?? `https://${this.account}.blob.core.windows.net`)
      .replace(/\/+$/, '');
    return `${endpoint}/${this.container}/${key}`;
  }

  /** A service SAS. `permissions` is Azure's single-letter set: `w` to write, `r` to read. */
  private sas(key: string, permissions: string, expiresInSeconds: number): string {
    const now = new Date(Date.now() - 5 * 60 * 1000); // clock skew allowance
    const expiry = new Date(Date.now() + expiresInSeconds * 1000);
    const iso = (d: Date) => d.toISOString().replace(/\.\d+Z$/, 'Z');
    const version = '2021-08-06';
    const canonical = `/blob/${this.account}/${this.container}/${key}`;

    // Field order is defined by the service version and is not negotiable.
    const toSign = [
      permissions, iso(now), iso(expiry), canonical,
      '', '', '', version, 'b',
      '', '', '', '', '', '', '',
    ].join('\n');

    const sig = createHmac('sha256', this.key).update(toSign, 'utf8').digest('base64');
    const q = new URLSearchParams({
      sv: version, sr: 'b', sp: permissions,
      st: iso(now), se: iso(expiry), sig,
    });
    return q.toString();
  }

  async signUpload(key: string, contentType: string): Promise<SignedUpload> {
    const expiresIn = 60 * 30;
    return {
      url: `${this.base(key)}?${this.sas(key, 'cw', expiresIn)}`,
      method: 'PUT',
      // The one Azure-specific header. It is a constant, not a signature input, so the Kotlin
      // client simply sends whatever headers the server hands it - which is why it needs no
      // per-provider branch.
      headers: { 'Content-Type': contentType, 'x-ms-blob-type': 'BlockBlob' },
      key,
      expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
    };
  }

  async signDownload(key: string, expiresInSeconds = 60 * 15): Promise<string> {
    return `${this.base(key)}?${this.sas(key, 'r', expiresInSeconds)}`;
  }

  async get(key: string): Promise<ReadableStream<Uint8Array>> {
    const res = await fetch(await this.signDownload(key, 300));
    if (!res.ok || !res.body) throw new Error(`azure get ${key}: ${res.status}`);
    return res.body;
  }

  async exists(key: string): Promise<boolean> {
    const res = await fetch(await this.signDownload(key, 300), { method: 'HEAD' });
    return res.ok;
  }

  async delete(key: string): Promise<void> {
    await fetch(`${this.base(key)}?${this.sas(key, 'd', 300)}`, { method: 'DELETE' });
  }
}

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set (STORAGE_PROVIDER=azure needs it) - see .env.example.`);
  return v;
}
