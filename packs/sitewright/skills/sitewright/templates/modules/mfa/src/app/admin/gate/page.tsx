import { redirect } from 'next/navigation';
import { AuthCard } from '@/components/admin/AuthCard';

export const dynamic = 'force-dynamic';

/** First lock on __AREA__: only people given the access code get as far as signing in. */
export default async function AdminGate({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const configured = !!process.env.PUBLISHING_ACCESS_CODE;
  if (!configured) redirect('/admin');
  return (
    <AuthCard step="Access" title="__AREA__ is restricted" error={error}>
      {configured ? (
        <>
          <p className="muted small">Enter the __AREA__ access code. The shared password is not enough to open this area.</p>
          <form method="post" action="/api/admin/gate" className="login-form">
            <input name="code" type="password" placeholder="Access code" autoComplete="off" autoFocus required />
            <button className="btn primary block" type="submit">Continue</button>
          </form>
        </>
      ) : (
        <p className="muted small">This area has no access code set (<span className="mono">PUBLISHING_ACCESS_CODE</span>).</p>
      )}
    </AuthCard>
  );
}
