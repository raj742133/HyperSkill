// Colour maths for the brand tokens. Two brand colours in (primary + signal), a complete light AND dark palette out,
// every text colour checked against its background (WCAG contrast), the way globals.css in the original dashboard is built:
// a pale cool surface, white cards, one action colour, one signal colour, washes of both, and a dark theme that is not
// just an inversion.

export function hexToRgb(hex) {
  let h = String(hex).trim().replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (!/^[0-9a-fA-F]{6}$/.test(h)) throw new Error(`"${hex}" is not a #rrggbb colour`);
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export const rgbToHex = ([r, g, b]) =>
  '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');

export function rgbToHsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return [h, s * 100, l * 100];
}

export function hslToHex([h, s, l]) {
  h = ((h % 360) + 360) % 360; s = Math.max(0, Math.min(100, s)) / 100; l = Math.max(0, Math.min(100, l)) / 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return rgbToHex([f(0) * 255, f(8) * 255, f(4) * 255]);
}

const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
export const luminance = (hex) => { const [r, g, b] = hexToRgb(hex); return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b); };
export function contrast(a, b) {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

export function mix(a, b, t) {
  const [r1, g1, b1] = hexToRgb(a), [r2, g2, b2] = hexToRgb(b);
  return rgbToHex([r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t]);
}

/** Moves the lightness of `hex` away from `bg` until it reaches `min` contrast on it. */
export function ensureContrast(hex, bg, min = 4.5) {
  let [h, s, l] = rgbToHsl(hexToRgb(hex));
  const dark = luminance(bg) < 0.4;
  for (let i = 0; i < 80 && contrast(hslToHex([h, s, l]), bg) < min; i++) l += dark ? 1 : -1;
  return hslToHex([h, s, Math.max(2, Math.min(98, l))]);
}

export const onColour = (bg) => (contrast('#ffffff', bg) >= contrast('#0b1116', bg) ? '#ffffff' : '#0b1116');

/**
 * The full token set. `neutral` is the hue the greys lean towards (defaults to the primary's hue, kept faint so the page is on-brand
 * without looking tinted). Semantic colours (ok, corrected, unsure, critical) are fixed: they carry meaning, not branding.
 */
/**
 * `theme` picks the design language: 'studio' (the default) is flat and warm - paper-and-ink neutrals that do not take the brand's
 * hue, so the brand colours are the only colour on the page; 'classic' is the original pale cool surface tinted by the primary.
 */
export function buildPalette({ primary, signal, neutral, theme = 'studio' }) {
  if (theme === 'studio') return buildStudio({ primary, signal, neutral });
  const hue = neutral != null ? neutral : rgbToHsl(hexToRgb(primary))[0];
  const sat = rgbToHsl(hexToRgb(primary))[1] < 8 ? 6 : 1; // a grey brand gets truly neutral greys

  const L = {
    surface: hslToHex([hue, sat * 26, 95.4]), raised: '#ffffff', 'raised-2': hslToHex([hue, sat * 28, 97.6]),
    ink: hslToHex([hue, sat * 38, 7]), muted: hslToHex([hue, sat * 14, 37]),
    line: hslToHex([hue, sat * 22, 85]), 'line-strong': hslToHex([hue, sat * 20, 77]),
    critical: '#b32d18', 'critical-wash': '#fbe0dc', ok: '#1c7a5b', corrected: '#6d4fd6', added: '#0e7490',
    unsure: '#c2410c', 'unsure-wash': '#fdebd8', 'photo-bg': '#0b1220',
  };
  L.primary = ensureContrast(primary, L.raised, 4.5);
  L.signal = signal;
  L['signal-ink'] = ensureContrast(signal, L['signal-wash'] = mix(signal, '#ffffff', 0.84), 4.6);
  L['primary-wash'] = mix(L.primary, '#ffffff', 0.87);
  L['on-primary'] = onColour(L.primary);

  const D = {
    surface: hslToHex([hue, sat * 22, 5.8]), raised: hslToHex([hue, sat * 20, 9]), 'raised-2': hslToHex([hue, sat * 18, 12]),
    ink: hslToHex([hue, sat * 25, 92]), muted: hslToHex([hue, sat * 10, 64]),
    line: hslToHex([hue, sat * 16, 17]), 'line-strong': hslToHex([hue, sat * 15, 23]),
    critical: '#ff7a66', 'critical-wash': '#3a1a15', ok: '#3dd9ae', corrected: '#a996ff', added: '#5fd4e6',
    unsure: '#ffa94d', 'unsure-wash': '#3a2612', 'photo-bg': '#0b1220',
  };
  D.primary = ensureContrast(mix(primary, '#ffffff', 0.38), D.raised, 5);
  D.signal = ensureContrast(signal, D.surface, 5.5);
  D['signal-wash'] = mix(D.signal, D.surface, 0.86);
  D['signal-ink'] = ensureContrast(mix(D.signal, '#ffffff', 0.35), D['signal-wash'], 6);
  D['primary-wash'] = mix(D.primary, D.surface, 0.84);
  D['on-primary'] = onColour(D.primary);
  return { light: L, dark: D, hue };
}

function buildStudio({ primary, signal, neutral }) {
  const hue = neutral != null ? neutral : 40; // warm paper; set brand.colors.neutralHue for another undertone
  const L = {
    surface: hslToHex([hue, 18, 94.6]), raised: hslToHex([hue, 30, 98.6]), 'raised-2': hslToHex([hue, 15, 91.8]),
    ink: hslToHex([hue, 20, 7]), muted: hslToHex([hue, 6, 34]),
    line: hslToHex([hue, 14, 84]), 'line-strong': hslToHex([hue, 12, 73]),
    critical: '#b32d18', 'critical-wash': '#fbe0dc', ok: '#1c7a5b', corrected: '#6d4fd6', added: '#0e7490',
    unsure: '#c2410c', 'unsure-wash': '#fdebd8', 'photo-bg': '#0e0d0b',
  };
  L.primary = ensureContrast(primary, L.raised, 4.5);
  L.signal = signal;
  L['signal-ink'] = ensureContrast(signal, L['signal-wash'] = mix(signal, '#ffffff', 0.86), 4.6);
  L['primary-wash'] = mix(L.primary, '#ffffff', 0.88);
  L['on-primary'] = onColour(L.primary);

  const D = {
    surface: hslToHex([hue, 6, 4.8]), raised: hslToHex([hue, 6, 7.8]), 'raised-2': hslToHex([hue, 6, 10.6]),
    ink: hslToHex([hue, 20, 94]), muted: hslToHex([hue, 6, 64]),
    line: hslToHex([hue, 6, 14.5]), 'line-strong': hslToHex([hue, 6, 21.5]),
    critical: '#ff7a66', 'critical-wash': '#3a1a15', ok: '#3dd9ae', corrected: '#a996ff', added: '#5fd4e6',
    unsure: '#ffa94d', 'unsure-wash': '#3a2612', 'photo-bg': '#0e0d0b',
  };
  D.primary = ensureContrast(mix(primary, '#ffffff', 0.3), D.raised, 5);
  D.signal = ensureContrast(signal, D.surface, 5.5);
  D['signal-wash'] = mix(D.signal, D.surface, 0.88);
  D['signal-ink'] = ensureContrast(mix(D.signal, '#ffffff', 0.3), D['signal-wash'], 6);
  D['primary-wash'] = mix(D.primary, D.surface, 0.86);
  D['on-primary'] = onColour(D.primary);
  return { light: L, dark: D, hue, theme: 'studio' };
}

const cssVars = (t) => Object.entries(t).map(([k, v]) => `--${k}: ${v};`).join(' ');
const shadows = {
  light: '--shadow: 0 1px 2px rgba(11, 17, 22, 0.05), 0 12px 32px -12px color-mix(in srgb, var(--primary) 20%, transparent); --shadow-lift: 0 2px 4px rgba(11, 17, 22, 0.05), 0 30px 60px -20px color-mix(in srgb, var(--primary) 32%, transparent);',
  dark: '--shadow: 0 1px 0 rgba(255, 255, 255, 0.03) inset, 0 12px 32px -14px rgba(0, 0, 0, 0.7); --shadow-lift: 0 1px 0 rgba(255, 255, 255, 0.04) inset, 0 30px 60px -20px rgba(0, 0, 0, 0.85);',
};

/** The three CSS blocks the stylesheet needs: light :root, dark by device, dark by the toggle. */
const studioShadows = {
  light: '--shadow: 0 1px 2px rgba(20, 15, 5, 0.06), 0 14px 30px -22px rgba(20, 15, 5, 0.3); --shadow-lift: 0 2px 4px rgba(20, 15, 5, 0.07), 0 30px 60px -30px rgba(20, 15, 5, 0.42);',
  dark: '--shadow: 0 1px 0 rgba(255, 255, 255, 0.03) inset, 0 14px 30px -22px rgba(0, 0, 0, 0.9); --shadow-lift: 0 1px 0 rgba(255, 255, 255, 0.04) inset, 0 30px 60px -30px rgba(0, 0, 0, 0.95);',
};

export function paletteCss(p) {
  const sh = p.theme === 'studio' ? studioShadows : shadows;
  const light = `:root { ${cssVars(p.light)} --warn: var(--critical); --accent: var(--signal); ${sh.light} color-scheme: light; }`;
  const dark = `${cssVars(p.dark)} ${sh.dark} color-scheme: dark;`;
  return [
    light,
    `@media (prefers-color-scheme: dark) { :root:not([data-theme='light']) { ${dark} } }`,
    `:root[data-theme='dark'] { ${dark} }`,
  ].join('\n');
}
