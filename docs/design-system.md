# HyperSkill design system

The look of the HyperSkill site, written down so it can be reused in other projects. **Warm paper, near-black ink, one orange-red accent, an editorial serif for headlines, a monospace for the "system voice".** It reads like a printed field manual with a terminal on the side, not like a SaaS landing page.

- Source of truth: [`site/styles.css`](../site/styles.css), [`site/index.html`](../site/index.html), [`site/app.js`](../site/app.js). Live: https://hyperskill-hazel.vercel.app
- Every CSS block below is copied exactly from `site/styles.css` (a test fails if they drift apart), so you can paste them as they are.
- Plain HTML and CSS, no framework, no build step, no icon library, no images needed for the look. About 14 KB of CSS.

**Preview.** The starter page from section 13, built from this document's own CSS blocks and nothing else: light on a desktop, dark on a phone.

<img src="img/design-system-starter-light.png" alt="The starter page in light mode: mono wordmark, a serif headline with an orange italic second half, two buttons and a row of big serif numbers" width="640"> <img src="img/design-system-starter-dark-phone.png" alt="The same starter page on a phone in dark mode" width="200">

## 1. What makes it look like this (the rules)

1. **One accent, used sparingly.** Orange-red appears on: the eyebrow label, the italic half of the headline, big serif numerals, list markers, the focus ring, the primary hover and one button. Never as a large background.
2. **Three typefaces, three jobs.** Serif for display (headlines, big numbers). Sans for reading. Mono for anything that is "the system speaking": labels, commands, tags, table headers, code.
3. **Paper and ink, not white and grey.** The page is warm off-white (`#f3eee4`), text is near-black (`#14110f`), secondary text is a warm brown-grey. Dark mode swaps them rather than inverting to pure black and white.
4. **Hairlines, not boxes.** Structure comes from 1px rules (`--rule`) and one heavy 2px ink rule at the top of a section or footer. Cards are rare; where there is one it has a 1px rule border and a 14-16px radius.
5. **One hard shadow.** The only shadow is a solid offset block (`8px 8px 0 var(--accent)`) under the terminal. No blur shadows, no gradients, no glass.
6. **Big, tight, balanced headlines.** `line-height` 1 to 1.05, negative letter-spacing, `text-wrap: balance`. Body text is generous (17px / 1.6) with a 54ch to 760px measure.
7. **Mostly still.** There is almost no motion: smooth anchor scroll, a hover colour change, a terminal that types its lines one by one. Everything stops under `prefers-reduced-motion`.

## 2. Quick start

1. Fonts (Instrument Serif, Inter, JetBrains Mono from Google Fonts), in `<head>`:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;600&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<meta name="theme-color" content="#f3eee4" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#14110f" media="(prefers-color-scheme: dark)">
```

2. Paste the tokens (section 3), the base (section 5) and the layout (section 6).
3. Add the components you need (section 7). Each one is independent.

If a page has a strict Content-Security-Policy, the Google Fonts link needs `style-src https://fonts.googleapis.com` and `font-src https://fonts.gstatic.com`. To avoid that, self-host the three families (download the font files, add `@font-face` rules, remove the links). Without the fonts the system fallbacks in the stacks below still look reasonable (Georgia for the serif).

## 3. Design tokens

```css file=site/styles.css
:root {
  --paper: #f3eee4;
  --paper-2: #ebe4d6;
  --ink: #14110f;
  --ink-2: #4a433b;
  --rule: #cfc6b4;
  --accent: #d93a1c;
  --accent-ink: #ffffff;
  --term: #14110f;
  --term-ink: #f3eee4;
  --term-dim: #9d9384;
  --ok: #7ccf8a;
  --bad: #ff7a5c;
  --serif: "Instrument Serif", "Iowan Old Style", Georgia, serif;
  --sans: "Inter", system-ui, -apple-system, "Segoe UI", sans-serif;
  --mono: "JetBrains Mono", ui-monospace, "SFMono-Regular", Menlo, monospace;
  --gutter: clamp(16px, 4vw, 40px);
  --max: 1180px;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --paper: #14110f; --paper-2: #1d1916; --ink: #f3eee4; --ink-2: #b8ae9d; --rule: #3a342d;
    --accent: #ff6a4d; --accent-ink: #14110f; --term: #0b0908; --term-ink: #f3eee4;
  }
}
:root[data-theme="dark"] {
  --paper: #14110f; --paper-2: #1d1916; --ink: #f3eee4; --ink-2: #b8ae9d; --rule: #3a342d;
  --accent: #ff6a4d; --accent-ink: #14110f; --term: #0b0908;
}
```

