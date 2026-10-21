// The frame around a figure: "Fig n" top left, a short title top right, the interaction hint bottom left, a live readout
// bottom right, and a plain caption underneath. Colours follow the HyperSkill design tokens and the visitor's light or dark setting.

export const cardCss = `
:root { --paper: #f3eee4; --paper-2: #ebe4d6; --ink: #14110f; --ink-2: #4a433b; --rule: #cfc6b4; --accent: #d93a1c;
  --serif: "Iowan Old Style", "Palatino Linotype", Georgia, serif; --mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; --sans: system-ui, -apple-system, "Segoe UI", sans-serif; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --paper: #14110f; --paper-2: #1d1916; --ink: #f3eee4; --ink-2: #b8ae9d; --rule: #3a342d; --accent: #ff6a4d; } }
:root[data-theme="dark"] { --paper: #14110f; --paper-2: #1d1916; --ink: #f3eee4; --ink-2: #b8ae9d; --rule: #3a342d; --accent: #ff6a4d; }
* { box-sizing: border-box; }
body { margin: 0; background: var(--paper); color: var(--ink); font: 400 16px/1.55 var(--sans); }
main { max-width: 1040px; margin: 0 auto; padding: clamp(16px, 4vw, 40px); }
.fig { margin: 0; background: var(--paper-2); border: 1px solid var(--rule); border-radius: 16px; overflow: hidden; }
.fig-top, .fig-bottom { display: flex; justify-content: space-between; align-items: baseline; gap: 16px; padding: 14px 18px; font: 600 12px/1.3 var(--mono); letter-spacing: .06em; }
.fig-num { color: var(--accent); text-transform: uppercase; letter-spacing: .14em; }
.fig-title { font: 400 clamp(18px, 2.4vw, 24px)/1.1 var(--serif); letter-spacing: -.01em; text-align: right; }
.fig-stage { display: block; width: 100%; background: var(--paper); border-top: 1px solid var(--rule); border-bottom: 1px solid var(--rule); cursor: pointer; touch-action: manipulation; }
.fig-stage:focus-visible { outline: 3px solid var(--accent); outline-offset: -3px; }
.fig-stage svg { display: block; width: 100%; height: auto; max-height: 70vh; }
.fig-hint { color: var(--ink-2); font-weight: 400; text-transform: none; letter-spacing: 0; }
.fig-readout { text-align: right; min-height: 1.3em; }
.fig-caption { max-width: 70ch; color: var(--ink-2); font-size: 15px; margin: 14px 2px 0; }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
@media (max-width: 560px) { .fig-top, .fig-bottom { flex-direction: column; align-items: flex-start; gap: 4px; } .fig-title, .fig-readout { text-align: left; } }
/* a wide drawing keeps a readable size on a phone and scrolls inside its own frame; the page itself never scrolls sideways */
@media (max-width: 720px) { .fig-stage { overflow-x: auto; } .fig-stage svg { min-width: 760px; max-height: none; } }
`;

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** The card as HTML. `scene` is the SVG markup of the drawing, drawn into <g id="fig-scene"> so a script can redraw it. */
export function cardHtml({ num = 1, title, hint, readout, caption, label, viewBox, scene }) {
  const vb = `${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`;
  return `<figure class="fig">
  <div class="fig-top"><span class="fig-num">Fig ${esc(num)}</span><span class="fig-title">${esc(title)}</span></div>
  <div class="fig-stage" id="fig-stage" tabindex="0" role="group" aria-label="${esc(label)}">
    <svg viewBox="${vb}" role="img" aria-label="${esc(label)}" xmlns="http://www.w3.org/2000/svg"><g id="fig-scene">${scene}</g></svg>
  </div>
  <div class="fig-bottom"><span class="fig-hint" id="fig-hint">${esc(hint)}</span><span class="fig-readout" id="fig-readout" aria-hidden="true">${esc(readout)}</span></div>
  <p class="sr-only" id="fig-live" role="status" aria-live="polite"></p>
</figure>
<p class="fig-caption">${esc(caption)}</p>`;
}
