#!/usr/bin/env python3
"""hs-logo: check a logo SVG, build a test sheet that shows where it breaks, and export the icon set.

    logo.py audit LOGO.svg [--json]            problems and warnings; exit 1 on an error
    logo.py test  LOGO.svg --out DIR           test-sheet.html (+ test-sheet.png when a browser is found)
    logo.py kit   LOGO.svg --out DIR [--name N] [--theme #hex] [--background #hex]
    logo.py which                              the browser used for rendering, if any

Standard library only. PNG rendering needs a Chrome-family browser (HYPERSKILL_CHROME, or google-chrome,
chromium on PATH); without one the HTML sheet and the SVG-only parts of the kit are still written.
The SVG is only ever loaded as an <img>, so any script inside it cannot run.
"""
import argparse
import base64
import json
import math
import os
import re
import shutil
import struct
import subprocess
import sys
import tempfile
import xml.etree.ElementTree as ET

NS = "{http://www.w3.org/2000/svg}"
MAX_SVG = 2 * 1024 * 1024
SIZES = {"favicon-16.png": 16, "favicon-32.png": 32, "favicon-48.png": 48, "apple-touch-icon.png": 180,
         "icon-192.png": 192, "icon-512.png": 512}
NUM = re.compile(r"[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?")


def local(tag):
    return tag.split("}")[-1] if isinstance(tag, str) else ""


def load(path):
    if os.path.getsize(path) > MAX_SVG:
        raise SystemExit("logo: %s is larger than 2 MB" % path)
    raw = open(path, "rb").read()
    if b"<!ENTITY" in raw or b"<!DOCTYPE" in raw and b"[" in raw.split(b">")[0]:
        raise SystemExit("logo: the file declares entities; refusing to parse it")
    try:
        return ET.fromstring(raw), raw
    except ET.ParseError as e:
        raise SystemExit("logo: not valid SVG/XML: %s" % e)


def colours(root):
    found = set()
    for el in root.iter():
        for k in ("fill", "stroke", "stop-color", "color"):
            v = el.get(k)
            if v:
                found.add(v.strip().lower())
        st = el.get("style") or ""
        for k, v in re.findall(r"(fill|stroke|stop-color|color)\s*:\s*([^;]+)", st):
            found.add(v.strip().lower())
    return {c for c in found if c not in ("none", "transparent", "inherit")}


def path_points(d):
    """Rough control and end points of a path, enough for a bounding box."""
    pts, x, y, sx, sy = [], 0.0, 0.0, 0.0, 0.0
    for cmd, args in re.findall(r"([MmLlHhVvCcSsQqTtAaZz])([^MmLlHhVvCcSsQqTtAaZz]*)", d):
        n = [float(v) for v in NUM.findall(args)]
        rel = cmd.islower()
        c = cmd.upper()
        if c == "Z":
            x, y = sx, sy
            continue
        step = {"M": 2, "L": 2, "H": 1, "V": 1, "C": 6, "S": 4, "Q": 4, "T": 2, "A": 7}[c]
        for i in range(0, len(n) - step + 1, step):
            a = n[i:i + step]
            if c == "H":
                x = x + a[0] if rel else a[0]
                pts.append((x, y))
            elif c == "V":
                y = y + a[0] if rel else a[0]
                pts.append((x, y))
            elif c == "A":
                ex, ey = (x + a[5], y + a[6]) if rel else (a[5], a[6])
                r = max(a[0], a[1])
                pts += [(ex, ey), (ex - r, ey - r), (ex + r, ey + r)] if False else [(ex, ey)]
                x, y = ex, ey
            else:
                for j in range(0, step, 2):
                    px, py = (x + a[j], y + a[j + 1]) if rel else (a[j], a[j + 1])
                    pts.append((px, py))
                x, y = pts[-1]
            if c == "M":
                sx, sy = x, y
                c = "L"
    return pts


