import { migrate, query } from '@/lib/db';
import { tokenHash } from '@/lib/admin';
import { AuthCard } from '@/components/admin/AuthCard';

export const dynamic = 'force-dynamic';

export default async function AdminJoin({ searchParams }: { searchParams: Promise<{ t?: string; error?: string }> }) {
  await (await import('@/lib/admin')).requireGate();
  await migrate();
  const { t = '', error } = await searchParams;
  const invite = t
    ? (await query<{ created_by: string; ok: boolean }>(
      `SELECT created_by, (used_at IS NULL AND expires_at > now() AND pending_username IS NULL) AS ok FROM admin_invites WHERE token_hash = $1 AND kind = 'invite'`,
      [tokenHash(t)],
    ))[0]
    : undefined;
  if (!invite?.ok) {
    return (
      <AuthCard step="Invite" title="This link does not work" error={error}>
        <p className="muted small">It has been used, it has expired (links last 48 hours), or it was copied only in part. Ask for a new one.</p>
      </AuthCard>
    );
  }
  return (
    <AuthCard step="Invite" title="Join __AREA__" error={error}>
      <p className="muted small">{invite.created_by} invited you to __AREA__ for __BRAND__. Choose your sign-in; the authenticator app comes next.</p>
      <form method="post" action="/api/admin/join" className="login-form">
        <input type="hidden" name="t" value={t} />
        <input name="name" placeholder="Your name" autoComplete="name" required />
        <input name="username" placeholder="Username" autoComplete="username" autoCapitalize="none" required />
        <input name="password" type="password" placeholder="Password (10+ characters)" autoComplete="new-password" minLength={10} required />
        <button className="btn primary block" type="submit">Next: authenticator app</button>
      </form>
    </AuthCard>
  );
}
