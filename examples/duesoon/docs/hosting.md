# Hosting plan (not deployed)

Nothing is deployed. This is a plan the owner must confirm.

**Shape of the app:** one Node 22 process, one SQLite file, sessions in process memory.
**Consequences:** exactly one instance; the database file must live on a **persistent volume**; every deploy restarts the process and **logs everyone out** (memory sessions).

| Option | Fit | Watch out for |
|---|---|---|
| A small VM or container platform that offers a persistent disk (Fly.io volumes, Render disks, a VPS) | Matches the architecture | Pick the region near the users; check the current price on the provider's page before choosing (not researched here) |
| Serverless / ephemeral-disk platforms | Does not fit: SQLite file and in-memory sessions would be lost on every deploy | Would need Postgres and a shared session store first |

Required environment variables: see `.env.example`. `SESSION_SECRET` must be unique per environment. The server refuses to start if configuration is invalid.
Staging and production must use different `DB_PATH` volumes and different `SESSION_SECRET` values.
Backups: `DB_PATH=... npm run backup` writes a consistent copy (`VACUUM INTO`); schedule it nightly and copy it off the machine. Restore = stop the app, copy the file back, start.
Budget and billing alerts: not set (no provider chosen).

## Network topology and the two settings that depend on it
Rate limits key on the client IP, so the app must be told how many proxies sit in front of it:
- **Reachable directly (no proxy):** `TRUST_PROXY=0` (default). `X-Forwarded-For` is ignored, so it cannot be used to dodge limits.
- **One platform proxy (most hosts):** `TRUST_PROXY=1`.
- **CDN plus platform proxy:** `TRUST_PROXY=2`. Too low puts all users in one bucket; too high lets a client choose its own address.
Never expose the process directly while `TRUST_PROXY>0`. `HOST` defaults to `127.0.0.1`; set `HOST=0.0.0.0` only inside a container whose published port is reachable solely through the proxy. `NODE_ENV` defaults to `production` (Secure cookie, HSTS); the cookie only travels over HTTPS, so the proxy must terminate TLS and forward `X-Forwarded-Proto`.
Rate limits and sessions are in process memory: a restart clears them (accepted, ADR 0004).
