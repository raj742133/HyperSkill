/**
 * The contract between a client (a phone app, a script, another service) and this site.
 *
 * The flow is three steps, and it is three rather than one because of a hard constraint: serverless hosts cap a request body
 * (Vercel: 4.5MB), so files never touch this application - the client PUTs them straight to storage.
 *
 * ```
 *   1. POST /api/uploads/sign   { recordId, files: [{ key, contentType }] }
 *                              -> [{ url, method, headers, key, expiresAt }]
 *   2. PUT  <url>              the raw bytes, with exactly the headers returned
 *   3. POST /api/ingest        the record below - small JSON, no files
 * ```
 *
 * Every call carries   Authorization: Bearer <INGEST_TOKEN>.
 * Step 3 is idempotent on `id`: a client that loses signal mid-queue and retries must not create four copies of one __RECORD__,
 * and a __RECORD__ re-sent later with more filled in updates the one that is there.
 */

/** Step 1 request. Keys must start with `records/<id>/` - see keys.file in lib/storage. */
export interface SignRequest {
  recordId: string;
  files: { key: string; contentType: string }[];
}

export interface ItemInput {
  /** Unique within the record. */
  id: string;
  label: string;
  /** One of the dashboard's status ids, or free text. */
  status?: string | null;
  value?: number | null;
  note?: string | null;
}

export interface FileInput {
  idx: number;
  objectKey: string;
  caption?: string | null;
  bytes?: number;
}

/** Step 3 body. */
export interface IngestRequest {
  /** Stable, client-generated: 8-64 of A-Z a-z 0-9 _ - */
  id: string;
  title?: string | null;
  subtitle?: string | null;
  /** A status id from site.json dashboard.statuses (default: the first). */
  status?: string;
  category?: string | null;
  owner?: string | null;
  source?: string | null;
  /** When it happened, ISO-8601. Default: now. */
  occurredAt?: string;
  /** Numbers the dashboard can total, named in site.json dashboard.metrics. */
  metrics?: Record<string, number>;
  /** Anything else worth showing on the detail page: label -> value. */
  data?: Record<string, string | number | boolean | null>;
  items?: ItemInput[];
  files?: FileInput[];
  /** Which file is the card's thumbnail (default: the first). */
  thumbIdx?: number;
}

export interface IngestResponse {
  ok: true;
  id: string;
  /** True when this replaced an earlier upload of the same id rather than creating one. */
  updated: boolean;
  items: number;
  files: number;
}
