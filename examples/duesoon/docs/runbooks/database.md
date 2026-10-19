# Alert: database unhealthy or disk filling
**Meaning:** `/api/health` reports `database: "down"`, or the volume is over 80% full.
**Impact check:** can a signed-in user list assignments? Check the file exists at `DB_PATH` and is writable.
**Likely causes:** volume not mounted after a deploy (an empty database would be created: **do not let users sign up into it**); disk full; file corruption.
**Fix:** unmounted volume: stop the app, mount, restart. Disk full: free space, then `VACUUM`. Corruption: stop the app, restore the newest backup (copy it over `DB_PATH`), start, verify with a test account. Backups come from `npm run backup`; losing everything since the last backup is the accepted risk.
**Escalate when:** no usable backup exists.
