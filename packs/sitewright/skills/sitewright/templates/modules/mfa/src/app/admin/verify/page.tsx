import { redirect } from 'next/navigation';
import { pendingMfa } from '@/lib/admin';
import { AuthCard } from '@/components/admin/AuthCard';

export const dynamic = 'force-dynamic';

export default async function AdminVerify({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await (await import('@/lib/admin')).requireGate();
  const username = await pendingMfa();
  if (!username) redirect('/admin/login');
  const { error } = await searchParams;
  return (
    <AuthCard step="Code" title="Enter your code" error={error}>
      <p className="muted small">
        Step 2 of 2. Open your authenticator app and enter the 6-digit code for <b>__ISSUER__ ({username})</b>.
      </p>
      <form method="post" action="/api/admin/verify" className="login-form">
        <input name="code" inputMode="numeric" pattern="[0-9 ]{6,7}" maxLength={7} placeholder="123 456"
          autoComplete="one-time-code" autoFocus required className="code-input" />
        <button className="btn primary block" type="submit">Sign in</button>
      </form>
    </AuthCard>
  );
}