def bbox(root):
    pts = []
    for el in root.iter():
        t = local(el.tag)
        g = lambda k, d=0.0: float(NUM.findall(el.get(k, ""))[0]) if NUM.findall(el.get(k, "")) else d
        try:
            if t == "rect":
                pts += [(g("x"), g("y")), (g("x") + g("width"), g("y") + g("height"))]
            elif t == "circle":
                pts += [(g("cx") - g("r"), g("cy") - g("r")), (g("cx") + g("r"), g("cy") + g("r"))]
            elif t == "ellipse":
                pts += [(g("cx") - g("rx"), g("cy") - g("ry")), (g("cx") + g("rx"), g("cy") + g("ry"))]
            elif t == "line":
                pts += [(g("x1"), g("y1")), (g("x2"), g("y2"))]
            elif t in ("polygon", "polyline"):
                n = [float(v) for v in NUM.findall(el.get("points", ""))]
                pts += list(zip(n[0::2], n[1::2]))
            elif t == "path":
                pts += path_points(el.get("d", ""))
        except (ValueError, IndexError):
            continue
    if not pts:
        return None
    xs, ys = [p[0] for p in pts], [p[1] for p in pts]
    return min(xs), min(ys), max(xs), max(ys)


def view_box(root):
    vb = root.get("viewBox")
    if vb:
        n = [float(v) for v in NUM.findall(vb)]
        if len(n) == 4 and n[2] > 0 and n[3] > 0:
            return n
    return None


def audit(path):
    root, raw = load(path)
    out = []
    add = lambda level, code, msg: out.append({"level": level, "code": code, "message": msg})
    if local(root.tag) != "svg":
        add("error", "not-svg", "the root element is %s, not svg" % local(root.tag))
        return out
    tags = [local(e.tag) for e in root.iter()]
    attrs = [(k, v) for e in root.iter() for k, v in e.attrib.items()]
    if "script" in tags:
        add("error", "script", "contains a <script>; a logo file must be inert")
    if any(k.lower().startswith("on") and k[2:3].isalpha() for k, _ in attrs):
        add("error", "handler", "contains an event-handler attribute (onclick, onload, ...)")
    if "foreignObject" in tags:
        add("error", "foreign-object", "contains <foreignObject> (HTML inside the SVG): not portable, not safe")
    for k, v in attrs:
        if local(k) == "href" and not v.startswith("#"):
            add("error", "external", "references %s; a logo must not depend on anything outside the file" % v[:60])
            break
    if "image" in tags:
        add("error", "raster", "embeds a raster <image>; a logo is vector artwork")
    if re.search(rb"url\(\s*['\"]?https?:", raw):
        add("error", "external-css", "a style loads a remote resource")
    if "text" in tags or "tspan" in tags:
        add("warn", "live-text", "uses live <text>: the font will change on any machine without it. Convert the letters to outlines for the final file.")
    vb = view_box(root)
    if not vb:
        add("warn", "no-viewbox", "no viewBox, so it will not scale cleanly; add one such as viewBox=\"0 0 64 64\"")
    cols = colours(root)
    real = {c for c in cols if c != "currentcolor"}
    if len(real) > 4:
        add("warn", "many-colours", "%d colours (%s...). Most marks need one to three." % (len(real), ", ".join(sorted(real)[:4])))
    if {"linearGradient", "radialGradient"} & set(tags):
        add("warn", "gradient", "uses a gradient: it will not survive one-colour printing, embossing or a 16 px favicon")
    if {"filter", "mask", "feGaussianBlur", "feDropShadow"} & set(tags):
        add("warn", "effects", "uses a filter or mask; drop shadows and blurs are decoration, not identity, and many renderers differ")
    if any(k == "opacity" or k.endswith("-opacity") for k, _ in attrs):
        add("warn", "opacity", "uses partial opacity, so the colours change on every background; use solid colours")
    paths = [e for e in root.iter() if local(e.tag) == "path"]
    commands = sum(len(re.findall(r"[MmLlHhVvCcSsQqTtAaZz]", e.get("d", ""))) for e in paths)
    nodes = len([t for t in tags if t in ("path", "rect", "circle", "ellipse", "line", "polygon", "polyline")])
    if commands > 400 or nodes > 60:
        add("warn", "complex", "%d path commands in %d shapes: this is an illustration. A logo you can draw from memory has far fewer." % (commands, nodes))
    box = bbox(root)
    if vb and box:
        x0, y0, x1, y1 = box
        w, h = vb[2], vb[3]
        cx, cy = ((x0 + x1) / 2 - vb[0]) / w, ((y0 + y1) / 2 - vb[1]) / h
        if abs(cx - .5) > .05 or abs(cy - .5) > .05:
            add("warn", "off-centre", "the artwork's bounding box is centred at %.0f%% / %.0f%% of the canvas, not 50%% / 50%%" % (cx * 100, cy * 100))
        fill = max((x1 - x0) / w, (y1 - y0) / h)
        if fill < .4:
            add("warn", "small", "the artwork fills only %.0f%% of the canvas, so it will look small next to other marks" % (fill * 100))
        if fill > .98 and (x0 <= vb[0] + 0.01 or x1 >= vb[0] + w - 0.01):
            add("warn", "no-margin", "the artwork touches the edge of the canvas: no clear space, and strokes may clip")
    strokes = []
    for e in root.iter():
        sw = e.get("stroke-width") or (re.search(r"stroke-width\s*:\s*([\d.]+)", e.get("style") or "") or [None, None])[1]
        if sw and NUM.match(str(sw)):
            strokes.append(float(NUM.findall(str(sw))[0]))
    if vb and strokes and min(strokes) / max(vb[2], vb[3]) < .02:
        add("warn", "thin-stroke", "a stroke is %.1f%% of the canvas; at 16 px it is under a pixel and vanishes" % (min(strokes) / max(vb[2], vb[3]) * 100))
    if not out:
        add("ok", "clean", "nothing to flag. That does not mean it is good: run the test sheet and look.")
    return out


