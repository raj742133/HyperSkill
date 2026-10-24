# Modules - routes, tables, env vars, flags

Flags available to `//#if` directives: every chosen module id (plus `base`, `api`), `testers`, `parseApk`, `proof`, `features`, `compat`, `faq`, `s3`, `azure`.
Directive lines (`//#if x`, `//#else`, `//#endif`, `{/*#if x*/}`) are removed from the output. `fileFlags` in `scripts/modules.mjs` writes a file only when its flag is set.

| Module | Routes | Tables | Env vars |
| --- | --- | --- | --- |
| base | `/` redirect (if no landing) | - | `DATABASE_URL`, `STORAGE_PROVIDER` (`local` / `s3` / `azure`), `LOCAL_STORAGE_DIR`, `PUBLIC_BASE_URL` |
| landing | `/` | - | `LANDING_DOWNLOAD_CODE` (optional) |
| signin | `/login`, `/api/login`, `/api/logout`, `middleware.ts` | - | `DASHBOARD_PASSWORD`, `SESSION_SECRET` |
| mfa | `/admin`, `/admin/{setup,login,verify,enroll,join,gate}`, `/api/admin/{setup,login,verify,enroll,join,gate,logout,invites,people/[username]}` | `admin_users`, `admin_invites`, `admin_activity` | `SESSION_SECRET`, `ADMIN_SETUP_CODE`, `PUBLISHING_ACCESS_CODE` (optional) |
| publishing | `/api/admin/releases[/code]`, `/api/admin/testers[/id]`, `/api/app/{latest,tester,download,public/download,public/unlock}` | `releases`, `testers` | `INGEST_TOKEN` |
| api | `/api/ingest`, `/api/uploads/sign`, `/api/file`, `/api/health`, `/api/local-storage/[...key]` | `records`, `record_items`, `record_files` | `INGEST_TOKEN` |
| dashboard | `/dashboard`, `/records/[id]`, `/api/records/[id]` (PATCH status, DELETE) | - | - |
| connect | `/connect` | - | - |
| fxgallery | `/effects` (and `/` when it is the only module) | - | - |

Authentication layers (do not merge them):
1. shared password cookie -> `/dashboard`, `/connect`, `/records/*`, `/api/file`
2. named MFA account session -> `/admin/*`, `/api/admin/*`
3. bearer `INGEST_TOKEN` -> `/api/ingest`, `/api/uploads/sign`, `/api/app/latest`
4. per-tester code -> `/api/app/tester`
The middleware's open-path list is generated from the chosen modules; a module adds the paths it needs.

Ingest contract (`src/lib/contract.ts` in the generated project is the full definition). Three steps, every one with `Authorization: Bearer <INGEST_TOKEN>`:
1. `POST /api/uploads/sign` `{ recordId, files: [{ key, contentType }] }` -> signed PUT URLs (keys must start with `records/<id>/`);
2. `PUT` the bytes to each URL with exactly the headers returned - files never pass through the app;
3. `POST /api/ingest` `{ id, title?, subtitle?, status?, category?, owner?, source?, occurredAt?, metrics?, data?, items?: [{id, label, status?, value?, note?}], files?: [{idx, objectKey, caption?}] }`.
   `id` is 8-64 of `A-Za-z0-9_-`; re-sending the same `id` updates the record, never duplicates it.

Storage drivers: `local` (dev only), `s3` (S3 / Cloudflare R2; add `"storage": {"provider": "s3"}` to the config to include the driver and its two AWS SDK packages and env vars),
`azure` (Blob over hand-signed requests, no SDK; `"storage": {"provider": "azure"}`). `STORAGE_PROVIDER` chooses at runtime and the app refuses to start on an unknown value.

Database: no `DATABASE_URL` -> embedded Postgres (PGlite) in `.pgdata`, fine for a single server; production should set a real Postgres URL. Schema is created on first request (`migrate()`), concatenated from the chosen modules' SQL.