| Token | Light | Dark | Use |
|---|---|---|---|
| `--paper` | `#f3eee4` | `#14110f` | Page background |
| `--paper-2` | `#ebe4d6` | `#1d1916` | Second surface: inline code, table header, panels, chips |
| `--ink` | `#14110f` | `#f3eee4` | Text, heavy rules, the dark command box, selected states |
| `--ink-2` | `#4a433b` | `#b8ae9d` | Secondary text, labels |
| `--rule` | `#cfc6b4` | `#3a342d` | 1px hairlines and borders |
| `--accent` | `#d93a1c` | `#ff6a4d` | The one accent |
| `--accent-ink` | `#ffffff` | `#14110f` | Text on an accent background |
| `--term` / `--term-ink` / `--term-dim` | `#14110f` / `#f3eee4` / `#9d9384` | `#0b0908` / same / same | The terminal card (dark in both modes) |
| `--ok` / `--bad` | `#7ccf8a` / `#ff7a5c` | same | Success and error text, only inside the terminal |
| `--gutter` | `clamp(16px, 4vw, 40px)` | | Side padding |
| `--max` | `1180px` | | Content width |

### Contrast (measured with the WCAG formula)

| Pair | Ratio | Verdict |
|---|---|---|
| Light: ink on paper | 16.3:1 | passes AAA |
| Light: ink-2 on paper | 8.4:1 | passes AAA |
| Light: white on accent (button) | 4.6:1 | passes AA |
| Light: **accent on paper as text** | **4.0:1** | **fails AA for small text**, passes for large text (24px and up, or 19px bold) |
| Light: rule on paper | 1.5:1 | decorative only, never carries meaning |
| Dark: ink on paper | 16.3:1 | passes AAA |
| Dark: ink-2 on paper | 8.6:1 | passes AAA |
| Dark: accent on paper | 6.6:1 | passes AA |
| Terminal: ok / bad / dim on terminal | 10.0 / 7.3 / 6.2:1 | passes AA |

**Known weakness in the original:** in light mode the accent on paper is 4.0:1, and the site uses it for small text (the 12px uppercase eyebrow). Use the accent for large text, markers and decoration only, or add a darker text variant for small text. `#bf3015` gives 5.0:1 on `--paper` and 4.6:1 on `--paper-2`:

```css
:root { --accent-text: #bf3015; }                       /* light: small accent text */
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --accent-text: var(--accent); } }
:root[data-theme="dark"] { --accent-text: var(--accent); }
.eyebrow { color: var(--accent-text); }
```

## 4. Typography

| Role | Family | Size | Notes |
|---|---|---|---|
| Display `h1` | Instrument Serif 400 | `clamp(44px, 6.6vw, 84px)` / 1 | letter-spacing `-.02em`, `text-wrap: balance`; `<em>` is italic in the accent colour |
| Section `h2` | Instrument Serif 400 | `clamp(32px, 4.6vw, 56px)` / 1.05 | letter-spacing `-.015em` |
| Big numerals | Instrument Serif 400 | `clamp(40px, 6vw, 72px)` / 1 | the stats row and the numbered rules |
| `h3` | Inter 600 | 18px / 1.3 | |
| Body | Inter 400 | 17px / 1.6 | secondary copy uses `--ink-2`; small print is 13.5px / 1.5 |
| Lede | Inter 400 | `clamp(17px, 1.6vw, 20px)` | max 54ch, `--ink-2` |
| Eyebrow | JetBrains Mono 600 | 12px | uppercase, letter-spacing `.14em`, accent colour |
| Labels, tags, table headers | JetBrains Mono 600 | 11.5 to 12px | uppercase with `.1em` to `.12em` spacing for headers |
| Code, commands | JetBrains Mono 400 | `.88em` inline, 13.5 to 14px in blocks | |

The headline pattern is two lines: a roman first line, then the second line in `<em>` (italic, accent). Example: `AI builds fast. <em>HyperSkill makes it prove it.</em>`

## 5. Base

