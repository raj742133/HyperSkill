//#if fx_home
// A gallery-only site: the effects page is the home page.
export { default } from './effects/page';
//#else
//#if empty_home
import { SiteHeader } from '@/components/SiteHeader';

// A site with only a sign-in has nowhere to send people after they sign in, so this is the page they land on. Replace it with your own.
// (Anything you add under src/app is already behind the same sign-in.)
export default function Home() {
  return (
    <>
      <SiteHeader />
      <main className="wrap">
        <section className="hero">
          <p className="eyebrow">Signed in</p>
          <h1 className="hero-title">You are in.</h1>
          <p className="hero-sub">This site has a sign-in and nothing behind it yet. Add pages under <span className="mono">src/app</span>; they are protected by the same sign-in.</p>
        </section>
      </main>
    </>
  );
}
//#else
import { redirect } from 'next/navigation';

// Without the landing module the site has no public home page: send people to where the work is.
// (The landing module replaces this file.)
export default function Home() {
  redirect('__LOGIN_REDIRECT__');
}
//#endif
//#endif