def find_browser():
    env = os.environ.get("HYPERSKILL_CHROME")
    if env and os.path.isfile(env):
        return env
    for n in ("google-chrome", "google-chrome-stable", "chromium", "chromium-browser", "chrome"):
        p = shutil.which(n)
        if p:
            return p
    for p in ("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/opt/pw-browsers/chromium"):
        if os.path.isfile(p) and os.access(p, os.X_OK):
            return p
    return None


def shot(html_path, png_path, w, h, transparent=True):
    exe = find_browser()
    if not exe:
        return False
    cmd = [exe, "--headless", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1",
           "--window-size=%d,%d" % (w, h), "--screenshot=" + png_path]
    if transparent:
        cmd.append("--default-background-color=00000000")
    if hasattr(os, "geteuid") and os.geteuid() == 0:
        cmd.append("--no-sandbox")
    with tempfile.TemporaryDirectory(prefix="hs-logo-") as prof:
        cmd += ["--user-data-dir=" + prof, "file://" + os.path.abspath(html_path)]
        try:
            subprocess.run(cmd, capture_output=True, timeout=90)
        except subprocess.TimeoutExpired:
            return False
    return os.path.isfile(png_path) and os.path.getsize(png_path) > 0


def crop_png(path, w, h):
    """Keep the top-left w x h of an 8-bit RGB or RGBA PNG (Chrome will not make a window smaller than about 500 px)."""
    import zlib
    d = open(path, "rb").read()
    pos, idat, W, H = 8, b"", 0, 0
    while pos < len(d):
        n, kind = struct.unpack(">I4s", d[pos:pos + 8])
        body = d[pos + 8:pos + 8 + n]
        if kind == b"IHDR":
            W, H, depth, ctype, _, _, inter = struct.unpack(">IIBBBBB", body)
            if depth != 8 or ctype not in (2, 6) or inter:
                return False
            bpp = 4 if ctype == 6 else 3
        elif kind == b"IDAT":
            idat += body
        pos += 12 + n
    raw, stride, rows, prev = zlib.decompress(idat), W * bpp, [], bytearray(W * bpp)
    i = 0
    for _ in range(H):
        f, line = raw[i], bytearray(raw[i + 1:i + 1 + stride])
        i += 1 + stride
        for x in range(stride):
            a = line[x - bpp] if x >= bpp else 0
            b = prev[x]
            c = prev[x - bpp] if x >= bpp else 0
            if f == 1: line[x] = (line[x] + a) & 255
            elif f == 2: line[x] = (line[x] + b) & 255
            elif f == 3: line[x] = (line[x] + (a + b) // 2) & 255
            elif f == 4:
                pa, pb, pc = abs(b - c), abs(a - c), abs(a + b - 2 * c)
                line[x] = (line[x] + (a if pa <= pb and pa <= pc else b if pb <= pc else c)) & 255
        rows.append(bytes(line))
        prev = line
    out = b"".join(b"\x00" + r[:w * bpp] for r in rows[:h])
    def chunk(k, body):
        c = struct.pack(">I", len(body)) + k + body
        return c + struct.pack(">I", zlib.crc32(k + body) & 0xffffffff)
    open(path, "wb").write(b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, ctype, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(out, 9)) + chunk(b"IEND", b""))
    return True


