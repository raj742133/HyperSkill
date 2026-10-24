import type { Metadata } from 'next';
import { EMBED_BOOT } from '@/components/fx/embed-boot';
import '../embed.css';

export const metadata: Metadata = { title: 'Effect · __BRAND__', robots: { index: false, follow: false } };

/**
 * Bare routes for <iframe>s: /effects/c/<component>/, /effects/f/<figure>/, /effects/bg/<background>/. No bar, no toggle, no footer,
 * a transparent page that never scrolls. This layout is separate from the gallery page (a route group), so none of that chrome is
 * inherited, and the script and styles below exist only on these pages.
 */
export default function EmbedLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: EMBED_BOOT }} />
      {children}
    </>
  );
}
