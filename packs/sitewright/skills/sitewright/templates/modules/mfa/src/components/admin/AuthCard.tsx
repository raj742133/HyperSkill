import type { ReactNode } from 'react';
import { LogoMark } from '@/components/brand/Logo';
import { Figure, LoginBackground } from '@/components/fx';

/**
 * The card every __AREA__ sign-in step is drawn in: sign in, code, setup, invite, authenticator.
 *
 * A plain <a>, not next/link, on purpose: a client component inside an otherwise server-rendered page makes the server stream the
 * page in Suspense pieces, and with warm browser caches the client can start hydrating before the pieces arrive - a React #418
 * hydration error, seen on ~90% of loads straight after the home page in the original dashboard. These pages need no client routing.
 */
export function AuthCard({ step, title, children, error }: { step: string; title: string; children: ReactNode; error?: string }) {
  return (
    <main className="login-wrap">
      <LoginBackground />
      <div className="login-card admin-auth">
        <Figure place="mfa" />
        <span className="brand-mark big"><LogoMark size={44} /></span>
        <p className="eyebrow">__ISSUER__ · __AREA__ · {step}</p>
        <h1 className="login-title">{title}</h1>
        {children}
        {error ? <p className="err">{error}</p> : null}
        <p className="muted small" style={{ marginTop: 18 }}><a className="link" href="/">Back to the home page</a></p>
      </div>
    </main>
  );
}
