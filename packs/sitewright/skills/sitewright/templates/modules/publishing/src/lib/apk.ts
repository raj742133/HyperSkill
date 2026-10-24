import { createHash } from 'crypto';
import { inflateRawSync } from 'zlib';

/**
 * What an Android APK says about itself, read from the file - so publishing needs nothing typed.
 *
 *  - package, versionCode, versionName, minSdk: from the binary AndroidManifest.xml inside the zip.
 *  - signer: the SHA-256 of the signing certificate, from the APK Signing Block (v2/v3). Android
 *    only installs an update signed with the same key as the app already on the phone, so the
 *    Publishing page refuses an APK signed differently from the versions before it - otherwise every
 *    phone would download it and fail at the last step.
 *
 * No dependencies: a zip's central directory and Android's binary XML are both small documented
 * formats, and this runs once per publish.
 */
export interface ApkInfo {
  packageName: string;
  versionCode: number;
  versionName: string;
  minSdk: number | null;
  signerSha256: string | null;
  /** The app's <meta-data> entries, e.g. com.example.app.BUILD_FLAVOUR -> "pro". */
  meta: Record<string, string>;
}

export function readApk(buf: Buffer): ApkInfo {
  const manifest = zipEntry(buf, 'AndroidManifest.xml');
  if (!manifest) throw new Error('not an APK: no AndroidManifest.xml inside');
  const m = parseManifest(manifest);
  return { ...m, signerSha256: signerDigest(buf) };
}

// ---- zip ------------------------------------------------------------------------------------------

function endOfCentralDirectory(buf: Buffer): number {
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 65535); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) return i;
  }
  throw new Error('not a zip file');
}