```css file=site/styles.css
* { box-sizing: border-box; }
html { scroll-behavior: smooth; }
body {
  margin: 0; background: var(--paper); color: var(--ink);
  font: 400 17px/1.6 var(--sans); -webkit-font-smoothing: antialiased;
}
a { color: inherit; text-decoration-color: var(--accent); text-underline-offset: 3px; }
code, pre { font-family: var(--mono); }
code { font-size: .88em; background: var(--paper-2); padding: .1em .35em; border-radius: 4px; }
:focus-visible { outline: 3px solid var(--accent); outline-offset: 3px; border-radius: 4px; }
.skip { position: absolute; left: -999px; top: 8px; background: var(--ink); color: var(--paper); padding: 8px 14px; z-index: 10; border-radius: 6px; }
.skip:focus { left: 8px; }
```

## 6. Layout

Every section is the same width and the same vertical rhythm: side padding from `--gutter`, centred at `--max`, and a bottom margin of `clamp(64px, 10vw, 128px)`. Two-column layouts are CSS grid with `minmax(0, 1fr)` columns (the `0` stops long content from stretching a column) and collapse to one column at the breakpoints below.

```css file=site/styles.css
.top, main > section, .foot { padding-left: var(--gutter); padding-right: var(--gutter); }
.top { display: flex; align-items: center; justify-content: space-between; max-width: calc(var(--max) + 2 * var(--gutter)); margin: 0 auto; padding-top: 18px; padding-bottom: 18px; }
.brand { font: 600 15px/1 var(--mono); text-decoration: none; display: inline-flex; align-items: center; gap: 10px; letter-spacing: -.01em; }
.mark { width: 18px; height: 18px; background: var(--ink); border-radius: 5px; position: relative; }
.mark::after { content: ""; position: absolute; right: -3px; bottom: -3px; width: 8px; height: 8px; border-radius: 50%; background: var(--accent); border: 2px solid var(--paper); }
.top nav { display: flex; align-items: center; gap: clamp(12px, 3vw, 28px); font-size: 15px; }
.top nav a { text-decoration: none; color: var(--ink-2); }
.top nav a:hover { color: var(--ink); }
.top nav .pill { background: var(--ink); color: var(--paper); padding: 8px 16px; border-radius: 999px; }
.top nav .pill:hover { background: var(--accent); color: var(--accent-ink); }
@media (max-width: 520px) { .top nav a:not(.pill):nth-child(n+3) { display: none; } }

main > section { max-width: calc(var(--max) + 2 * var(--gutter)); margin: 0 auto clamp(64px, 10vw, 128px); }
.eyebrow { font: 600 12px/1 var(--mono); letter-spacing: .14em; text-transform: uppercase; color: var(--accent); margin: 0 0 14px; }
.fine { font-size: 13.5px; color: var(--ink-2); margin: 14px 0 0; line-height: 1.5; }
```

Breakpoints used: **900px** (hero stacks), **860px** (feature grid stacks), **820px** (tabs become a horizontal scroller), **720px** (stats and rules go to fewer columns), **520px** (nav keeps only the first two links and the pill; command box wraps).

## 7. Components

### 7.1 Header, brand mark and pill link
A mono wordmark with a small rounded square and an accent dot, plain text links, and one pill-shaped call to action.

```html
<header class="top">
  <a class="brand" href="#top" aria-label="Home"><span class="mark" aria-hidden="true"></span>HyperSkill</a>
  <nav aria-label="Primary">
    <a href="#pipeline">Pipeline</a>
    <a href="#bench">Bench</a>
    <a class="pill" href="#install">Install</a>
  </nav>
</header>
```

Its CSS is in the layout block above (`.top`, `.brand`, `.mark`, `.top nav`, `.pill`). The favicon uses the same mark:

```html
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#14110f"/><path d="M8 9h4v5.5h8V9h4v14h-4v-5.2h-8V23H8z" fill="#f3eee4"/><circle cx="25" cy="24.5" r="2.6" fill="#ff4d2e"/></svg>
```

### 7.2 Hero, command box and links
Two columns: text on the left, a terminal (7.3) on the right. The command box is a dark rounded bar with the command in mono and a small accent copy button; `.ghost` is an underlined text link, `.solid` a pill button.

