// The module registry. A module is a folder of files under templates/modules/<id>/ that mirrors the generated project's tree,
// plus the facts below: what it needs, what it adds to package.json / .env / the database / the sign-in gate / the header.
//
// To add a module: create templates/modules/<id>/, add an entry here, list it in SKILL.md. Nothing else knows module names.

const ADMIN_SQL = `
CREATE TABLE IF NOT EXISTS admin_users (
  username        TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  password_hash   TEXT NOT NULL,
  totp_secret     TEXT NOT NULL,
  totp_last_step  BIGINT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      TEXT NOT NULL,
  last_sign_in    TIMESTAMPTZ,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until    TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS admin_invites (
  token_hash     TEXT PRIMARY KEY,
  kind           TEXT NOT NULL CHECK (kind IN ('setup', 'invite')),
  created_by     TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at     TIMESTAMPTZ NOT NULL,
  used_at        TIMESTAMPTZ,
  pending_username TEXT,
  pending_name     TEXT,
  pending_password TEXT,
  pending_totp     TEXT
);

CREATE TABLE IF NOT EXISTS admin_activity (
  id       BIGSERIAL PRIMARY KEY,
  at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  username TEXT,
  action   TEXT NOT NULL,
  detail   TEXT NOT NULL DEFAULT '',
  ip       TEXT
);

CREATE INDEX IF NOT EXISTS admin_activity_at_idx ON admin_activity (at DESC);
`;

const RELEASES_SQL = `
CREATE TABLE IF NOT EXISTS releases (
  version_code  INTEGER PRIMARY KEY,
  version_name  TEXT NOT NULL,
  release_name  TEXT NOT NULL DEFAULT '',
  notes         TEXT NOT NULL DEFAULT '',
  object_key    TEXT NOT NULL,
  file_name     TEXT NOT NULL,
  sha256        TEXT NOT NULL,
  size_bytes    BIGINT NOT NULL,
  min_sdk       INTEGER,
  signer_sha256 TEXT,
  published_by  TEXT NOT NULL,
  published_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  hidden        BOOLEAN NOT NULL DEFAULT false,
  detection_model TEXT,
  channel       TEXT NOT NULL DEFAULT 'stable',
  on_landing    BOOLEAN NOT NULL DEFAULT false,
  kind          TEXT
);

CREATE TABLE IF NOT EXISTS testers (
  id              SERIAL PRIMARY KEY,
  name            TEXT NOT NULL,
  email           TEXT NOT NULL UNIQUE,
  code_hash       TEXT NOT NULL,
  code_set_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at      TIMESTAMPTZ,
  last_seen_at    TIMESTAMPTZ,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until    TIMESTAMPTZ
);
`;

const RECORDS_SQL = `
CREATE TABLE IF NOT EXISTS records (
  id           TEXT PRIMARY KEY,
  title        TEXT,
  subtitle     TEXT,
  status       TEXT NOT NULL DEFAULT 'new',
  category     TEXT,
  owner        TEXT,
  source       TEXT,
  occurred_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  received_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  metrics      JSONB NOT NULL DEFAULT '{}'::jsonb,
  data         JSONB NOT NULL DEFAULT '{}'::jsonb,
  thumb_key    TEXT
);

CREATE INDEX IF NOT EXISTS records_occurred_idx ON records (occurred_at DESC);

CREATE TABLE IF NOT EXISTS record_items (
  id         TEXT PRIMARY KEY,
  record_id  TEXT NOT NULL REFERENCES records(id) ON DELETE CASCADE,
  label      TEXT NOT NULL,
  status     TEXT,
  value      REAL,
  note       TEXT
);

CREATE INDEX IF NOT EXISTS record_items_record_idx ON record_items (record_id);

CREATE TABLE IF NOT EXISTS record_files (
  record_id  TEXT NOT NULL REFERENCES records(id) ON DELETE CASCADE,
  idx        INTEGER NOT NULL,
  object_key TEXT NOT NULL,
  caption    TEXT,
  bytes      INTEGER,
  PRIMARY KEY (record_id, idx)
);
`;

const env = (name, note, extra = {}) => ({ name, note, ...extra });

