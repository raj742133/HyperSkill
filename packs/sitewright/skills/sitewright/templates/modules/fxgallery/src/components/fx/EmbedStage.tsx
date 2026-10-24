'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { UI_DEMOS } from './ui/demos';
import { BACKGROUND_COMPONENTS, FIGURE_FACTORIES } from './catalog';

export type EmbedKind = 'c' | 'f' | 'bg';

/** Below this the effect is shown at its natural size; above it, it grows with the frame up to MAX. */
const BASE = 420;
const MAX = 1.35;

/** One component's demo, at the size a card needs. */
function ComponentView({ id }: { id: string }) {
  const d = UI_DEMOS.find((x) => x.id === id);
  if (!d) return null;
  return <div className="fxe-demo"><d.Demo /></div>;
}

/** One figure, live. The pointer moves it, as on the gallery. */
function FigureView({ id }: { id: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const make = FIGURE_FACTORIES[id];
    if (!make || !ref.current) return;
    const f = make(ref.current, { intensity: 0.5, onRead: () => {} });
    return () => f.destroy();
  }, [id]);
  return <div className="fxe-fig"><div ref={ref} className="fxe-fig-box" /></div>;
}

/**
 * The whole page of a bare embed: the effect and nothing else. The stage is scaled up to 1.35x when the frame is bigger than 420px
 * (a 420-640px card), and listens for window.postMessage({ type: 'sitewright-theme', theme: 'light' | 'dark' }) from the parent.
 * ?theme / ?primary / ?signal are applied before paint by EMBED_BOOT (see embed-boot.ts).
 */
export function EmbedStage({ kind, id }: { kind: EmbedKind; id: string }) {
  const [scale, setScale] = useState(1);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const fit = () => setScale(Math.min(MAX, Math.max(1, Math.min(window.innerWidth, window.innerHeight) / BASE)));
    fit();
    setReady(true);
    const onMsg = (e: MessageEvent) => {
      const m = e.data as { type?: unknown; theme?: unknown } | null;
      if (m && m.type === 'sitewright-theme' && (m.theme === 'light' || m.theme === 'dark')) document.documentElement.dataset.theme = m.theme;
    };
    window.addEventListener('resize', fit);
    window.addEventListener('message', onMsg);
    return () => { window.removeEventListener('resize', fit); window.removeEventListener('message', onMsg); };
  }, []);

  if (kind === 'bg') {
    const Bg = BACKGROUND_COMPONENTS[id];
    return <div className="fxe fxe-bg" data-embed="bg" data-ready={ready ? '1' : '0'}>{Bg ? <Bg /> : null}</div>;
  }
  return (
    <div className="fxe" data-embed={kind} data-id={id} data-ready={ready ? '1' : '0'}>
      <div className="fxe-scale" style={{ '--s': scale } as CSSProperties}>
        {kind === 'c' ? <ComponentView id={id} /> : <FigureView id={id} />}
      </div>
    </div>
  );
}
