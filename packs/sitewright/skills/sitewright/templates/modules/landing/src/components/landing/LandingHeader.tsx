'use client';

import { useEffect, useState } from 'react';
import { LogoMark } from '../brand/Logo';
import { ThemeToggle } from '../ThemeToggle';

/** Clear over the hero, solid once the page moves. A sheet takes the links on a phone. */
export function LandingHeader({ nav, action }: { nav: [string, string][]; action: { label: string; href: string } }) {
  const [solid, setSolid] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const on = () => setSolid(window.scrollY > 8);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);

  return (
    <header className={`lp-head${solid || open ? ' solid' : ''}`}>
      <div className="lp-head-in">
        <a href="#top" className="brand" aria-label="__BRAND__, back to the top">
          <span className="brand-mark"><LogoMark /></span>
          <span className="brand-t">__BRAND__</span>
        </a>
        <nav aria-label="Sections">
          {nav.map(([t, h]) => <a key={h} href={h}>{t}</a>)}
        </nav>
        <ThemeToggle />
        <a href={action.href} className="btn primary hide-sm">{action.label}</a>
        <button type="button" className="theme-toggle lp-menu-b" aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} onClick={() => setOpen(!open)}>
          <svg viewBox="0 0 24 24">{open ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}</svg>
        </button>
      </div>
      {open ? (
        <div className="lp-sheet" onClick={() => setOpen(false)}>
          {nav.map(([t, h]) => <a key={h} href={h}>{t}</a>)}
          <a href={action.href}>{action.label}</a>
        </div>
      ) : null}
    </header>
  );
}
