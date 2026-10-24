import { SCHEMA_SQL } from './schema';

/**
 * Postgres.
 *
 * Two backings behind one tiny interface, for the same reason the storage layer has three: an
 * abstraction with a single implementation is a guess, and this one had to be real before the
 * Android uploader could be tested at all.
 *
 *  - **`postgres://…`** goes to a real server through `pg` - Neon, Vercel Postgres, Supabase, or
 *    anything else. This is what production uses.
 *  - **`pglite://<dir>`, or no DATABASE_URL at all**, runs Postgres compiled to WebAssembly, in
 *    process, against a directory. No server to install, and it is genuinely Postgres rather than
 *    a SQLite lookalike - the same SQL, the same `FILTER (WHERE …)` aggregates, the same JSONB.
 *    That matters: a dev database that accepts different SQL to production is a trap.
 *
 * `pg` rather than an ORM. The whole model is a handful of tables and the interesting queries are
 * aggregations shown verbatim on the page; an ORM would add a build step and a migration framework
 * to save about forty lines of SQL.
 */

export interface Db {
  query<T = any>(text: string, params?: unknown[]): Promise<T[]>;
  /** Runs `fn` inside a transaction, rolling back if it throws. Ingest needs this: a half-written
   *  session - photographs but no detections - would render as a scan that found nothing. */
  transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T>;
  readonly kind: 'postgres' | 'pglite';
}

export interface Tx {
  query<T = any>(text: string, params?: unknown[]): Promise<T[]>;
}

let cached: Db | null = null;

function url(): string {
  return process.env.DATABASE_URL?.trim() || 'pglite://.pgdata';
}

export async function getDb(): Promise<Db> {
  if (cached) return cached;
  const dsn = url();

  if (dsn.startsWith('pglite://')) {
    const { PGlite } = await import('@electric-sql/pglite');
    // A RELATIVE directory on purpose. PGlite treats the string as a URL first, and a Windows
    // absolute path starts `C:` - which parses as a scheme and fails with a message about URLs
    // that says nothing about drive letters. Relative to cwd sidesteps it on every platform.
    const dir = dsn.slice('pglite://'.length) || '.pgdata';
    // `new` + `waitReady`, not `PGlite.create`: awaiting `create` resolves to the instance itself, and
    // `next dev` serialises awaited values for its debug stream - which walks into the WebAssembly
    // memory and answers every server-rendered page with "ArrayBuffer is not detachable".
    const pg = new PGlite({ dataDir: dir });
    await pg.waitReady;
    cached = {
      kind: 'pglite',
      async query<T>(text: string, params: unknown[] = []) {
        const res = await pg.query<T>(text, params as any[]);
        return res.rows as T[];
      },
      async transaction<T>(fn: (tx: Tx) => Promise<T>) {
        return pg.transaction(async (t) => {
          return fn({
            async query<R>(text: string, params: unknown[] = []) {
              const res = await t.query<R>(text, params as any[]);
              return res.rows as R[];
            },
          });
        }) as Promise<T>;
      },
    };
    return cached;
  }

  const { Pool } = await import('pg');
  // On Vercel each serverless instance holds its own pool, so `max` is deliberately small - a
  // dozen warm lambdas each holding twenty connections is how a free-tier Postgres runs out.
  const pool = new Pool({
    connectionString: dsn,
    max: 3,
    idleTimeoutMillis: 10_000,
    ssl: /localhost|127\.0\.0\.1/.test(dsn) ? undefined : { rejectUnauthorized: false },
  });
  cached = {
    kind: 'postgres',
    async query<T>(text: string, params: unknown[] = []) {
      return (await pool.query(text, params as any[])).rows as T[];
    },
    async transaction<T>(fn: (tx: Tx) => Promise<T>) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const out = await fn({
          async query<R>(text: string, params: unknown[] = []) {
            return (await client.query(text, params as any[])).rows as R[];
          },
        });
        await client.query('COMMIT');
        return out;
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }
    },
  };
  return cached;
}

export async function query<T = any>(text: string, params: unknown[] = []): Promise<T[]> {
  // Every read path upgrades the schema first. It used to be left to whichever page happened to
  // run first, and after a deploy that added columns, opening a session page before the list page
  // queried columns that did not exist yet. A boolean check after the first call.
  await migrate();
  return (await getDb()).query<T>(text, params);
}

let migrating: Promise<void> | null = null;

/**
 * Applies the schema. Every statement is `… IF NOT EXISTS`, so it is safe on every cold start.
 *
 * One shared promise rather than a flag: a cold start usually serves several requests at once, and
 * with a flag each of them would run the upgrade concurrently - two simultaneous CREATE TABLE IF
 * NOT EXISTS can still collide in Postgres's catalogue. A failure clears it so the next request
 * tries again instead of every request failing forever.
 */
export function migrate(): Promise<void> {
  migrating ??= runMigration().catch((e) => {
    migrating = null;
    throw e;
  });
  return migrating;
}

async function runMigration(): Promise<void> {
  const sql = SCHEMA_SQL;
  const db = await getDb();
  // PGlite runs one statement per call, so split on the semicolon-newline rather than handing it the whole file.
  for (const stmt of sql.split(/;\s*\n/).map((s) => s.trim()).filter(Boolean)) {
    await db.query(stmt);
  }
}
