#!/usr/bin/env python3
"""Rebuild docs/design-system.md from site/styles.css so the document and the stylesheet cannot drift.

    python3 scripts/build_design_doc.py          write the document
    python3 scripts/build_design_doc.py --check  exit 1 if the document is out of date

Every CSS block in the document is a literal slice of site/styles.css (tests/test_design_system.py checks that).
"""
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CSS = os.path.join(ROOT, "site", "styles.css")
DOC = os.path.join(ROOT, "docs", "design-system.md")

# (title, first line of the slice, what it is). A slice runs to the next slice's first line.
PARTS = [
    ("Tokens and dark theme", "/* Neo-brutalism", "The colours, the one border width, the one shadow offset and the three typefaces, plus the dark theme (a system setting or `data-theme`)."),
    ("Base", "* { box-sizing: border-box; }", "Reset, the grid-paper page background, links, inline code, the focus ring and the skip link."),
    ("Header, brand mark and nav", ".top, main > section, .foot {", "Header, brand square, nav links, the lime install pill, section spacing, the black eyebrow label."),
    ("Hero, command box and buttons", "/* hero */", "The headline with its pink block, the yellow command box and the ghost button."),
    ("Terminal card", "/* terminal */", "A black terminal under a yellow title bar, with a hard pink shadow."),
    ("Numbers strip", "/* numbers ledger */", "A row of flat-colour cells, each one big number and a label."),
    ("Section heads", "/* section heads */", "Display headings in capitals and the sub-heading scale."),
    ("Tabs (a list that becomes a scroller)", "/* pipeline */", "A boxed tab list and panel; on a phone the list scrolls sideways inside itself."),
    ("Numbered rules", "/* rules */", "Boxed list items with a coloured number tile."),
    ("Chips, table and status tags", "/* bench */", "Toggle chips, a boxed table and flat status tags."),
    ("Numbered steps", "/* install */", "Install steps: a pink number tile and a boxed code block."),
    ("Limits list, footer and small-screen rules", "/* limits */", "The honest-limits list, the footer, reduced motion and the phone adjustments."),
    ("Feature block with a screenshot", "/* live view section */", "Copy next to a bordered, shadowed screenshot; plus the solid button."),
    ("Screenshot rows, pack list, style grid, tour and card grid", ".dash, .packs, .styles, .tour, .more {", "Rows, lists and grids built from the same border, shadow and flat fills."),
]

