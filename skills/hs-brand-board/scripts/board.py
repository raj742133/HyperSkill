#!/usr/bin/env python3
"""hs-brand-board: turn a small brand spec into one self-contained HTML brand board in a bento grid: logo, colours, type, voice, a sample of the UI.

    board.py SPEC.json [--out brand-board.html]
    board.py --example          print an example spec

Standard library only. Nothing is fetched: fonts are named in a fallback stack (add your real font files to the project; the board shows the
names), and the logo is embedded as an <img> data URI, so a script inside an SVG cannot run. Every colour tile is labelled with its measured
contrast against black and white text, and any palette pair that fails 4.5:1 is listed on the board. Text from the spec is escaped.
"""
import argparse
import base64
import html
import json
import os
import re
import sys

EXAMPLE = {
    "name": "Daybreak",
    "tagline": "Small habits, done daily.",
    "logo": "logo.svg",
    "colors": [{"name": "Ink", "hex": "#14110f", "role": "text"}, {"name": "Paper", "hex": "#fff8e1", "role": "background"},
               {"name": "Sun", "hex": "#ffe14d", "role": "highlight"}, {"name": "Blue", "hex": "#3b5bff", "role": "action"}],
    "fonts": {"display": "Archivo Black", "body": "Archivo", "mono": "Space Mono"},
    "voice": ["plain", "warm", "brief"],
    "dos": ["Use the blue only for the one action on a screen.", "Keep text on Ink or on Paper."],
    "donts": ["Put Sun text on Paper.", "Add gradients or shadows with blur."],
}
HEX = re.compile(r"^#[0-9a-fA-F]{6}$")


def lum(h):
    c = [int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    c = [x / 12.92 if x <= .03928 else ((x + .055) / 1.055) ** 2.4 for x in c]
    return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]


def ratio(a, b):
    la, lb = lum(a), lum(b)
    return (max(la, lb) + .05) / (min(la, lb) + .05)


def check(spec):
    errs = []
    if not isinstance(spec, dict) or not str(spec.get("name", "")).strip():
        errs.append("the spec needs a name")
    cols = spec.get("colors") or []
    if not 2 <= len(cols) <= 10:
        errs.append("give between 2 and 10 colours")
    for c in cols:
        if not isinstance(c, dict) or not HEX.match(str(c.get("hex", ""))):
            errs.append("colour %r needs a hex like #1a2b3c" % (c.get("name") if isinstance(c, dict) else c))
    for k in ("stats", "quotes", "customers"):
        if spec.get(k):
            errs.append("'%s' is not accepted: a brand board never shows numbers, quotes or customers unless they are real and sourced; put them in the copy yourself" % k)
    return errs


def esc(x):
    return html.escape(str(x), quote=True)


def logo_uri(spec, base):
    p = spec.get("logo")
    if not p:
        return None
    full = p if os.path.isabs(p) else os.path.join(base, p)
    if not os.path.isfile(full) or os.path.getsize(full) > 1024 * 1024:
        return None
    raw = open(full, "rb").read()
    mime = "image/svg+xml" if full.lower().endswith(".svg") else "image/png" if full.lower().endswith(".png") else None
    return ("data:%s;base64,%s" % (mime, base64.b64encode(raw).decode())) if mime else None


