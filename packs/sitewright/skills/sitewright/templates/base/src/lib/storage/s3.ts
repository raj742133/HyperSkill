import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { Storage, SignedUpload } from './index';

/**
 * Cloudflare R2, and anything else that speaks S3.
 *
 * R2 is S3-compatible, so this same class serves AWS S3, MinIO or a local S3 emulator by changing
 * `S3_ENDPOINT` alone. The signed-PUT shape it produces is deliberately the same shape Azure Blob's
 * SAS URLs have, so the Android uploader does not learn anything about the provider beyond "PUT
 * these bytes to this URL with these headers".
 *
 * `forcePathStyle` is on because R2 does not do virtual-host-style buckets.
 */
export class S3Storage implements Storage {
  readonly provider: string;
  private client: S3Client;
  private bucket: string;

  constructor() {
    const endpoint = required('S3_ENDPOINT');
    this.bucket = required('S3_BUCKET');
    this.provider = endpoint.includes('r2.cloudflarestorage.com') ? 'cloudflare-r2' : 's3';
    this.client = new S3Client({
      region: process.env.S3_REGION ?? 'auto',
      endpoint,
      forcePathStyle: true,
      credentials: {
        accessKeyId: required('S3_ACCESS_KEY_ID'),
        secretAccessKey: required('S3_SECRET_ACCESS_KEY'),
      },
    });
  }

  async signUpload(key: string, contentType: string): Promise<SignedUpload> {
    const expiresIn = 60 * 30; // half an hour: long enough for a queued upload on a slow connection
    const url = await getSignedUrl(
      this.client,
      new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: contentType }),
      { expiresIn },
    );
    return {
      url,
      method: 'PUT',
      // Content-Type is part of the signature, so the client MUST send exactly this.
      headers: { 'Content-Type': contentType },
      key,
      expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
    };
  }

  async signDownload(key: string, expiresInSeconds = 60 * 15): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn: expiresInSeconds },
    );
  }

  async get(key: string): Promise<ReadableStream<Uint8Array>> {
    const out = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    if (!out.Body) throw new Error(`no body for ${key}`);
    return out.Body.transformToWebStream();
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return true;
    } catch {
      return false;
    }
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}

function required(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(
      `${name} is not set. With STORAGE_PROVIDER=r2 the dashboard needs S3_ENDPOINT, ` +
        `S3_BUCKET, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY - see .env.example.`,
    );
  }
  return v;
}
