import { promises as fs, createReadStream } from 'fs';
import path from 'path';
import { Readable } from 'stream';
import type { Storage, SignedUpload } from './index';

/**
 * Disk, for development and for the seed script.
 *
 * Exists so the dashboard and the Android uploader can both be built and tested before anybody has
 * a Cloudflare account - and so the abstraction is proved by having more than one implementation
 * from day one. An interface with a single implementation is a guess about what varies.
 *
 * "Signing" here is not security. It hands back a plain URL to a route in this app that reads the
 * file. That route refuses to run unless STORAGE_PROVIDER is `local`, so a production deployment
 * cannot fall back into it by accident.
 */
export class LocalStorage implements Storage {
  readonly provider = 'local-disk';
  private root: string;

  constructor() {
    // Built at runtime on purpose. A literal path here makes Next's file tracer copy the whole
    // folder - real uploaded photographs - into the standalone build that gets deployed.
    const fallback = ['.', 'storage'].join('');
    this.root = path.resolve(/* turbopackIgnore: true */ process.cwd(), process.env.LOCAL_STORAGE_DIR || fallback);
  }

  private file(key: string) {
    return path.join(this.root, key);
  }

  async signUpload(key: string, contentType: string): Promise<SignedUpload> {
    await fs.mkdir(path.dirname(this.file(key)), { recursive: true });
    const base = process.env.PUBLIC_BASE_URL ?? 'http://localhost:3000';
    return {
      url: `${base}/api/local-storage/${key}`,
      method: 'PUT',
      headers: { 'Content-Type': contentType },
      key,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    };
  }

  async signDownload(key: string): Promise<string> {
    const base = process.env.PUBLIC_BASE_URL ?? 'http://localhost:3000';
    return `${base}/api/local-storage/${key}`;
  }

  async put(key: string, body: Buffer): Promise<void> {
    const f = this.file(key);
    await fs.mkdir(path.dirname(f), { recursive: true });
    await fs.writeFile(f, body);
  }

  async get(key: string): Promise<ReadableStream<Uint8Array>> {
    return Readable.toWeb(createReadStream(this.file(key))) as ReadableStream<Uint8Array>;
  }

  async exists(key: string): Promise<boolean> {
    try {
      await fs.access(this.file(key));
      return true;
    } catch {
      return false;
    }
  }

  async delete(key: string): Promise<void> {
    await fs.rm(this.file(key), { force: true });
  }
}