def build(spec, base="."):
    cols = spec["colors"]
    fonts = spec.get("fonts") or {}
    stack = lambda n, fb: "%s, %s" % (json.dumps(n) if n else fb.split(",")[0], fb)
    disp, body, mono = (stack(fonts.get("display"), "system-ui, sans-serif"), stack(fonts.get("body"), "system-ui, sans-serif"), stack(fonts.get("mono"), "ui-monospace, monospace"))
    bg = next((c["hex"] for c in cols if c.get("role") == "background"), cols[0]["hex"])
    fg = next((c["hex"] for c in cols if c.get("role") == "text"), "#000000")
    tiles = []
    logo = logo_uri(spec, base)
    tiles.append('<section class="t logo">%s<h1>%s</h1><p>%s</p></section>' % ('<img src="%s" alt="%s logo">' % (logo, esc(spec["name"])) if logo else "", esc(spec["name"]), esc(spec.get("tagline", ""))))
    sw = []
    for c in cols:
        best = max(("#000000", "#ffffff"), key=lambda t: ratio(c["hex"], t))
        sw.append('<li style="background:%s;color:%s"><b>%s</b><span>%s</span><small>%s on %s %.1f:1</small></li>' % (c["hex"], best, esc(c.get("name", "")), c["hex"].upper(), esc(c.get("role", "")), "black" if best == "#000000" else "white", ratio(c["hex"], best)))
    tiles.append('<section class="t colours"><h2>Colour</h2><ul>%s</ul></section>' % "".join(sw))
    tiles.append('<section class="t type"><h2>Type</h2><p class="d" style="font-family:%s">Aa Bb 123</p><p class="b" style="font-family:%s">%s</p><p class="m" style="font-family:%s">%s</p><small>%s</small></section>'
                 % (esc(disp), esc(body), esc(fonts.get("body", "System sans")), esc(mono), esc(fonts.get("mono", "System mono")), "Display: %s. Body: %s. Mono: %s." % (esc(fonts.get("display", "system")), esc(fonts.get("body", "system")), esc(fonts.get("mono", "system")))))
    if spec.get("voice"):
        tiles.append('<section class="t voice"><h2>Voice</h2><p>%s</p></section>' % " &middot; ".join(esc(v) for v in spec["voice"]))
    action = next((c["hex"] for c in cols if c.get("role") == "action"), cols[-1]["hex"])
    bt = max(("#000000", "#ffffff"), key=lambda t: ratio(action, t))
    tiles.append('<section class="t ui"><h2>In use</h2><div class="card"><strong>%s</strong><p>%s</p><button type="button" style="background:%s;color:%s">Get started</button></div></section>' % (esc(spec["name"]), esc(spec.get("tagline", "")), action, bt))
    if spec.get("dos") or spec.get("donts"):
        tiles.append('<section class="t rules"><div><h2>Do</h2><ul>%s</ul></div><div><h2>Don&rsquo;t</h2><ul>%s</ul></div></section>' % ("".join("<li>%s</li>" % esc(x) for x in spec.get("dos", [])), "".join("<li>%s</li>" % esc(x) for x in spec.get("donts", []))))
    bgs = [c for c in cols if c.get("role") == "background"]
    fails = [(c, g, ratio(c["hex"], g["hex"])) for c in cols if c.get("role") in ("text", "highlight", "action") for g in bgs]   # the colour that sits ON the background
    rows = "".join("<tr><td>%s on %s</td><td>%.1f:1</td><td>%s</td></tr>" % (esc(a.get("name")), esc(b.get("name")), r, "passes" if r >= 4.5 else "fails 4.5:1 for text") for a, b, r in fails)
    if rows:
        tiles.append('<section class="t contrast"><h2>Contrast</h2><table>%s</table><small>WCAG: 4.5:1 for text, 3:1 for large text and graphics.</small></section>' % rows)
    css = ("*{box-sizing:border-box}body{margin:0;padding:24px;background:%s;color:%s;font:16px/1.5 %s}h1,h2{font-family:%s;margin:0 0 8px}h2{font-size:14px;text-transform:uppercase;letter-spacing:.08em}"
           ".grid{display:grid;grid-template-columns:repeat(6,1fr);gap:16px;max-width:1100px;margin:0 auto}.t{border:3px solid %s;padding:20px;background:#fff8;min-width:0}"
           ".logo{grid-column:span 3;grid-row:span 2}.logo img{max-width:160px;max-height:160px;display:block;margin-bottom:12px}.logo h1{font-size:44px}.colours{grid-column:span 3}.colours ul{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px}"
           ".colours li{padding:12px;display:grid;gap:2px;border:2px solid %s}.type{grid-column:span 3}.type .d{font-size:40px;margin:0}.voice{grid-column:span 2}.ui{grid-column:span 2}.rules{grid-column:span 2;display:grid;gap:12px}.contrast{grid-column:span 3}"
           ".card{border:3px solid %s;padding:14px;background:%s}button{border:3px solid %s;padding:10px 16px;font:700 14px %s;min-height:44px}table{width:100%%;border-collapse:collapse}td{padding:4px 8px;border-bottom:1px solid #8884}ul{padding-left:18px;margin:0}"
           "@media(max-width:760px){.grid{grid-template-columns:1fr}.t{grid-column:auto!important;grid-row:auto!important}}" % (bg, fg, body, disp, fg, fg, fg, bg, fg, body))
    return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>%s brand board</title><style>%s</style></head><body><main class="grid">%s</main></body></html>\n' % (esc(spec["name"]), css, "".join(tiles))


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("spec", nargs="?")
    ap.add_argument("--out", default="brand-board.html")
    ap.add_argument("--example", action="store_true")
    a = ap.parse_args(argv)
    if a.example:
        print(json.dumps(EXAMPLE, indent=2))
        return 0
    if not a.spec or not os.path.isfile(a.spec):
        print("board: give the path of a spec (see --example)", file=sys.stderr)
        return 2
    try:
        spec = json.load(open(a.spec, encoding="utf-8"))
    except ValueError as e:
        print("board: the spec is not valid JSON: %s" % e, file=sys.stderr)
        return 2
    errs = check(spec)
    if errs:
        print("board: " + "; ".join(errs), file=sys.stderr)
        return 2
    out = build(spec, os.path.dirname(os.path.abspath(a.spec)))
    with open(a.out, "w", encoding="utf-8") as f:
        f.write(out)
    print("wrote %s (%d bytes)" % (a.out, len(out)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
