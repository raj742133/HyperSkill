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
