#!/usr/bin/env python3
"""Copy Tide's browser files into site/tide so the Vercel site serves them at /tide.

The site serves pages without a trailing slash (cleanUrls), so relative links would resolve against the site root.
The paths in the two pages are therefore rewritten to /tide/... here. Use --check to fail when the copy is stale.
"""
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "examples", "tide")
DST = os.path.join(ROOT, "site", "tide")
PLAIN = ["styles.css", "legal.css", "app.js", "timer.js", "liquid.js", "favicon.svg"]
REWRITES = {
    "index.html": [('href="favicon.svg"', 'href="/tide/favicon.svg"'), ('href="styles.css"', 'href="/tide/styles.css"'), ('src="app.js"', 'src="/tide/app.js"'), ('href="privacy.html"', 'href="/tide/privacy.html"')],
    "privacy.html": [('href="favicon.svg"', 'href="/tide/favicon.svg"'), ('href="legal.css"', 'href="/tide/legal.css"'), ('href="./"', 'href="/tide"')],
}


def build():
    out = {}
    for name in PLAIN + list(REWRITES):
        with open(os.path.join(SRC, name), encoding="utf-8") as f:
            text = f.read()
        for a, b in REWRITES.get(name, []):
            if text.count(a) != 1:
                sys.exit(f"{name}: expected exactly one {a!r}")
            text = text.replace(a, b)
        out[name] = text
    return out


def main():
    files = build()
    if "--check" in sys.argv:
        for name, text in files.items():
            p = os.path.join(DST, name)
            if not os.path.exists(p) or open(p, encoding="utf-8").read() != text:
                sys.exit(f"site/tide/{name} is out of date: run python3 scripts/sync_tide.py")
        print("site/tide is up to date")
        return
    for name, text in files.items():
        with open(os.path.join(DST, name), "w", encoding="utf-8", newline="\n") as f:
            f.write(text)
    print(f"wrote {len(files)} files to site/tide")


if __name__ == "__main__":
    main()
