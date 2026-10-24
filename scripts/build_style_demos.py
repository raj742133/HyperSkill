#!/usr/bin/env python3
"""Build the ten self-contained style demos shown in the dashboard's "Popular visual styles" group.

  build_style_demos.py [--only SLUG]

Each scripts/style_demos/<slug>.html is a hand-designed page in one visual style, with the same product and the same content in all ten
(a habit tracker), so the styles can be compared. A source names its Google Fonts in a first-line comment, `<!--fonts: Family:wght@500;700 | Other:wght@400-->`.
This script fetches only the glyphs the demo uses, inlines them as base64, inlines shared.js, and writes the result to
site/live/previews/styles-popular/<slug>.html: one file, no network at view time. Fetching fonts needs the network once; use --cache DIR to keep them.
Standard library only.
"""
import argparse
import base64
import hashlib
import os
import re
import sys
import urllib.parse
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "style_demos")
OUT = os.path.normpath(os.path.join(HERE, "..", "site", "live", "previews", "styles-popular"))
UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"
HOSTS = ("https://fonts.googleapis.com/", "https://fonts.gstatic.com/")
GLYPHS = "".join(chr(c) for c in range(32, 127)) + "—–·•→←↑↓✓✕×…’‘“”©"


def get(url, cache):
    if not url.startswith(HOSTS):
        raise ValueError("refusing " + url)
    path = os.path.join(cache, hashlib.sha1(url.encode()).hexdigest()) if cache else None
    if path and os.path.exists(path):
        with open(path, "rb") as f:
            return f.read()
    with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=40) as r:
        data = r.read()
    if path:
        os.makedirs(cache, exist_ok=True)
        with open(path, "wb") as f:
            f.write(data)
    return data


def font_css(spec, cache):
    fams = [x.strip() for x in spec.split("|") if x.strip()]
    q = "&".join("family=" + urllib.parse.quote(f, safe=":@;,.") for f in fams)
    url = "https://fonts.googleapis.com/css2?%s&text=%s&display=block" % (q, urllib.parse.quote(GLYPHS))
    css = get(url, cache).decode("utf-8")
    css = re.sub(r"unicode-range:[^;]+;", "", css)
    # A variable font comes back once per weight with the same file: keep one @font-face per file and give it the weight range.
    faces, order = {}, []
    for block in re.findall(r"@font-face\s*\{.*?\}", css, re.S):
        fam = re.search(r"font-family:\s*([^;]+);", block).group(1)
        style = re.search(r"font-style:\s*([^;]+);", block).group(1)
        weight = int(re.search(r"font-weight:\s*(\d+);", block).group(1))
        src = re.search(r"url\((https://fonts\.gstatic\.com/[^)]+)\)", block).group(1)
        key = (fam, style, src)
        if key not in faces:
            faces[key] = []
            order.append(key)
        faces[key].append(weight)
    out = []
    for fam, style, src in order:
        w = faces[(fam, style, src)]
        data = base64.b64encode(get(src, cache)).decode()
        out.append("@font-face{font-family:%s;font-style:%s;font-weight:%d %d;font-display:block;src:url(data:font/woff2;base64,%s) format('woff2')}" % (fam, style, min(w), max(w), data))
    return "\n".join(out)


ICONS = """<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
<symbol id="i-drop" viewBox="0 0 24 24"><path d="M12 3c3 4 6 7 6 11a6 6 0 0 1-12 0c0-4 3-7 6-11Z"/></symbol>
<symbol id="i-book" viewBox="0 0 24 24"><path d="M5 4h10a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4Z"/><path d="M5 17a3 3 0 0 1 3-3h10"/></symbol>
<symbol id="i-moon" viewBox="0 0 24 24"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z"/></symbol>
<symbol id="i-spark" viewBox="0 0 24 24"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z"/></symbol>
<symbol id="i-flame" viewBox="0 0 24 24"><path d="M12 2c1 4-3 5-3 9a3 3 0 0 0 6 0c0-1-.4-1.8-1-2.6 3 1 5 3.6 5 6.6a7 7 0 0 1-14 0C5 7 12 7 12 2Z"/></symbol>
<symbol id="i-sun" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/></symbol>
<symbol id="i-list" viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h10"/></symbol>
<symbol id="i-bars" viewBox="0 0 24 24"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></symbol>
<symbol id="i-gear" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1"/></symbol>
<symbol id="i-check" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></symbol>
<symbol id="i-plus" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></symbol>
</defs></svg>"""


def build(slug, cache):
    with open(os.path.join(SRC, slug + ".html"), encoding="utf-8") as f:
        html = f.read()
    m = re.match(r"<!--fonts:\s*(.*?)\s*-->\s*", html)
    fonts = font_css(m.group(1), cache) if m else ""
    html = html[m.end():] if m else html
    with open(os.path.join(SRC, "shared.js"), encoding="utf-8") as f:
        js = f.read()
    html = html.replace("/*FONTS*/", fonts).replace("/*JS*/", js).replace("<!--ICONS-->", ICONS)
    probe = re.sub(r"data:font[^)]*\)", "", html).replace("http://www.w3.org/2000/svg", "")  # an SVG namespace is a name, not a request
    assert "/*FONTS*/" not in html and "http://" not in probe and "https://" not in probe, slug + ": a demo must not load anything"
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, slug + ".html"), "w", encoding="utf-8") as f:
        f.write(html)
    return len(html)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only")
    ap.add_argument("--cache", default=os.path.join(os.environ.get("TMPDIR", "/tmp"), "hs-style-fonts"))
    a = ap.parse_args()
    names = sorted(n[:-5] for n in os.listdir(SRC) if n.endswith(".html"))
    for n in names:
        if a.only and n != a.only:
            continue
        print("%-14s %6.1f KB" % (n, build(n, a.cache) / 1024))


if __name__ == "__main__":
    main()
