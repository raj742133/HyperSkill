# Alert: app down
**Meaning:** `/api/health/live` is not answering. **Impact check:** open the site; try the live URL from another network.
**Likely causes:** process crashed or was OOM-killed; failed deploy; invalid configuration (the server exits with `Invalid configuration:` and names the variable); the migration step failed (`Migration NNN failed`).
**Fix:** read the last 50 log lines; if configuration or migration, fix and redeploy; if a bad release, follow `rollback.md`; otherwise restart the process. Remember: restarting logs every user out (memory sessions).
**Escalate when:** the database file is missing or corrupt: go to `database.md` and restore the latest backup.
