import Link from 'next/link';
import { LogoMark } from './brand/Logo';
import { ThemeToggle } from './ThemeToggle';
import { Icon } from './icons/Icon';
import nav from '@/content/nav.json';

/**
 * The bar every signed-in page shares: the mark, the places there are, theme, and sign out.
 * The places come from src/content/nav.json, which Sitewright writes from the modules you chose.
 */
export function SiteHeader({ active, signOut = '__SIGN_OUT__', sub = '__AREA_LOWER_NAV__' }: {
  active?: string;
  /** The admin area has its own accounts, so its Sign out ends that session instead. */
  signOut?: string;
  sub?: string;
}) {
  return (
    <header className="site">
      <div className="site-inner">
        <Link href={nav.homeAfterLogin} className="brand" aria-label="__BRAND__">
          <span className="brand-mark"><LogoMark /></span>
          <span className="brand-t">__BRAND__ <span>{sub}</span></span>
        </Link>
        <nav aria-label="Main">
          {(nav.items as { id: string; href: string; label: string; icon?: string }[]).map((i) => (
            <Link key={i.id} href={i.href} className={active === i.id ? 'on' : ''}><Icon name={i.icon} className="nav-ic" />{i.label}</Link>
          ))}
        </nav>
        <div className="head-actions">
          <ThemeToggle />
          {signOut ? (
            <form method="post" action={signOut}>
              <button className="btn" type="submit">Sign out</button>
            </form>
          ) : null}
        </div>
      </div>
    </header>
  );
}