```html
<section class="hero" id="top">
  <div>
    <p class="eyebrow">A conductor for Claude Code</p>
    <h1>AI builds fast. <em>HyperSkill makes it prove it.</em></h1>
    <p class="lede">One or two sentences that say what it is and what you get.</p>
    <div class="cta">
      <div class="cmd"><code id="cmd-text">/plugin marketplace add owner/repo</code><button type="button" id="copy">Copy</button></div>
      <a class="ghost" href="#demo">Watch it refuse</a>
    </div>
    <p class="fine">Small print: who it is for and what it needs.</p>
  </div>
  <figure class="term"> ... </figure>
</section>
```

```css file=site/styles.css
/* hero */
.hero { display: grid; grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr); gap: clamp(28px, 5vw, 64px); align-items: center; padding-top: clamp(28px, 6vw, 72px); padding-bottom: clamp(40px, 7vw, 90px); }
h1 { font: 400 clamp(44px, 6.6vw, 84px)/1 var(--serif); letter-spacing: -.02em; margin: 0 0 22px; text-wrap: balance; }
h1 em { font-style: italic; color: var(--accent); }
.lede { font-size: clamp(17px, 1.6vw, 20px); color: var(--ink-2); max-width: 54ch; margin: 0 0 28px; }
.cta { display: flex; flex-wrap: wrap; gap: 14px; align-items: center; }
.cmd { display: flex; align-items: center; background: var(--ink); color: var(--paper); border-radius: 12px; padding: 6px 6px 6px 16px; max-width: 100%; min-width: 0; }
.cmd code { background: none; color: inherit; font-size: 14px; padding: 0; overflow-x: auto; white-space: nowrap; scrollbar-width: none; min-width: 0; }
.cmd code::-webkit-scrollbar { display: none; }
.cmd button { margin-left: 14px; flex: none; border: 0; border-radius: 8px; background: var(--accent); color: var(--accent-ink); font: 600 13px var(--sans); padding: 10px 14px; cursor: pointer; }
.cmd button:hover { filter: brightness(1.08); }
.ghost { font-weight: 500; text-decoration: none; border-bottom: 2px solid var(--accent); padding-bottom: 2px; }
.ghost:hover { color: var(--accent); }
```

### 7.3 Terminal card
A dark card with the hard accent offset shadow, a title bar with three dots and a small "Replay" button, and monospace output coloured by meaning: accent prompt, bright command, green success, orange error, dim notes.

```html
<figure class="term" id="demo" aria-labelledby="demo-cap">
  <div class="term-bar">
    <span class="dots" aria-hidden="true"><i></i><i></i><i></i></span>
    <span class="term-title">real output, not a mock-up</span>
    <button type="button" id="replay" class="mini">Replay</button>
  </div>
  <pre class="term-body" id="term-body" aria-live="polite"></pre>
  <figcaption id="demo-cap">Every line above is produced by <code>script.py</code> when the site is built.</figcaption>
</figure>
```

Inside `.term-body` each step is a `div` with a `$ ` prompt span (`.p`) and the command (`.c`), then one `div` per output line with class `ok`, `bad`, `dim` or `c`.

```css file=site/styles.css
/* terminal */
.term { margin: 0; background: var(--term); color: var(--term-ink); border-radius: 16px; overflow: hidden; box-shadow: 8px 8px 0 var(--accent); min-width: 0; }
.term-bar { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-bottom: 1px solid #2a2520; font: 12px var(--mono); color: var(--term-dim); }
.dots { display: inline-flex; gap: 6px; } .dots i { width: 10px; height: 10px; border-radius: 50%; background: #3a342d; }
.term-title { flex: 1; }
.mini { background: none; border: 1px solid #3a342d; color: var(--term-ink); border-radius: 6px; font: 12px var(--mono); padding: 4px 9px; cursor: pointer; }
.mini:hover { border-color: var(--accent); }
.term-body { margin: 0; padding: 18px 18px 8px; font-size: 12.5px; line-height: 1.55; min-height: 420px; max-height: 520px; overflow: auto; white-space: pre-wrap; word-break: break-word; }
.term-body .p { color: var(--accent); } .term-body .c { color: var(--term-ink); }
.term-body .ok { color: var(--ok); } .term-body .bad { color: var(--bad); } .term-body .dim { color: var(--term-dim); }
.term figcaption { padding: 4px 18px 16px; font-size: 12px; color: var(--term-dim); }
.term figcaption code { background: #221d19; color: var(--term-ink); }
```