def data_uri(raw):
    return "data:image/svg+xml;base64," + base64.b64encode(raw).decode()


def render_png(raw, size, png_path, pad=0.0, background=None):
    """Render the SVG at size x size, optionally on a solid background with padding (a fraction of the size)."""
    inner = int(round(size * (1 - 2 * pad)))
    off = (size - inner) // 2
    bg = "background:%s;" % background if background else ""
    html = ('<!doctype html><meta charset="utf-8"><style>html,body{margin:0;padding:0;%sheight:%dpx;width:%dpx;overflow:hidden}'
            'img{position:absolute;left:%dpx;top:%dpx;width:%dpx;height:%dpx}</style><img alt="" src="%s">'
            % (bg, size, size, off, off, inner, inner, data_uri(raw)))
    with tempfile.TemporaryDirectory(prefix="hs-logo-") as d:
        p = os.path.join(d, "r.html")
        open(p, "w").write(html)
        big = max(size, 600)
        ok = shot(p, png_path, big, big, transparent=not background)
        return ok and (big == size or crop_png(png_path, size, size))


def ico(pngs):
    """An .ico holding PNG images (valid since Windows Vista and in every browser)."""
    entries, blobs, off = b"", b"", 6 + 16 * len(pngs)
    for size, data in pngs:
        entries += struct.pack("<BBBBHHII", size % 256, size % 256, 0, 0, 1, 32, len(data), off + len(blobs))
        blobs += data
    return struct.pack("<HHH", 0, 1, len(pngs)) + entries + blobs


