import type { Metadata } from 'next';
import { Playground } from '@/components/fx/Playground';
import './effects.css';

export const metadata: Metadata = { title: 'Effects · __BRAND__', description: 'Every animated background, headline, button and card effect, live, with the config to copy.' };

/** Public page: pick the effects for __BRAND__ and copy the matching `effects` block into site.json. */
export default function EffectsPage() {
  return <Playground />;
}
