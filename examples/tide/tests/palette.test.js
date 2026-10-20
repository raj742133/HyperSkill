import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

// The digits are white and sit on the liquid, so each world's liquid colours must keep white readable.
const css = fs.readFileSync(new URL("../styles.css", import.meta.url), "utf8");
const lum = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrastWithWhite = (hex) => 1.05 / (lum(hex) + 0.05);

function worlds() {
  const out = {};
  const root = /:root \{([^}]*)\}/.exec(css)[1];
  out.focus = { a: /--liq-a:\s*(#\w{6})/.exec(root)[1], b: /--liq-b:\s*(#\w{6})/.exec(root)[1] };
  for (const m of ["short", "long"]) {
    const block = new RegExp(`body\\[data-mode="${m}"\\]\\s*\\{([^}]*)\\}`).exec(css)[1];
    out[m] = { a: /--liq-a:\s*(#\w{6})/.exec(block)[1], b: /--liq-b:\s*(#\w{6})/.exec(block)[1] };
  }
  return out;
}

test("white digits stay readable on both liquid colours in all three worlds (large text needs 3:1)", () => {
  for (const [mode, c] of Object.entries(worlds())) {
    for (const k of ["a", "b"]) assert.ok(contrastWithWhite(c[k]) >= 3, `${mode} liquid ${k} ${c[k]} is only ${contrastWithWhite(c[k]).toFixed(2)}:1 with white`);
  }
});

test("the contrast helper itself is right (white on black 21:1, white on white 1:1)", () => {
  assert.ok(Math.abs(contrastWithWhite("#000000") - 21) < 0.01);
  assert.ok(Math.abs(contrastWithWhite("#ffffff") - 1) < 0.01);
});

test("the registered colours' initial values match the focus world", () => {
  const w = worlds().focus;
  assert.match(css, new RegExp(`--liq-a[^}]*initial-value: ${w.a}`));
  assert.match(css, new RegExp(`--liq-b[^}]*initial-value: ${w.b}`));
});
