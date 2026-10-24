'use client';

import { useEffect, useState } from 'react';

// THEME_SCRIPT lives in lib/theme.ts, not here: layout.tsx needs the string, and importing it from a 'use client' file makes the
// layout depend on client chunks, which Next then mis-lists for some routes (a React #418 on every /admin page).

/**
 * Light / dark. Follows the device until the reader picks one; the choice is kept in this browser
 * (localStorage) and applied before the first paint by the script in layout.tsx, so a dark page
 * never flashes white on load.
 */
export function ThemeToggle() {
  const [dark, setDark] = useState<boolean | null>(null);

  useEffect(() => {
    const set = document.documentElement.dataset.theme;
    setDark(set ? set === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches);
  }, []);

  function flip() {
    const next = !dark;
    setDark(next);
    document.documentElement.dataset.theme = next ? 'dark' : 'light';
    try { localStorage.setItem('__COOKIE__-theme', next ? 'dark' : 'light'); } catch { /* private mode */ }
  }

  return (
    <button type="button" className="theme-toggle" onClick={flip} aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'} title={dark ? 'Light mode' : 'Dark mode'}>
      {dark ? (
        <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4.2" /><path d="M12 2.5v2.2M12 19.3v2.2M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6" /></svg>
      ) : (
        <svg viewBox="0 0 24 24"><path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5a8.5 8.5 0 1 0 10.7 10.7Z" /></svg>
      )}
    </button>
  );
}