### 7.4 Numbers ledger
A row of big serif numerals with small captions under a heavy top rule. Five columns, two on a phone.

```html
<section class="ledger" aria-label="By the numbers">
  <dl>
    <div><dt>9</dt><dd>phases, idea to scale</dd></div>
    <div><dt>72</dt><dd>gate checks</dd></div>
    ...
  </dl>
  <p class="fine">Where the numbers come from.</p>
</section>
```

```css file=site/styles.css
/* numbers ledger */
.ledger { border-top: 2px solid var(--ink); border-bottom: 1px solid var(--rule); padding-top: 26px; padding-bottom: 22px; }
.ledger dl { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 18px; margin: 0; }
.ledger div { min-width: 0; }
.ledger dt { font: 400 clamp(40px, 6vw, 72px)/1 var(--serif); letter-spacing: -.02em; }
.ledger dd { margin: 6px 0 0; font-size: 14px; color: var(--ink-2); }
@media (max-width: 720px) { .ledger dl { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
```

### 7.5 Section head
Eyebrow, serif `h2`, one muted paragraph, at most 760px wide.

```html
<div class="sec-head">
  <p class="eyebrow">The pipeline</p>
  <h2>Nine phases. 72 checks. No &ldquo;trust me&rdquo;.</h2>
  <p>One sentence of context.</p>
</div>
```

```css file=site/styles.css
/* section heads */
.sec-head { max-width: 760px; margin-bottom: 32px; }
h2 { font: 400 clamp(32px, 4.6vw, 56px)/1.05 var(--serif); letter-spacing: -.015em; margin: 0 0 14px; text-wrap: balance; }
.sec-head p { color: var(--ink-2); margin: 0; }
h3 { font: 600 18px/1.3 var(--sans); margin: 0 0 6px; }
```

### 7.6 Tabs (a vertical list that becomes a horizontal scroller)
A list of tab buttons on the left, a panel on the right; on a phone the list scrolls sideways above the panel. The selected tab is inverted (ink background, paper text). Inside a panel: a serif `h3`, a mono caption, an uppercase mono `h4`, a checkbox-style list, and pill "slots".

```html
<div class="pipe">
  <div class="phase-list" role="tablist" aria-label="Phases" id="phase-tabs"></div>
  <div class="phase-panel" id="phase-panel" role="tabpanel" tabindex="0" aria-live="polite"></div>
</div>
```

Behaviour (see `site/app.js`): each tab is a `<button role="tab" aria-selected>`; Arrow Up/Down/Left/Right move between tabs and wrap, Home and End jump to the first and last, and the panel is replaced with the chosen item's content.

```css file=site/styles.css
/* pipeline */
.pipe { display: grid; grid-template-columns: 280px minmax(0, 1fr); border: 1px solid var(--rule); border-radius: 16px; overflow: hidden; background: var(--paper-2); }
.phase-list { display: flex; flex-direction: column; border-right: 1px solid var(--rule); }
.phase-tab { display: flex; align-items: baseline; gap: 12px; text-align: left; background: none; border: 0; border-bottom: 1px solid var(--rule); padding: 14px 18px; font: 500 15px/1.3 var(--sans); color: var(--ink-2); cursor: pointer; }
.phase-tab:last-child { border-bottom: 0; }
.phase-tab .num { font: 600 12px var(--mono); color: var(--accent); }
.phase-tab:hover { background: var(--paper); color: var(--ink); }
.phase-tab[aria-selected="true"] { background: var(--ink); color: var(--paper); }
.phase-tab[aria-selected="true"] .num { color: var(--accent); }
.phase-panel { padding: clamp(20px, 3vw, 36px); background: var(--paper); }
.phase-panel h3 { font: 400 clamp(28px, 3.4vw, 42px)/1.05 var(--serif); margin-bottom: 8px; }
.phase-panel .skillname { font: 13px var(--mono); color: var(--ink-2); margin: 0 0 20px; }
.phase-panel h4 { font: 600 12px var(--mono); letter-spacing: .12em; text-transform: uppercase; color: var(--ink-2); margin: 22px 0 10px; }
.gate-items { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.gate-items li { display: grid; grid-template-columns: 22px 1fr; gap: 10px; font-size: 15px; line-height: 1.5; }
.gate-items li::before { content: ""; width: 14px; height: 14px; margin-top: 5px; border: 2px solid var(--ink); border-radius: 3px; }
.slot-row { display: flex; flex-wrap: wrap; gap: 8px; }
.slot { font: 12.5px var(--mono); border: 1px solid var(--rule); border-radius: 999px; padding: 4px 11px; background: var(--paper-2); }
@media (max-width: 820px) {
  .pipe { grid-template-columns: minmax(0, 1fr); }
  .phase-list { flex-direction: row; overflow-x: auto; border-right: 0; border-bottom: 1px solid var(--rule); scrollbar-width: thin; }
  .phase-tab { border-bottom: 0; border-right: 1px solid var(--rule); white-space: nowrap; flex: none; }
}
```

