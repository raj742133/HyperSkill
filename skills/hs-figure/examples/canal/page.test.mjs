import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { buildPage, inlineModule } from "./build.mjs";
import { loadPhases } from "./model.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const phases = loadPhases(path.resolve(here, "../../../hyperskill/gates.json"));
const total = phases.reduce((n, p) => n + p.checks, 0);

test("the page is standalone: no outside address, no inline style attribute, no inline event handler", () => {
  const { html } = buildPage();
  const urls = (html.match(/https?:\/\/[^\s"'<>)]+/g) || []).filter((u) => u !== "http://www.w3.org/2000/svg");
  assert.deepEqual(urls, [], "nothing is loaded from elsewhere");
  assert.ok(!/\sstyle="/.test(html), "no style attributes, so a strict policy works");
  assert.ok(!/\son[a-z]+="/.test(html), "no inline handlers");
  assert.ok(!/<(link|script)[^>]+(src|href)="https?:/.test(html));
});

test("it states real numbers: the title, the caption and the first readout come from gates.json", () => {
  const { html } = buildPage();
  assert.match(html, new RegExp(`${phases.length} locks, ${total} checks`));
  assert.match(html, new RegExp(`${total} checks in all`));
  assert.match(html, new RegExp(`Phase 1 of ${phases.length}: ${phases[0].title}, 0 of ${phases[0].checks} checks`));
  for (const p of phases) assert.ok(html.includes(`${p.id} ${p.checks}`), `${p.id} ${p.checks} is in the caption`);
});

test("it is built to be reachable: a labelled group you can focus, a labelled picture, a polite live region, a no-script note", () => {
  const { html } = buildPage();
  assert.match(html, /id="fig-stage" tabindex="0" role="group" aria-label="[^"]{40,}"/);
  assert.match(html, /<svg[^>]+role="img" aria-label="[^"]{40,}"/);
  assert.match(html, /id="fig-live" role="status" aria-live="polite"/);
  assert.match(html, /<noscript>/);
  assert.match(html, /<html lang="en"/);
  assert.match(html, /prefers-reduced-motion|matchMedia\("\(prefers-reduced-motion: reduce\)"\)/);
  assert.match(html, /<g id="fig-scene"><g data-id=/, "the start picture is already drawn, so it shows without JavaScript");
});

test("--split keeps script and style out of the page, for sites that forbid inline code", () => {
  const out = buildPage({ split: true });
  assert.ok(!/<style>/.test(out.html) && !/<script>/.test(out.html));
  assert.match(out.html, /<link rel="stylesheet" href="figure.css">/);
  assert.match(out.html, /<script src="figure.js"><\/script>/);
  assert.ok(out.css.includes(".fig-stage") && out.js.includes("createMachine"));
  assert.ok(!/\bimport\b[^\n]*from|^export /m.test(out.js), "the script is plain: no import or export left");
  assert.doesNotThrow(() => new Function(out.js), "and it parses as a classic script");
});

test("the theme can be forced; by default it follows the visitor's setting", () => {
  assert.match(buildPage({ light: true }).html, /<html lang="en" data-theme="light">/);
  assert.match(buildPage({ dark: true }).html, /<html lang="en" data-theme="dark">/);
  assert.match(buildPage().html, /<html lang="en">/);
});

test("inlineModule drops imports and exports and keeps the code", () => {
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "fig-")), "m.mjs");
  fs.writeFileSync(f, 'import { a } from "./a.mjs";\nexport const x = 1;\nexport function y() { return x; }\nexport { z } from "./z.mjs";\nconst keep = 2;\n');
  const out = inlineModule(f);
  assert.ok(!/import|export/.test(out)); assert.match(out, /const x = 1;/); assert.match(out, /function y\(\)/); assert.match(out, /const keep = 2;/);
});

test("the command line builds the file, and --audit exits 0 on the shipped figure", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fig-"));
  const r = spawnSync("node", ["build.mjs", "--split", "--out", dir], { cwd: here, encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  for (const f of ["canal.html", "figure.css", "figure.js"]) assert.ok(fs.existsSync(path.join(dir, f)), f);
  const a = spawnSync("node", ["build.mjs", "--audit"], { cwd: here, encoding: "utf8" });
  assert.equal(a.status, 0, a.stdout); assert.match(a.stdout, /start: no part passes through another/);
});
