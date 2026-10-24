import { EmbedStage } from '@/components/fx/EmbedStage';
import { UI_DEMOS } from '@/components/fx/ui/demos';

// Static export: every id is rendered at build time and anything else is a 404.
export const dynamicParams = false;
export function generateStaticParams() {
  return UI_DEMOS.map((d) => ({ id: d.id }));
}

export default async function EmbedPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EmbedStage kind="c" id={id} />;
}