### 7.7 Numbered rules
A two-column list of statements, each with a big accent serif numeral (01, 02, ...) generated by a CSS counter, a bold title and a muted sentence.

```html
<ol class="rule-list">
  <li><h3>Evidence or it did not happen</h3><p>One or two sentences.</p></li>
  <li><h3>Your decisions stay yours</h3><p>One or two sentences.</p></li>
</ol>
```

```css file=site/styles.css
/* rules */
.rule-list { list-style: none; counter-reset: r; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 clamp(24px, 5vw, 64px); }
.rule-list li { counter-increment: r; border-top: 1px solid var(--rule); padding: 22px 0 28px 56px; position: relative; }
.rule-list li::before { content: "0" counter(r); position: absolute; left: 0; top: 22px; font: 400 36px/1 var(--serif); color: var(--accent); }
.rule-list p { margin: 0; color: var(--ink-2); font-size: 16px; }
@media (max-width: 720px) { .rule-list { grid-template-columns: minmax(0, 1fr); } }
```

### 7.8 Filter chips, table and status tags
Pill-shaped toggle chips (`aria-pressed`) filter a table whose header is small uppercase mono. Status tags are mono pills: green for good, amber for opt-in, accent for blocked, grey for neutral (these colours also have dark-mode versions).

```html
<div class="chips"><button class="chip" aria-pressed="true">All <small>32</small></button> ...</div>
<div class="table-wrap"><table>
  <thead><tr><th>Tool</th><th>Status</th></tr></thead>
  <tbody><tr><td class="tool"><b>Name</b><span>owner/repo</span></td><td><span class="tag recommended">recommended</span></td></tr></tbody>
</table></div>
```

```css file=site/styles.css
/* bench */
.chips { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 18px; }
.chip { font: 500 13.5px var(--sans); background: none; color: var(--ink); border: 1px solid var(--rule); border-radius: 999px; padding: 7px 14px; cursor: pointer; }
.chip[aria-pressed="true"] { background: var(--ink); color: var(--paper); border-color: var(--ink); }
.chip small { font: 12px var(--mono); opacity: .7; margin-left: 6px; }
.table-wrap { border: 1px solid var(--rule); border-radius: 14px; overflow-x: auto; }
table { width: 100%; border-collapse: collapse; font-size: 14.5px; min-width: 760px; }
th { text-align: left; font: 600 12px var(--mono); letter-spacing: .1em; text-transform: uppercase; color: var(--ink-2); padding: 12px 16px; background: var(--paper-2); border-bottom: 1px solid var(--rule); }
td { padding: 13px 16px; border-bottom: 1px solid var(--rule); vertical-align: top; }
tr:last-child td { border-bottom: 0; }
td.tool b { display: block; font-weight: 600; }
td.tool span { font: 12px var(--mono); color: var(--ink-2); }
td.lic { font: 12.5px var(--mono); max-width: 170px; }
td.slots { font: 12px var(--mono); color: var(--ink-2); max-width: 200px; }
td.risk { color: var(--ink-2); max-width: 300px; }
.tag { display: inline-block; font: 600 11.5px var(--mono); padding: 3px 9px; border-radius: 999px; white-space: nowrap; }
.tag.recommended { background: #d8efd9; color: #1d4b24; }
.tag.opt-in { background: #f6e4b3; color: #5a4300; }
.tag.blocked-if-commercial { background: var(--accent); color: var(--accent-ink); }
.tag.reference-only, .tag.unreviewed { background: var(--paper-2); color: var(--ink-2); border: 1px solid var(--rule); }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) .tag.recommended { background: #234a2a; color: #c9f0cd; } :root:not([data-theme="light"]) .tag.opt-in { background: #4d3b0b; color: #f6e4b3; } }
```

