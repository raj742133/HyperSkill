#!/usr/bin/env python3
"""Copy Chaser's browser files into site/chaser so the Vercel site serves them at /chaser.

Chaser's page uses absolute paths (/app.js, /core/index.js) because its own server serves them from the root.
On the site they live under /chaser/, so the paths are rewritten here. Chaser has no server part to deploy:
the page makes no request after it loads. Use --check to fail when the copy is stale.
"""
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "examples", "chaser")
DST = os.path.join(ROOT, "site", "chaser")

REWRITES = {
    "index.html": [('href="/favicon.svg"', 'href="/chaser/favicon.svg"'), ('href="/styles.css"', 'href="/chaser/styles.css"'), ('src="/app.js"', 'src="/chaser/app.js"')],
    "app.js": [('from "/core/index.js"', 'from "/chaser/core/index.js"')],
}
FILES = {  # published name -> source path under examples/chaser
    "index.html": "public/index.html", "styles.css": "public/styles.css", "app.js": "public/app.js", "favicon.svg": "public/favicon.svg",
    "core/format.js": "src/core/format.js", "core/index.js": "src/core/index.js", "core/messages.js": "src/core/messages.js", "core/validate.js": "src/core/validate.js",
}


def build():
    out = {}
    for name, rel in FILES.items():
        with open(os.path.join(SRC, rel), encoding="utf-8") as f:
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
                sys.exit(f"site/chaser/{name} is out of date: run python3 scripts/sync_chaser.py")
        print("site/chaser is up to date")
        return
    for name, text in files.items():
        p = os.path.join(DST, name)
        os.makedirs(os.path.dirname(p), exist_ok=True)
        with open(p, "w", encoding="utf-8", newline="\n") as f:
            f.write(text)
    print(f"wrote {len(files)} files to site/chaser")


if __name__ == "__main__":
    main()