function zipEntry(buf: Buffer, wanted: string): Buffer | null {
  const eocd = endOfCentralDirectory(buf);
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('damaged zip directory');
    const method = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    if (name === wanted) {
      const lnLen = buf.readUInt16LE(local + 26);
      const lxLen = buf.readUInt16LE(local + 28);
      const start = local + 30 + lnLen + lxLen;
      const data = buf.subarray(start, start + compSize);
      if (method === 0) return Buffer.from(data);
      if (method === 8) return inflateRawSync(data);
      throw new Error(`unsupported zip compression ${method}`);
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  return null;
}

// ---- binary AndroidManifest.xml -------------------------------------------------------------------

const ATTR_IDS: Record<number, string> = {
  0x0101021b: 'versionCode',
  0x0101021c: 'versionName',
  0x0101020c: 'minSdkVersion',
  0x01010003: 'name',
  0x01010024: 'value',
};

function parseManifest(x: Buffer): Omit<ApkInfo, 'signerSha256'> {
  if (x.readUInt16LE(0) !== 0x0003) throw new Error('AndroidManifest.xml is not binary XML');
  let strings: string[] = [];
  let resIds: number[] = [];
  const out: Omit<ApkInfo, 'signerSha256'> = { packageName: '', versionCode: 0, versionName: '', minSdk: null, meta: {} };
  let p = x.readUInt16LE(2);
  while (p + 8 <= x.length) {
    const type = x.readUInt16LE(p);
    const headerSize = x.readUInt16LE(p + 2);
    const size = x.readUInt32LE(p + 4);
    if (size < 8) break;
    if (type === 0x0001) strings = stringPool(x, p);
    else if (type === 0x0180) {
      resIds = [];
      for (let i = p + headerSize; i < p + size; i += 4) resIds.push(x.readUInt32LE(i));
    } else if (type === 0x0102) {
      const tag = strings[x.readUInt32LE(p + 20)] ?? '';
      const attrStart = x.readUInt16LE(p + 24);
      const attrSize = x.readUInt16LE(p + 26);
      const attrCount = x.readUInt16LE(p + 28);
      let metaName = '';
      let metaValue = '';
      for (let a = 0; a < attrCount; a++) {
        const q = p + 16 + attrStart + a * attrSize;
        const nameIdx = x.readUInt32LE(q + 4);
        const name = ATTR_IDS[resIds[nameIdx]] ?? strings[nameIdx] ?? '';
        const raw = x.readInt32LE(q + 8);
        const dataType = x.readUInt8(q + 15);
        const data = x.readUInt32LE(q + 16);
        const str = raw >= 0 ? strings[raw] : dataType === 0x03 ? strings[data] : undefined;
        const int = dataType >= 0x10 && dataType <= 0x1f ? data : str !== undefined ? Number(str) : NaN;
        if (tag === 'manifest' && name === 'package' && str) out.packageName = str;
        if (tag === 'manifest' && name === 'versionCode' && Number.isFinite(int)) out.versionCode = int;
        if (tag === 'manifest' && name === 'versionName') out.versionName = str ?? String(int);
        if (tag === 'uses-sdk' && name === 'minSdkVersion' && Number.isFinite(int)) out.minSdk = int;
        if (tag === 'meta-data' && name === 'name' && str) metaName = str;
        if (tag === 'meta-data' && name === 'value') metaValue = str ?? (Number.isFinite(int) ? String(int) : '');
      }
      if (tag === 'meta-data' && metaName) out.meta[metaName] = metaValue;
    }
    p += size;
  }
  if (!out.packageName || !out.versionCode) throw new Error('could not read the package name and version from the APK');
  return out;
}

function stringPool(x: Buffer, p: number): string[] {
  const count = x.readUInt32LE(p + 8);
  const utf8 = (x.readUInt32LE(p + 16) & (1 << 8)) !== 0;
  const stringsStart = p + x.readUInt32LE(p + 20);
  const offsets = p + x.readUInt16LE(p + 2);
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    let s = stringsStart + x.readUInt32LE(offsets + i * 4);
    if (utf8) {
      s += x[s] & 0x80 ? 2 : 1; // length in characters
      let n = x[s];
      if (n & 0x80) { n = ((n & 0x7f) << 8) | x[s + 1]; s += 2; } else s += 1;
      out.push(x.toString('utf8', s, s + n));
    } else {
      let n = x.readUInt16LE(s);
      if (n & 0x8000) { n = ((n & 0x7fff) << 16) | x.readUInt16LE(s + 2); s += 4; } else s += 2;
      out.push(x.toString('utf16le', s, s + n * 2));
    }
  }
  return out;
}

// ---- APK Signing Block ----------------------------------------------------------------------------

/** SHA-256 of the first signer's certificate (v3 preferred, then v2), or null when the APK has no
 *  signing block (v1-only signing, which no build of this app uses). */
function signerDigest(buf: Buffer): string | null {
  const eocd = endOfCentralDirectory(buf);
  const cd = buf.readUInt32LE(eocd + 16);
  if (cd < 32 || buf.toString('latin1', cd - 16, cd) !== 'APK Sig Block 42') return null;
  const size = Number(buf.readBigUInt64LE(cd - 24));
  const start = cd - (size + 8);
  let p = start + 8;
  const found: Record<number, Buffer> = {};
  while (p < cd - 24) {
    const len = Number(buf.readBigUInt64LE(p));
    const id = buf.readUInt32LE(p + 8);
    found[id] = buf.subarray(p + 12, p + 8 + len);
    p += 8 + len;
  }
  const block = found[0xf05368c0] ?? found[0x7109871a];
  if (!block) return null;
  const lp = (b: Buffer, o: number) => b.subarray(o + 4, o + 4 + b.readUInt32LE(o));
  const signers = lp(block, 0);
  const signer = lp(signers, 0);
  const signedData = lp(signer, 0);
  const digests = lp(signedData, 0);
  const certs = lp(signedData, 4 + digests.length);
  const cert = lp(certs, 0);
  return createHash('sha256').update(cert).digest('hex');
}