### 7.9 Numbered steps (install)
A big accent serif number beside a dark code block.

```html
<div class="steps">
  <div class="step"><span class="n">1</span><pre><code>/plugin marketplace add owner/repo</code></pre></div>
  <div class="step"><span class="n">2</span><pre><code>/command "what you want"</code></pre></div>
</div>
```

```css file=site/styles.css
/* install */
.steps { display: grid; gap: 14px; max-width: 760px; margin-bottom: 18px; }
.step { display: grid; grid-template-columns: 44px 1fr; gap: 16px; align-items: start; }
.step .n { font: 400 40px/1 var(--serif); color: var(--accent); }
.step pre { margin: 0; background: var(--term); color: var(--term-ink); border-radius: 12px; padding: 16px 18px; font-size: 13.5px; overflow-x: auto; }
.step code { background: none; padding: 0; font-size: inherit; }
```

### 7.10 Honest-limits list and footer
A plain list with accent markers, and a footer that starts with the same heavy 2px ink rule as the stats row, so the page opens and closes on the same line.

```css file=site/styles.css
/* limits */
.limit-list { max-width: 760px; margin: 0; padding-left: 1.2em; display: grid; gap: 12px; color: var(--ink-2); }
.limit-list li::marker { color: var(--accent); }

.foot { max-width: calc(var(--max) + 2 * var(--gutter)); margin: 0 auto; border-top: 2px solid var(--ink); padding-top: 24px; padding-bottom: 48px; display: flex; flex-wrap: wrap; justify-content: space-between; gap: 8px 24px; }
.foot p { margin: 0; font-size: 15px; }
.noscript { padding: 16px var(--gutter); background: var(--paper-2); }
```

### 7.11 Feature block with a screenshot (the "live view" section)
A text column with a tick list (accent dots) and a call-to-action pill, next to a framed screenshot with a caption.

```css file=site/styles.css
/* live view section */
.watch { padding-top: 56px; padding-bottom: 24px; }
.watch-grid { display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr); gap: 36px; align-items: center; margin-top: 8px; }
.watch-shot { margin: 0; }
.watch-shot img { display: block; width: 100%; height: auto; border-radius: 12px; border: 1px solid var(--rule); background: var(--paper-2); }
.watch-shot figcaption { margin-top: 8px; font-size: 14px; color: var(--ink-2); }
.tick { list-style: none; margin: 0 0 20px; padding: 0; }
.tick li { padding: 10px 0 10px 24px; border-top: 1px solid var(--rule); position: relative; }
.tick li:first-child { border-top: 0; }
.tick li::before { content: ""; position: absolute; left: 0; top: 19px; width: 10px; height: 10px; border-radius: 50%; background: var(--accent); }
.solid { display: inline-flex; align-items: center; min-height: 48px; padding: 0 22px; border-radius: 999px; background: var(--ink); color: var(--paper); font-weight: 600; text-decoration: none; }
.solid:hover { background: var(--accent); color: var(--accent-ink); }
@media (max-width: 860px) { .watch-grid { grid-template-columns: 1fr; } }
```

### 7.12 Responsive and reduced-motion rules

```css file=site/styles.css
@media (max-width: 900px) {
  .hero { grid-template-columns: minmax(0, 1fr); }
  .term-body { min-height: 280px; }
}
@media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto; } * { transition: none !important; animation: none !important; } }

.hero > * { min-width: 0; }

@media (max-width: 520px) {
  .cmd { flex-wrap: wrap; padding: 12px; gap: 10px; }
  .cmd code { white-space: normal; word-break: break-all; }
  .cmd button { margin-left: 0; }
  .term-title { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
}
```

## 8. Motion

- `html { scroll-behavior: smooth }` for anchor links.
- The hero terminal prints one step every 1300ms, with a Replay button. With reduced motion it prints everything at once.
- Hover: nav links go from `--ink-2` to `--ink`; the pill and the solid button turn accent; the copy button brightens by 8% (`filter: brightness(1.08)`).
- Nothing else moves. Under `prefers-reduced-motion: reduce` all transitions and animations are switched off by the one rule in 7.12.

## 9. Dark mode

