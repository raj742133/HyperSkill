import { redirect } from 'next/navigation';
import { migrate } from '@/lib/db';
import { adminCount, currentAdmin } from '@/lib/admin';
import { AuthCard } from '@/components/admin/AuthCard';

export const dynamic = 'force-dynamic';

export default async function AdminLogin({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await (await import('@/lib/admin')).requireGate();
  await migrate();
  if (await currentAdmin()) redirect('/admin');
  if ((await adminCount()) === 0) redirect('/admin/setup');
  const { error } = await searchParams;
  return (
    <AuthCard step="Sign in" title="__AREA__ sign-in" error={error}>
      <p className="muted small">For the people who manage __BRAND__. Step 1 of 2.</p>
      <form method="post" action="/api/admin/login" className="login-form">
        <input name="username" placeholder="Username" autoComplete="username" autoCapitalize="none" autoFocus required />
        <input name="password" type="password" placeholder="Password" autoComplete="current-password" required />
        <button className="btn primary block" type="submit">Continue</button>
      </form>
    </AuthCard>
  );
}
