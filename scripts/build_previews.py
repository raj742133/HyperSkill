#!/usr/bin/env python3
"""Draw the picture previews for the catalogue into site/live/previews/ (the videos come from capture_previews.mjs).

  build_previews.py [--only GROUP]

Generates, from scratch and without a network: before/after SVGs for the design tells, diagrams for the production concepts, mock-ups for
the site fixes and add-ons, wireframes for UI UX Pro Max's landing patterns and palette-and-keyword cards for its visual styles.
The font-pairing images and the Hyperfigure example screenshots need a browser and are made by render_pages.mjs. Standard library only.
"""
import csv
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import catalog_data as data  # noqa: E402
from preview_svg import *  # noqa: E402,F403
import preview_concepts as pc  # noqa: E402
import preview_tells as pt  # noqa: E402
import preview_ui as pu  # noqa: E402

ROOT = os.path.normpath(os.path.join(HERE, ".."))
OUT = os.path.join(ROOT, "site", "live", "previews")
DATA = os.path.join(ROOT, "packs", "ui-ux-pro-max", "skills", "ui-ux-pro-max", "data")


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")[:60]


def write(group, name, svg):
    os.makedirs(os.path.join(OUT, group), exist_ok=True)
    with open(os.path.join(OUT, group, name + ".svg"), "w", encoding="utf-8") as f:
        f.write(svg)


def landing(row):
    s = Svg(480, 270, "#efe8da", title=row["Pattern Name"])
    parts = [p.strip() for p in re.split(r">|→", row["Section Order"]) if p.strip()][:9]
    n = len(parts)
    s.rect(120, 10, 240, 250, PAPER, 10, LINE, 1.4)
    heights = [58 if i == 0 else 26 for i in range(n)]
    total = sum(heights) + 6 * (n - 1)
    k = min(1.0, 234 / total)
    y = 18
    for i, (p, h) in enumerate(zip(parts, heights)):
        h = h * k
        s.rect(128, y, 224, h, "#e6dccb" if i % 2 else "#ece3d2", 5, ACCENT if i == 0 else LINE, 1.2)
        s.text(240, y + h / 2 + 3.5, p[:34], 9.5, INK, 600, "middle")
        y += h + 6 * k
    s.text(372, 30, "CTA", 9.5, ACCENT, 700); s.text(372, 44, row["Primary CTA Placement"][:22], 8, MUTED)
    return s.render()


def hexes(text):
    return re.findall(r"#[0-9A-Fa-f]{6}\b", text or "")


def style_card(row):
    s = Svg(480, 200, "#efe8da", title=row["Style Category"])
    cols = []
    for c in hexes(row["Primary Colors"]) + hexes(row["Secondary Colors"]):
        if c.upper() not in cols:
            cols.append(c.upper())
    cols = cols[:8]
    s.rect(14, 14, 452, 172, PAPER, 12, LINE, 1.4)
    s.text(30, 44, row["Style Category"][:38], 18, INK, 800)
    s.text(30, 62, ("%s · %s" % (row["Type"], row.get("Era/Origin", "") or "")).strip(" ·")[:60], 10.5, MUTED, 600)
    if cols:
        w = min(48, 400 / len(cols))
        for i, c in enumerate(cols):
            s.rect(30 + i * (w + 4), 76, w, 38, c, 6, LINE)
    else:
        s.text(30, 100, "(palette described in words in the skill)", 10.5, MUTED)
    kw = [k.strip() for k in row["Keywords"].split(",")][:6]
    x, y = 30, 134
    for k in kw:
        wk = len(k) * 6.2 + 16
        if x + wk > 450:
            x, y = 30, y + 24
        s.rect(x, y, wk, 18, "#efe8da", 9); s.text(x + 8, y + 12.5, k, 9.5, INK, 600)
        x += wk + 6
    return s.render()


def main():
    only = sys.argv[sys.argv.index("--only") + 1] if "--only" in sys.argv else None
    def want(g): return only in (None, g)
    count = 0
    if want("tells"):
        for name, (b, g) in pt.TELLS.items():
            write("tells", name, pt.tell_svg(name, b, g)); count += 1
    if want("concepts"):
        for n, _, _, _ in [(c[0], 0, 0, 0) for c in data.CONCEPTS]:
            write("concepts", slug(n), pc.render(n, pc.V[n])); count += 1
    if want("fixes"):
        for n, _, _ in data.FIXES:
            write("fixes", slug(n), pu.render_fix(n)); count += 1
    if want("addons"):
        for n, _, _, _ in data.ADDONS:
            write("addons", slug(n), pu.render_addon(n)); count += 1
    if want("uu-landing"):
        with open(os.path.join(DATA, "landing.csv"), encoding="utf-8", newline="") as f:
            for r in csv.DictReader(f):
                write("uu-landing", slug(r["Pattern Name"]), landing(r)); count += 1
    if want("uu-styles"):
        with open(os.path.join(DATA, "styles.csv"), encoding="utf-8", newline="") as f:
            for r in csv.DictReader(f):
                write("uu-styles", slug(r["Style Category"]), style_card(r)); count += 1
    print("wrote %d svg previews" % count)


if __name__ == "__main__":
    main()
