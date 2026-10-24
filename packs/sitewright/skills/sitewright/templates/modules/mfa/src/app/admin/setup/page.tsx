import { redirect } from 'next/navigation';
import { migrate } from '@/lib/db';
import { adminCount } from '@/lib/admin';
import { AuthCard } from '@/components/admin/AuthCard';

export const dynamic = 'force-dynamic';

/** Only while nobody has an account yet. The setup code is the deployment's secret, not the shared password. */
export default async function AdminSetup({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await (await import('@/lib/admin')).requireGate();
  await migrate();
  if ((await adminCount()) > 0) redirect('/admin/login');
  const { error } = await searchParams;
  return (
    <AuthCard step="First setup" title="Set up __AREA__" error={error}>
      <p className="muted small">
        Nobody has an account for __AREA__ yet. Create the first one. You need the setup code: the app
        setting <span className="mono">ADMIN_SETUP_CODE</span> of this site (set it where the site is hosted) - or, if that is not
        set, its <span className="mono">SESSION_SECRET</span>.
      </p>
      <form method="post" action="/api/admin/setup" className="login-form">
        <input name="code" type="password" placeholder="Setup code" autoComplete="off" required />
        <input name="name" placeholder="Your name" autoComplete="name" required />
        <input name="username" placeholder="Username" autoComplete="username" autoCapitalize="none" required />
        <input name="password" type="password" placeholder="Password (10+ characters)" autoComplete="new-password" minLength={10} required />
        <button className="btn primary block" type="submit">Next: authenticator app</button>
      </form>
    </AuthCard>
  );
}