def cmd_test(svg, out):
    root, raw = load(svg)
    os.makedirs(out, exist_ok=True)
    src = data_uri(raw)
    cols = sorted(colours(root) - {"currentcolor"})
    brand = next((c for c in cols if c.startswith("#")), "#1b4dff")
    html = """<!doctype html><meta charset="utf-8"><title>Logo test sheet</title>
<style>
body{margin:0;font:14px/1.4 system-ui,sans-serif;background:#f4f2ee;color:#1d1b17;padding:32px}
h1{font-size:20px;margin:0 0 4px}p.s{margin:0 0 24px;color:#5a5649}
section{background:#fff;border:1px solid #d8d3c7;border-radius:8px;padding:16px;margin:0 0 16px}
h2{font-size:13px;letter-spacing:.06em;text-transform:uppercase;margin:0 0 12px;color:#5a5649}
.row{display:flex;gap:24px;align-items:flex-end;flex-wrap:wrap}.cell{display:grid;gap:6px;justify-items:center;font-size:12px;color:#5a5649}
.cell>div{padding:12px;border-radius:6px;display:grid;place-items:center}
.w{background:#fff;border:1px solid #e5e1d6}.k{background:#111}.b{background:%(brand)s}.g{background:#8b8b8b}.y{background:#ffe14d}
.one img{filter:brightness(0)}.rev img{filter:brightness(0) invert(1)}.sq img{filter:blur(var(--b,3px))}.mi img{transform:scaleX(-1)}.rot img{transform:rotate(180deg)}
.gray img{filter:grayscale(1)}
.tab{display:flex;gap:8px;align-items:center;background:#dee1e6;border-radius:8px 8px 0 0;padding:8px 12px;width:220px;font:12px system-ui}
.tab img{width:16px;height:16px}
.px img{image-rendering:pixelated}
</style>
<h1>Logo test sheet</h1><p class="s">%(name)s. Look at each block for what disappears, merges or turns into something else.</p>
<section><h2>Size ladder (real pixels)</h2><div class="row">%(ladder)s</div></section>
<section><h2>One colour, reversed, grey</h2><div class="row">
<div class="cell one"><div class="w"><img src="%(src)s" width="96" height="96"></div>black: does the shape survive?</div>
<div class="cell rev"><div class="k"><img src="%(src)s" width="96" height="96"></div>white on black</div>
<div class="cell gray"><div class="w"><img src="%(src)s" width="96" height="96"></div>greyscale</div></div></section>
<section><h2>On backgrounds</h2><div class="row">
<div class="cell"><div class="w"><img src="%(src)s" width="96" height="96"></div>white</div>
<div class="cell"><div class="k"><img src="%(src)s" width="96" height="96"></div>black</div>
<div class="cell"><div class="b"><img src="%(src)s" width="96" height="96"></div>brand colour</div>
<div class="cell"><div class="g"><img src="%(src)s" width="96" height="96"></div>mid grey</div>
<div class="cell"><div class="y"><img src="%(src)s" width="96" height="96"></div>yellow</div></div></section>
<section><h2>Squint, mirror, upside down</h2><div class="row">
<div class="cell sq"><div class="w"><img src="%(src)s" width="96" height="96"></div>blurred: is the shape still there?</div>
<div class="cell sq" style="--b:6px"><div class="w"><img src="%(src)s" width="96" height="96"></div>blurred more</div>
<div class="cell mi"><div class="w"><img src="%(src)s" width="96" height="96"></div>mirrored: any accident?</div>
<div class="cell rot"><div class="w"><img src="%(src)s" width="96" height="96"></div>upside down</div></div></section>
<section><h2>In context</h2><div class="row"><div class="cell"><div class="tab"><img src="%(src)s">%(name)s</div>browser tab</div>
<div class="cell"><div class="w" style="width:60px;height:60px;border-radius:14px;padding:6px"><img src="%(src)s" width="48" height="48"></div>app icon</div>
<div class="cell"><div class="w" style="width:48px;height:48px;border-radius:50%%;overflow:hidden;padding:4px"><img src="%(src)s" width="40" height="40"></div>avatar (round crop)</div></div></section>
""" % {"src": src, "brand": brand, "name": os.path.basename(svg),
       "ladder": "".join('<div class="cell"><div class="w"><img src="%s" width="%d" height="%d"></div>%d px</div>' % (src, s, s, s) for s in (256, 128, 64, 32, 16))}
    sheet = os.path.join(out, "test-sheet.html")
    open(sheet, "w", encoding="utf-8").write(html)
    png = os.path.join(out, "test-sheet.png")
    made = shot(sheet, png, 1100, 1500, transparent=False)
    return {"html": sheet, "png": png if made else None, "note": None if made else "no browser found: open the HTML sheet yourself"}


