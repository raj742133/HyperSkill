// Builds the canal figure into one standalone HTML page.
//   node build.mjs [--light|--dark] [--split] [--audit] [--out dir]
// --split writes figure.css and figure.js next to the page instead of inlining them (for sites with a strict Content-Security-Policy).
// --audit checks that no part passes through another and exits 1 if one does. The page makes no network request.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { camera, auditOverlaps } from "../../kit/iso.mjs";
import { cardCss, cardHtml } from "../../kit/card.mjs";
import { loadPhases, createMachine } from "./model.mjs";
import { staticParts, dynamicParts, startAnim, renderScene, fitBox } from "./scene.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2), has = (f) => args.includes(f);
const outDir = path.resolve(args.includes("--out") ? args[args.indexOf("--out") + 1] : here);

/** Turn an ES module into plain script text: drop imports, drop `export`. Modules used this way keep to single-line imports and plain exports. */
export function inlineModule(file) {
  return fs.readFileSync(file, "utf8").split("\n")
    .filter((l) => !/^\s*import\s.+from\s+["'].+["'];?\s*$/.test(l) && !/^\s*export\s*\{.*\}\s*from/.test(l))
    .map((l) => l.replace(/^export\s+(const|let|function|async function|class)\s/, "$1 "))
    .join("\n");
}

export function buildPage({ light = false, dark = false, split = false } = {}) {
  const phases = loadPhases(path.resolve(here, "../../../hyperskill/gates.json"));
  const total = phases.reduce((n, p) => n + p.checks, 0);
  const cam = camera({ az: 45, el: 30, scale: 1 });
  const m = createMachine(phases);
  const scene = renderScene(cam, [...staticParts(phases), ...dynamicParts(phases, startAnim(phases, m.snapshot()))]);
  const title = `${phases.length} locks, ${total} checks`;
  const counts = phases.map((p) => `${p.id} ${p.checks}`).join(", ");
  const card = cardHtml({
    num: 1, title,
    label: `Nine canal lock chambers in a row, one per HyperSkill phase, stepping up and away. Each fills with water as its checks pass; when it is full its gate drops and the boat moves into the next chamber.`,
    hint: "Click or press Space: pass a check. Enter: pass a phase. R: start over.",
    readout: m.snapshot().readout,
    caption: `A boat climbs nine lock chambers, one for each HyperSkill phase (${counts}: ${total} checks in all). A chamber fills only as its checks pass, and its gate opens only when it is full, so the boat cannot move on until the evidence is in. Every number comes from skills/hyperskill/gates.json.`,
    viewBox: fitBox(cam, phases), scene,
  });
  const js = [
    `var PHASES = ${JSON.stringify(phases)};`,
    inlineModule(path.resolve(here, "../../kit/iso.mjs")), inlineModule(path.resolve(here, "machine.mjs")), inlineModule(path.resolve(here, "scene.mjs")),
    fs.readFileSync(path.resolve(here, "client.js"), "utf8"),
  ].join("\n");
  const theme = light ? ' data-theme="light"' : dark ? ' data-theme="dark"' : "";
  const head = `<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}: a HyperSkill figure</title><meta name="description" content="An interactive figure: nine lock chambers, one per HyperSkill phase.">`;
  const page = (css, script) => `<!doctype html>\n<html lang="en"${theme}>\n<head>${head}\n${css}\n</head>\n<body>\n<main>\n${card}\n</main>\n<noscript><p class="fig-caption">This figure needs JavaScript to move. The drawing above shows the start: every chamber empty, every gate shut.</p></noscript>\n${script}\n</body>\n</html>\n`;
  return split
    ? { html: page('<link rel="stylesheet" href="figure.css">', '<script src="figure.js"></script>'), css: cardCss, js }
    : { html: page(`<style>${cardCss}</style>`, `<script>${js}</script>`), css: null, js: null };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (has("--audit")) {
    const phases = loadPhases(path.resolve(here, "../../../hyperskill/gates.json")), mach = createMachine(phases);
    const allow = phases.map((_, i) => `leaf-${i}|sill-${i}`);
    let bad = 0;
    for (const stage of ["start", "done"]) {
      if (stage === "done") while (!mach.snapshot().done) mach.step();
      const snap = mach.snapshot(), anim = startAnim(phases, snap);
      const hits = auditOverlaps([...staticParts(phases), ...dynamicParts(phases, anim)], { allow });
      console.log(`${stage}: ${hits.length ? JSON.stringify(hits) : "no part passes through another"}`);
      bad += hits.length;
    }
    process.exit(bad ? 1 : 0);
  }
  const out = buildPage({ light: has("--light"), dark: has("--dark"), split: has("--split") });
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "canal.html"), out.html);
  if (out.css) { fs.writeFileSync(path.join(outDir, "figure.css"), out.css); fs.writeFileSync(path.join(outDir, "figure.js"), out.js); }
  console.log(`wrote ${path.join(outDir, "canal.html")}${out.css ? " with figure.css and figure.js" : ""}`);
}
