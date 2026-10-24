import './globals.css';
import type { Metadata, Viewport } from 'next';
import { THEME_SCRIPT } from '@/lib/theme';
import '@/components/fx/fx.css';
import { FxMicro } from '@/components/fx/micro';

export const metadata: Metadata = {
  title: __TITLE_JSON__,
  description: __DESCRIPTION_JSON__,
};

// Phones: width=device-width is what makes every media query in globals.css / landing.css mean anything.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '__LIGHT_SURFACE__' },
    { media: '(prefers-color-scheme: dark)', color: '__DARK_SURFACE__' },
  ],
};

// Fonts load in the browser, not at build time: next/font fetches from Google during `next build`, and a build that fails
// whenever that fetch does is a deploy that fails for no reason of ours. Every face has a system fallback in globals.css.
const FONTS = '__FONTS_URL__';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="__LANG__"__DESIGN_ATTR__ suppressHydrationWarning__FX_HTML_ATTRS__>
      <head>
        {/* The saved light/dark choice, before the first paint - see ThemeToggle. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href={FONTS} />
      </head>
      <body>
        {children}
        <FxMicro />
      </body>
    </html>
  );
}