HEAD = '''# HyperSkill design system

The look of the HyperSkill site, written down so it can be reused. **Neo-brutalism**: flat saturated fills, one thick black border, one hard offset shadow, heavy capital headlines, a monospace for "the system speaking". It follows this project's own recipe for the style (`skills/hs-product/references/style-recipes.md`).

- Source of truth: [`site/styles.css`](../site/styles.css), [`site/index.html`](../site/index.html), [`site/app.js`](../site/app.js). Live: https://hyperskill-hazel.vercel.app
- Every CSS block below is copied exactly from `site/styles.css` by `scripts/build_design_doc.py`, and a test fails if they drift apart, so you can paste them as they are.
- Plain HTML and CSS, no framework, no build step, no icon library, no images needed for the look.

**Preview.** The starter page from the last section, built from this document's CSS and nothing else: light on a desktop, dark on a phone.

<img src="img/design-system-starter-light.png" alt="The starter page in light mode: a black wordmark with a pink square, a heavy capital headline with a pink block, a yellow command button, and a strip of flat-colour number cells" width="640"> <img src="img/design-system-starter-dark-phone.png" alt="The same starter page on a phone in dark mode, with yellow hard shadows" width="200">

## What makes it look like this (the rules)

1. **One border width, one shadow offset.** `--bw` (3px) on every box, `--off` (6px, 4px on phones) for every shadow. Nothing else. This is what makes it deliberate instead of messy.
2. **Hard shadows only.** A solid offset block in `--shadow` (black; yellow in dark mode). No blur, no gradients, no glass, no rounded corners.
3. **Flat fills with a job.** `--yellow` for commands and highlights, `--pink` for the accent, `--lime` for "go" and good states, `--blue` for links and one fill. Text on any fill is always `--on-fill` (black), except white on blue.
4. **Heavy display, calm body.** `--display` (Archivo Black, capitals, tight) for headings and big numbers; `--sans` (Archivo) for reading; `--mono` (Space Mono) for labels, commands, tags and table headers.
5. **Grid paper.** A faint 32px grid on the page background makes the structure visible. It is decoration, so text contrast is measured against the page colour underneath.
6. **A focus ring that is not the border.** `:focus-visible` is a 4px outline in `--focus` (blue; yellow in dark mode), offset by 4px, so it never disappears into a border.
7. **Hover changes colour and shadow, not layout.** Buttons shrink their shadow and take a new fill; nothing moves the page.
8. **Mostly still.** Smooth anchor scroll, hover colour changes, a terminal that types its lines. Everything stops under `prefers-reduced-motion`.

## Quick start

1. Fonts (Archivo Black, Archivo, Space Mono from Google Fonts), in `<head>`:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo+Black&family=Archivo:wght@400;500;700;800&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet">
<meta name="theme-color" content="#fff8e1" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0f0f0f" media="(prefers-color-scheme: dark)">
```

2. Paste the tokens and the base, then the header and hero.
3. Add the components you need. Each one is independent.

If a page has a strict Content-Security-Policy, the Google Fonts link needs `style-src https://fonts.googleapis.com` and `font-src https://fonts.gstatic.com`; to avoid that, self-host the three families.

## Tokens

| Token | Light | Dark | Use |
|---|---|---|---|
| `--paper` | `#fff8e1` | `#0f0f0f` | Page background |
| `--paper-2` | `#ffffff` | `#1b1b1b` | Panels, cards, table body |
| `--ink` | `#000000` | `#ffffff` | Text |
| `--line` | `#000000` | `#ffffff` | Every border |
| `--shadow` | `#000000` | `#ffe14d` | Every hard shadow |
| `--pink` | `#ff4fa3` | same | The accent; headline block, selected tab |
| `--yellow` | `#ffe14d` | same | Commands, table head, highlights |
| `--blue` | `#3b5bff` | same | Links, one fill, the focus ring (light) |
| `--lime` | `#b6ff3b` | same | Install pill, "recommended", slot tags |
| `--on-fill` | `#000000` | same | Text on any colour fill |
| `--focus` | `#3b5bff` | `#ffe14d` | Focus ring |
| `--bw` | `3px` | same | The one border width |
| `--off` | `6px` (4px on phones) | same | The one shadow offset |

**Contrast** is measured, not eyeballed, with this project's `hs-a11y-review` tools: `page_contrast.py` reads every text element as Chrome paints it, in light and dark, and finds no failures on the site (4.5:1 for text, 3:1 for large text and focus rings). The tightest pair is white on `--blue` at about 5.1:1. Re-run it after any colour change.

## The stylesheet, in blocks
'''

TAIL = '''
## Starter page

A complete minimal page using the blocks above. Save the CSS blocks for tokens, base, header, hero, numbers strip and the small-screen rules as `styles.css` next to it, plus this one line:

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
<meta name="theme-color" content="#fff8e1" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0f0f0f" media="(prefers-color-scheme: dark)">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo+Black&family=Archivo:wght@400;500;700;800&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet">
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

## Do and don't

- **Do** keep one border width and one shadow offset. **Don't** add a second of either "just here".
- **Do** put black text on every fill. **Don't** put pink text on yellow, or grey text on anything.
- **Do** let the focus ring differ from the border. **Don't** remove it because the control "already has an outline".
- **Do** measure contrast and tap targets (`hs-a11y-review`, `hs-responsive`). **Don't** judge a yellow-on-cream pair by eye.
- **Don't** use a gradient, a blur or a rounded corner; if the page needs softness, this is the wrong style for it.

## Keeping this document honest

`scripts/build_design_doc.py` writes this file from `site/styles.css`; `tests/test_design_system.py` checks that every `css file=site/styles.css` block is still present, character for character, in the stylesheet, and that every token named here is defined. If you change the site's CSS, run the script in the same change.
'''


def build():
    css = open(CSS, encoding="utf-8").read().rstrip("\n")
    idx = []
    for title, first, _ in PARTS:
        i = css.find(first)
        if i < 0:
            raise SystemExit("build_design_doc: cannot find the start of %r (%r) in site/styles.css" % (title, first))
        idx.append(i)
    if idx != sorted(idx):
        raise SystemExit("build_design_doc: the parts are out of order in site/styles.css")
    idx.append(len(css))
    out = [HEAD]
    for n, (title, _, what) in enumerate(PARTS):
        block = css[idx[n]:idx[n + 1]].strip("\n")
        out.append("\n### %d. %s\n\n%s\n\n```css file=site/styles.css\n%s\n```\n" % (n + 1, title, what, block))
    out.append(TAIL)
    return "".join(out)


if __name__ == "__main__":
    text = build()
    if "--check" in sys.argv:
        cur = open(DOC, encoding="utf-8").read() if os.path.exists(DOC) else ""
        sys.exit(0 if cur == text else 1)
    open(DOC, "w", encoding="utf-8").write(text)
    print("wrote docs/design-system.md (%d blocks)" % len(PARTS))