export const MODULES = {
  base: {
    internal: true, title: 'Design system, layout, database, storage', requires: [],
    fileFlags: { 'src/lib/storage/s3.ts': 's3', 'src/lib/storage/azure.ts': 'azure' },
    deps: { next: '^15.1.0', react: '^19.0.0', 'react-dom': '^19.0.0', pg: '^8.13.1', '@electric-sql/pglite': '^0.5.8' },
    devDeps: { typescript: '^5.7.2', '@types/node': '^22.10.0', '@types/pg': '^8.11.10', '@types/react': '^19.0.0', '@types/react-dom': '^19.0.0' },
    env: [
      env('DATABASE_URL', 'postgres://user:pass@host/db for production. Leave empty to use the built-in embedded Postgres (pglite://.pgdata).'),
      env('STORAGE_PROVIDER', 'local | s3 | azure. `local` writes under LOCAL_STORAGE_DIR and is for development only.', { dev: 'local' }),
      env('LOCAL_STORAGE_DIR', 'Where `local` storage keeps files.', { dev: '.storage' }),
      env('PUBLIC_BASE_URL', "The site's public address (used in links the site hands out). Leave empty in development.", { dev: '' }),
    ],
  },
  landing: {
    title: 'Landing page', requires: [], optionalWith: ['publishing'],
    summary: 'Public home page: animated hero (dotted territory canvas + a mark that draws itself and turns into a road), scroll story with a phone mock-up, proof bars + flip numbers, feature board, compatibility timeline, call to action, release list, FAQ, footer.',
    deps: { lenis: '^1.3.26', qrcode: '^1.5.4' }, devDeps: { '@types/qrcode': '^1.5.5' },
    open: ['/', '/api/app/public/'],
    env: [env('LANDING_DOWNLOAD_CODE', 'Optional team code asked once before a download from the home page. Empty = downloads are open.')],
  },
  signin: {
    title: 'Sign-in (shared password)', requires: [],
    summary: 'A password gate in front of the private pages: sign-in card, signed 30-day cookie, constant-time compare, safe redirect, middleware.',
    open: ['/login', '/api/login'], gate: true,
    env: [env('DASHBOARD_PASSWORD', 'What people type to open the private pages.', { dev: '@password' }), env('SESSION_SECRET', 'Long random string that signs cookies. `openssl rand -hex 32`.', { dev: '@secret' })],
  },
  mfa: {
    title: 'Authenticator accounts (MFA)', requires: [],
    summary: 'Named accounts with scrypt passwords and TOTP authenticator codes (RFC 6238): first-run setup with a setup code, invite links, QR enrolment, replay-proof codes, 5-try lockout, optional access-code gate, activity log.',
    deps: { qrcode: '^1.5.4' }, devDeps: { '@types/qrcode': '^1.5.5' },
    open: ['/admin', '/api/admin'], schema: ADMIN_SQL,
    env: [
      env('SESSION_SECRET', 'Signs the account cookies.', { dev: '@secret' }),
      env('ADMIN_SETUP_CODE', 'Needed once, to create the first account. Falls back to SESSION_SECRET when empty.', { dev: '@setup' }),
      env('PUBLISHING_ACCESS_CODE', 'Optional first lock: a code asked before any /admin page. Empty = no extra lock.'),
    ],
  },
  publishing: {
    title: 'Publishing (versions, notes, channels, testers)', requires: ['mfa'],
    summary: 'Signed-in publishers upload a file (or an Android APK, read for its version and signature), name it, write release notes in a Tiptap editor, choose a channel and whether it is on the home page; a version list with hide/show/delete; people; testers with codes; update-check API.',
    deps: { '@tiptap/extension-character-count': '^3.31.3', '@tiptap/extension-placeholder': '^3.31.3', '@tiptap/pm': '^3.31.3', '@tiptap/react': '^3.31.3', '@tiptap/starter-kit': '^3.31.3' },
    open: ['/api/app/public/', '/api/app/latest', '/api/app/tester'], schema: RELEASES_SQL,
    // a file is only written when its flag is set (flags: module ids, plus testers, parseApk, proof, features, compat, faq, s3, azure)
    fileFlags: {
      'src/app/api/app/download/route.ts': 'signin',
      'src/lib/apk.ts': 'parseApk',
      'src/lib/testers.ts': 'testers',
      'src/components/admin/Testers.tsx': 'testers',
      'src/app/api/admin/testers/route.ts': 'testers',
      'src/app/api/admin/testers/[id]/route.ts': 'testers',
      'src/app/api/app/tester/route.ts': 'testers',
    },
    env: [env('INGEST_TOKEN', 'Bearer key the client app sends to check for updates.', { dev: '@token' })],
  },
  api: {
    internal: true, title: 'Ingest, signed uploads, file serving, health', requires: [],
    open: ['/api/ingest', '/api/uploads', '/api/health', '/api/local-storage'], schema: RECORDS_SQL,
    fileFlags: { 'src/app/api/file/route.ts': 'signin' },
    env: [env('INGEST_TOKEN', 'Bearer key a phone/app/script sends to /api/ingest. Different from the password.', { dev: '@token' })],
  },
  dashboard: {
    title: 'Dashboard (records)', requires: ['signin', 'api'],
    summary: 'Stat cards, filter chips, search, facet selects and a card grid of records with thumbnails and status flags; a detail page with facts, a photo/file gallery, line items and one-click status changes. Fed by /api/ingest.',
  },
  fxgallery: {
    title: 'Effects gallery', requires: [],
    summary: 'A /effects page: every animated background, headline animation, button and card effect running live on a sample hero, with a colour picker and the exact effects config to paste into site.json.',
    open: ['/effects'],
  },
  connect: {
    title: 'Connect a phone / client', requires: ['signin', 'api'],
    summary: 'A page that shows the one link (address + #key=) to paste into the client, a copy button, a curl example and the latest download.',
  },
};

/** Expands `wanted` with everything it requires, base first, in a stable order. */
export function resolveModules(wanted) {
  const order = ['base', 'api', 'signin', 'mfa', 'publishing', 'landing', 'dashboard', 'connect', 'fxgallery'];
  const set = new Set(['base']);
  const add = (id) => {
    if (!MODULES[id]) throw new Error(`Unknown module "${id}". Known: ${Object.keys(MODULES).filter((k) => !MODULES[k].internal).join(', ')}`);
    if (set.has(id)) return;
    set.add(id);
    for (const r of MODULES[id].requires) add(r);
  };
  wanted.forEach(add);
  // `api` is internal: pulled in by dashboard/connect/publishing (publishing's update check uses the ingest key).
  if (set.has('publishing') || set.has('dashboard') || set.has('connect')) set.add('api');
  return order.filter((id) => set.has(id));
}