Dark mode follows the visitor's system setting: tokens are redefined inside `@media (prefers-color-scheme: dark)`, guarded by `:root:not([data-theme="light"])`, and again under `:root[data-theme="dark"]`. That gives a manual override for free: set `data-theme="light"` or `"dark"` on `<html>` (the site has no toggle button yet). The accent becomes lighter and the text on it flips to ink; the terminal stays dark in both modes. Test both: a design that only works in light mode is half finished.

## 10. Accessibility already built in

- Skip link (`.skip`) as the first element, visible on focus.
- A 3px accent focus ring on every focusable element (`:focus-visible`).
- Tabs use real roles and the full arrow, Home and End keys; the terminal output is an `aria-live` region.
- Touch targets: the pill and the solid button are at least 40 to 48px tall.
- Respects `prefers-reduced-motion` and `prefers-color-scheme`; `<meta name="theme-color">` for both.
- No inline `style` attributes or inline scripts, so a strict CSP works (`script-src 'self'`).
- A `<noscript>` message where the page depends on JavaScript.

What it does **not** have, so add it if you need it: a visible theme toggle, an icon set, form controls, modals, toasts, or a data-visualisation style. The live dashboard (`site/live/live.css`) is a separate, denser variant of the same tokens for an app screen.

## 11. Do and don't

| Do | Don't |
|---|---|
| Keep exactly one accent colour | Add a second accent, or use the accent as a large fill |
| Use serif only for big display text | Set body copy or buttons in the serif |
| Use mono for labels, commands, tags and table headers | Use mono for paragraphs |
| Separate with 1px rules and whitespace | Add card shadows, blur or gradients |
| Keep the one hard offset shadow for the single hero object | Put it on everything |
| Write short, plain sentences with numbers and evidence | Write marketing adjectives |
| Let sections be as wide as the hero, with one clear job each | Mix several card styles on one page |
| Check both colour modes and a 375px width | Ship after checking only the desktop light view |

## 12. Voice

Blunt, specific and evidence-first. Short declarative sentences; real numbers instead of adjectives; limits stated next to claims ("not launch-ready", "waived, with a reason"); labels such as "real output, not a mock-up". Headlines are a plain statement followed by a pointed one. Avoid exclamation marks, superlatives and filler.

## 13. Starter page

A complete minimal page using the tokens, base, layout, hero, ledger and footer. Save the CSS blocks from sections 3, 5, 6, 7.2, 7.4, 7.11 (for `.solid`) and 7.12 (responsive rules) as `styles.css` next to it, plus this one line, which lets the hero be a single column when there is no terminal beside it:

```css
.hero.single { grid-template-columns: minmax(0, 1fr); }
```

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Project name: one plain line</title>
<meta name="description" content="One sentence.">
<meta name="theme-color" content="#f3eee4" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#14110f" media="(prefers-color-scheme: dark)">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;600&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="styles.css">
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="top">
  <a class="brand" href="#top"><span class="mark" aria-hidden="true"></span>Project</a>
  <nav aria-label="Primary"><a href="#numbers">Numbers</a><a class="pill" href="#start">Get started</a></nav>
</header>
<main id="main">
  <section class="hero single" id="top">
    <div>
      <p class="eyebrow">What it is, in four words</p>
      <h1>A plain statement. <em>Then the sharp one.</em></h1>
      <p class="lede">Two sentences on what it does and what you get.</p>
      <div class="cta"><a class="solid" href="#start">Get started</a><a class="ghost" href="#numbers">See the numbers</a></div>
      <p class="fine">Who it is for. What it needs.</p>
    </div>
  </section>
  <section class="ledger" id="numbers" aria-label="By the numbers">
    <dl>
      <div><dt>9</dt><dd>things counted</dd></div>
      <div><dt>72</dt><dd>checks</dd></div>
      <div><dt>3</dt><dd>honest limits</dd></div>
      <div><dt>105</dt><dd>tests</dd></div>
      <div><dt>0</dt><dd>trackers</dd></div>
    </dl>
  </section>
</main>
<footer class="foot"><p>Project. Built in the open.</p><p class="fine">No analytics, no cookies, no trackers on this page.</p></footer>
</body>
</html>
```

## 14. Keeping this document honest

`tests/test_design_system.py` checks that every `css file=site/styles.css` block above is still present, character for character, in `site/styles.css`. If you change the site's CSS, update this file in the same change.
