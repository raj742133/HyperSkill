# Rollback (plan: not yet practised)

1. Redeploy the previous image or git tag on the same volume. Schema changes are forward-only migrations; v1 has one migration (`001_init.sql`), so a rollback within v1 needs no data change.
2. If a future migration must be undone, restore the pre-deploy backup (`npm run backup` is run as the first step of every deploy) instead of editing the schema by hand.
3. After rollback: `curl /api/health`, sign in with a test account, add and delete an assignment.
Practise this once on a staging copy before relying on it: **it has not been practised**.
