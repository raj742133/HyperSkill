import { createHmac, timingSafeEqual } from 'crypto';

function secret(): string {
  const s = process.env.SESSION_SECRET || process.env.INGEST_TOKEN;
  if (!s) throw new Error('SESSION_SECRET (or INGEST_TOKEN) is not set - see .env.example.');
  return s;
}

function safeEqual(a: string, b: string): boolean {
  // timingSafeEqual throws on length mismatch, which is itself a length oracle - so compare a fixed-size digest of each.
  const ah = createHmac('sha256', secret()).update(Buffer.from(a)).digest();
  const bh = createHmac('sha256', secret()).update(Buffer.from(b)).digest();
  return timingSafeEqual(ah, bh);
}

/**
 * The client's door. Returns true when the Authorization header carries the ingest token.
 *
 * Separate from the human password on purpose: a client that carried the password would hand the site to anyone who unpacks
 * it, and rotating the password would lock every client out. They rotate independently.
 */
export function checkIngestToken(header: string | null): boolean {
  const expected = process.env.INGEST_TOKEN;
  if (!expected) throw new Error('INGEST_TOKEN is not set - see .env.example.');
  if (!header?.startsWith('Bearer ')) return false;
  return safeEqual(header.slice('Bearer '.length).trim(), expected);
}