def cmd_kit(svg, out, name, theme, background):
    root, raw = load(svg)
    errs = [a for a in audit(svg) if a["level"] == "error"]
    if errs:
        raise SystemExit("logo: fix these before exporting: " + "; ".join(e["message"] for e in errs))
    os.makedirs(out, exist_ok=True)
    shutil.copyfile(svg, os.path.join(out, "favicon.svg"))
    made, skipped = ["favicon.svg"], []
    pngs = {}
    for fn, size in SIZES.items():
        p = os.path.join(out, fn)
        bg = background if fn == "apple-touch-icon.png" else None   # iOS fills transparency with black
        if render_png(raw, size, p, pad=0.1 if fn == "apple-touch-icon.png" else 0.0, background=bg or ("#ffffff" if fn == "apple-touch-icon.png" else None)):
            made.append(fn)
            pngs[size] = p
        else:
            skipped.append(fn)
    mk = os.path.join(out, "icon-maskable-512.png")
    if render_png(raw, 512, mk, pad=0.2, background=background or "#ffffff"):
        made.append("icon-maskable-512.png")
    else:
        skipped.append("icon-maskable-512.png")
    if all(s in pngs for s in (16, 32, 48)):
        open(os.path.join(out, "favicon.ico"), "wb").write(ico([(s, open(pngs[s], "rb").read()) for s in (16, 32, 48)]))
        made.append("favicon.ico")
    manifest = {"name": name, "short_name": name[:12], "icons": [
        {"src": "/icon-192.png", "sizes": "192x192", "type": "image/png"},
        {"src": "/icon-512.png", "sizes": "512x512", "type": "image/png"},
        {"src": "/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"}],
        "theme_color": theme, "background_color": background or "#ffffff", "display": "standalone"}
    json.dump(manifest, open(os.path.join(out, "site.webmanifest"), "w"), indent=2)
    made.append("site.webmanifest")
    snippet = ('<link rel="icon" href="/favicon.ico" sizes="48x48">\n<link rel="icon" href="/favicon.svg" type="image/svg+xml">\n'
               '<link rel="apple-touch-icon" href="/apple-touch-icon.png">\n<link rel="manifest" href="/site.webmanifest">\n'
               '<meta name="theme-color" content="%s">\n' % theme)
    open(os.path.join(out, "head-snippet.html"), "w").write(snippet)
    made.append("head-snippet.html")
    return {"out": out, "made": made, "skipped": skipped or None,
            "note": "these PNGs could not be rendered (no Chrome-family browser found, or it failed to start): " + ", ".join(skipped) if skipped else None}


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("audit"); p.add_argument("svg"); p.add_argument("--json", action="store_true")
    p = sub.add_parser("test"); p.add_argument("svg"); p.add_argument("--out", required=True)
    p = sub.add_parser("kit"); p.add_argument("svg"); p.add_argument("--out", required=True); p.add_argument("--name", default="App")
    p.add_argument("--theme", default="#111111"); p.add_argument("--background")
    sub.add_parser("which")
    a = ap.parse_args(argv)
    if a.cmd == "which":
        print(find_browser() or "no browser found")
    elif a.cmd == "audit":
        res = audit(a.svg)
        if a.json:
            print(json.dumps(res, indent=1))
        else:
            for r in res:
                print("%-5s %-14s %s" % (r["level"], r["code"], r["message"]))
        sys.exit(1 if any(r["level"] == "error" for r in res) else 0)
    elif a.cmd == "test":
        print(json.dumps(cmd_test(a.svg, a.out), indent=1))
    elif a.cmd == "kit":
        for v in (a.theme, a.background):
            if v and not re.fullmatch(r"#[0-9a-fA-F]{3,8}", v):
                raise SystemExit("logo: colours are given as #rrggbb")
        print(json.dumps(cmd_kit(a.svg, a.out, a.name, a.theme, a.background), indent=1))


if __name__ == "__main__":
    main()
