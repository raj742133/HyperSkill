import { EmbedStage } from '@/components/fx/EmbedStage';
import { INFO } from '@/components/fx/catalog';

// Static export: every id is rendered at build time and anything else is a 404.
export const dynamicParams = false;
export function generateStaticParams() {
  return INFO.figures.map((f) => ({ id: f.id }));
}

export default async function EmbedPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EmbedStage kind="f" id={id} />;
}
