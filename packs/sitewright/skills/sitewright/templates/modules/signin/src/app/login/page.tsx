import { LogoMark } from '@/components/brand/Logo';
import site from '@/content/site.json';
import { Figure, LoginBackground } from '@/components/fx';

export const dynamic = 'force-dynamic';

export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next = '__LOGIN_REDIRECT__', error } = await searchParams;
  return (
    <main className="login-wrap">
      <LoginBackground />
      <div className="login-card">
        <Figure place="signin" />
        <span className="brand-mark big"><LogoMark size={44} /></span>
        <p className="eyebrow">{site.signin.eyebrow}</p>
        <h1 className="login-title">{site.signin.title}</h1>
        <p className="muted small">{site.signin.text}</p>
        <form method="post" action="/api/login" className="login-form">
          <input type="hidden" name="next" value={next} />
          <input
            id="password"
            type="password"
            name="password"
            placeholder="Password"
            aria-label="Password"
            autoFocus
            autoComplete="current-password"
          />
          <button className="btn primary block" type="submit">Sign in</button>
        </form>
        {error ? <p className="err" role="alert">That password is not right.</p> : null}
        {/*#if landing*/}
        <p className="muted small" style={{ marginTop: 18 }}><a className="link" href="/">Back to the home page</a></p>
        {/*#endif*/}
      </div>
    </main>
  );
}
