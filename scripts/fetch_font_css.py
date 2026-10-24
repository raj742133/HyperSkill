#!/usr/bin/env python3
"""Fetch the Google Fonts CSS for UI UX Pro Max's font pairings and inline the Latin font files, so render_pages.mjs can draw the
font-pairing cards with no network in the browser. The fonts stay in the output folder (not in the repository); only the rendered
pictures are kept.

  fetch_font_css.py OUTDIR
"""
import base64
import csv
import os
import re
import sys
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "..", "packs", "ui-ux-pro-max", "skills", "ui-ux-pro-max", "data", "typography.csv")
UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"
HOSTS = ("https://fonts.googleapis.com/", "https://fonts.gstatic.com/")


def get(url):
    if not url.startswith(HOSTS):
        raise ValueError("refusing " + url)
    with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=30) as r:
        return r.read()


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")[:60]


def main(out):
    os.makedirs(out, exist_ok=True)
    ok = 0
    with open(DATA, encoding="utf-8", newline="") as f:
        for row in csv.DictReader(f):
            m = re.search(r"url\('?(https://fonts\.googleapis\.com/[^')]+)", row["CSS Import"] or row["Google Fonts URL"])
            url = m.group(1) if m else (row["Google Fonts URL"] or "").strip()
            try:
                css = get(url).decode("utf-8")
                blocks = re.findall(r"(/\*\s*([^*]*?)\s*\*/\s*@font-face\s*\{.*?\})", css, re.S)
                keep = [b for b, tag in blocks if tag == "latin"] or [b for b, _ in blocks[:2]]
                done = []
                for b in keep:
                    def inline(mm):
                        return "url(data:font/woff2;base64,%s)" % base64.b64encode(get(mm.group(1))).decode()
                    done.append(re.sub(r"url\((https://fonts\.gstatic\.com/[^)]+)\)", inline, b))
                with open(os.path.join(out, slug(row["Font Pairing Name"]) + ".css"), "w", encoding="utf-8") as g:
                    g.write("\n".join(done))
                ok += 1
            except Exception as exc:  # one missing family must not stop the rest
                print("skip", row["Font Pairing Name"], str(exc)[:80])
    print("fetched css for %d pairings" % ok)


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "fontcss")
