import Link from 'next/link';
import { Figure } from '@/components/fx';

/** The page for an address that is not here. A figure can sit on it (effects.figures.notfound); without one it is just the card. */
export default function NotFound() {
  return (
    <main className="login-wrap">
      <div className="login-card" style={{ textAlign: 'center' }}>
        <Figure place="notfound" />
        <p className="eyebrow">404</p>
        <h1 className="login-title">That page is not here.</h1>
        <p className="muted small">The address may be mistyped, or the page may have moved.</p>
        <Link className="btn primary" href="/" style={{ marginTop: 14 }}>Back to the start</Link>
      </div>
    </main>
  );
}
