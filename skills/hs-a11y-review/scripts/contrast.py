#!/usr/bin/env python3
"""hs-a11y-review: measure the text and focus-ring contrast a stylesheet really produces.

    contrast.py FILE_OR_DIR [...] [--theme light|dark|both] [--json] [--min-large 3] [--min-text 4.5]

Reads .css files and <style> blocks in .html files. Resolves custom properties (var(--x), with fallbacks),
treats `@media (prefers-color-scheme: dark)` and `[data-theme="dark"]` / `.dark` blocks as the dark theme,
pairs every `color` with the `background` declared in the same rule (or the page background, marked
"assumed"), and reports the WCAG 2.x ratio, the ratio required, and, for a failure, the nearest foreground
that passes. Exit status 1 when anything fails. Standard library only.

A text colour with no background in its own rule is paired with the page background and reported as "check", not
as a failure, because a panel behind it may change the answer: use page_contrast.py (real computed colours in
Chrome) to settle those. It measures declared colours. It cannot see gradients, images behind text, opacity, or colours set by script;
those are listed as "not measured" so they get looked at by eye.
"""
import argparse
import colorsys
import glob
import json
import os
import re
import sys

NAMED = {"white": "#ffffff", "black": "#000000", "red": "#ff0000", "gray": "#808080", "grey": "#808080", "transparent": None}


def strip_comments(s):
    return re.sub(r"/\*.*?\*/", "", s, flags=re.S)


def blocks(css):
    """Yield (prelude, body) for each top-level { } block, honouring nesting."""
    i, n = 0, len(css)
    while i < n:
        j = css.find("{", i)
        if j < 0:
            return
        depth, k = 1, j + 1
        while k < n and depth:
            depth += {"{": 1, "}": -1}.get(css[k], 0)
            k += 1
        yield css[i:j].strip(), css[j + 1:k - 1]
        i = k


def rules(css, dark=False):
    """Flatten into [(selector, {prop: value}, is_dark)]."""
    out = []
    for prelude, body in blocks(css):
        if prelude.startswith("@"):
            inner_dark = dark or ("prefers-color-scheme" in prelude and "dark" in prelude)
            if prelude.startswith(("@media", "@supports", "@layer")):
                out += rules(body, inner_dark)
            continue
        decls = {}
        for d in re.split(r";(?![^(]*\))", body):
            if ":" in d:
                k, v = d.split(":", 1)
                decls[k.strip().lower()] = v.strip().rstrip(";").replace("!important", "").strip()
        sel_dark = bool(re.search(r'data-theme=["\']?dark|\.dark\b|\.theme-dark', prelude))
        out.append((re.sub(r"\s+", " ", prelude), decls, dark or sel_dark))
    return out


def parse_color(v):
    v = v.strip().lower()
    if v in NAMED:
        v = NAMED[v]
        if v is None:
            return None
    m = re.fullmatch(r"#([0-9a-f]{3,8})", v)
    if m:
        h = m.group(1)
        if len(h) in (3, 4):
            h = "".join(c * 2 for c in h)
        if len(h) in (6, 8):
            a = int(h[6:8], 16) / 255 if len(h) == 8 else 1
            return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), a)
    m = re.fullmatch(r"rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)(?:\s*[,/]\s*([\d.%]+))?\s*\)", v)
    if m:
        a = m.group(4)
        a = 1 if a is None else (float(a[:-1]) / 100 if a.endswith("%") else float(a))
        return (float(m.group(1)), float(m.group(2)), float(m.group(3)), a)
    m = re.fullmatch(r"hsla?\(\s*([\d.]+)(?:deg)?[ ,]+([\d.]+)%[ ,]+([\d.]+)%(?:\s*[,/]\s*([\d.%]+))?\s*\)", v)
    if m:
        r, g, b = colorsys.hls_to_rgb(float(m.group(1)) / 360, float(m.group(3)) / 100, float(m.group(2)) / 100)
        a = m.group(4)
        a = 1 if a is None else (float(a[:-1]) / 100 if a.endswith("%") else float(a))
        return (r * 255, g * 255, b * 255, a)
    return None


def resolve(v, env, depth=0):
    """Replace var(--x, fallback) using env; returns the value or None when it cannot be resolved."""
    if v is None or depth > 8:
        return None
    m = re.search(r"var\(\s*(--[\w-]+)\s*(?:,\s*([^)]*))?\)", v)
    while m:
        name, fb = m.group(1), m.group(2)
        val = env.get(name, fb)
        if val is None:
            return None
        v = v[:m.start()] + val + v[m.end():]
        depth += 1
        if depth > 8:
            return None
        m = re.search(r"var\(\s*(--[\w-]+)\s*(?:,\s*([^)]*))?\)", v)
    return v


def lum(c):
    def f(x):
        x /= 255
        return x / 12.92 if x <= .03928 else ((x + .055) / 1.055) ** 2.4
    return .2126 * f(c[0]) + .7152 * f(c[1]) + .0722 * f(c[2])


def ratio(a, b):
    la, lb = lum(a), lum(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + .05) / (lo + .05)


def over(fg, bg):
    a = fg[3]
    return tuple(fg[i] * a + bg[i] * (1 - a) for i in range(3)) + (1,)


def hexof(c):
    return "#%02x%02x%02x" % tuple(int(round(max(0, min(255, x)))) for x in c[:3])


def fix(fg, bg, need):
    """The nearest lightness change to fg that reaches `need` against bg, as a hex colour (or None)."""
    h, l, s = colorsys.rgb_to_hls(*[x / 255 for x in fg[:3]])
    best = None
    for direction in (-1, 1):
        for step in range(1, 101):
            nl = l + direction * step / 100
            if not 0 <= nl <= 1:
                break
            r, g, b = colorsys.hls_to_rgb(h, nl, s)
            cand = (r * 255, g * 255, b * 255, 1)
            if ratio(cand, bg) >= need:
                if best is None or step < best[0]:
                    best = (step, cand)
                break
    return hexof(best[1]) if best else None


def px(v, base=16):
    m = re.fullmatch(r"([\d.]+)(px|rem|em)", (v or "").strip())
    if not m:
        return None
    return float(m.group(1)) * (1 if m.group(2) == "px" else base)


def collect(paths):
    css = []
    for p in paths:
        files = [p] if os.path.isfile(p) else [f for ext in ("css", "html", "htm") for f in glob.glob(os.path.join(p, "**", "*." + ext), recursive=True) if "node_modules" not in f]
        for f in sorted(files):
            try:
                t = open(f, encoding="utf-8", errors="replace").read()
            except OSError:
                continue
            if f.endswith(".css"):
                css.append(strip_comments(t))
            else:
                css += [strip_comments(m) for m in re.findall(r"<style[^>]*>(.*?)</style>", t, flags=re.S | re.I)]
    return "\n".join(css)


def analyse(css, theme, min_text, min_large):
    rs = rules(css)
    env = {}
    for sel, d, is_dark in rs:
        if is_dark and theme == "light":
            continue
        if not is_dark and theme == "dark" and False:
            continue
        if re.search(r":root|^html|^body|\*", sel) or is_dark:
            for k, v in d.items():
                if k.startswith("--"):
                    if is_dark and theme in ("dark",) or not is_dark:
                        env[k] = v
    if theme == "dark":                                     # dark overrides win over the light values
        for sel, d, is_dark in rs:
            if is_dark:
                for k, v in d.items():
                    if k.startswith("--"):
                        env[k] = v
    page_bg = None
    for sel, d, is_dark in rs:
        if is_dark and theme == "light":
            continue
        if re.fullmatch(r"(html|body|html, body|body, html|:root)", sel.strip()) or re.fullmatch(r"(html|body)\b.*", sel.strip()):
            for k in ("background-color", "background"):
                if k in d:
                    c = parse_color(resolve(d[k].split(" ")[0] if k == "background" and " " in d[k] and "url" not in d[k] and "gradient" not in d[k] else d[k], env) or "")
                    if c and c[3] > .99:
                        page_bg = c
    rows, unmeasured = [], []
    for sel, d, is_dark in rs:
        if is_dark and theme == "light":
            continue
        if not is_dark and theme == "dark" and any(k2 in d for k2 in ()):
            continue
        fgv = resolve(d.get("color"), env) if "color" in d else None
        bgraw = d.get("background-color") or d.get("background")
        if bgraw and ("gradient" in bgraw or "url(" in bgraw):
            unmeasured.append((sel, "background is a gradient or image"))
            bgraw = None
        bgv = resolve(bgraw, env) if bgraw else None
        if bgv and " " in bgv.strip() and parse_color(bgv.strip()) is None:   # shorthand: take the colour token
            for tok in re.findall(r"#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)|\b[a-z]+\b", bgv):
                if parse_color(tok):
                    bgv = tok
                    break
        fg = parse_color(fgv) if fgv else None
        if fgv and fg is None:
            unmeasured.append((sel, "colour not readable: " + fgv[:40]))
        bg = parse_color(bgv) if bgv else None
        assumed = False
        if fg and not bg and page_bg:
            bg, assumed = page_bg, True
        if fg and bg:
            if bg[3] < 1 and page_bg:
                bg = over(bg, page_bg)
            if fg[3] < 1:
                fg = over(fg, bg)
            size = px(d.get("font-size")); bold = d.get("font-weight", "400") in ("bold", "600", "700", "800", "900")
            large = bool(size and (size >= 24 or (size >= 18.66 and bold)))
            need = min_large if large else min_text
            r = ratio(fg, bg)
            rows.append({"selector": sel, "kind": "text", "fg": hexof(fg), "bg": hexof(bg), "ratio": round(r, 2), "needs": need, "pass": r + 1e-9 >= need,
                         "assumed_bg": assumed, "fix": None if r >= need else fix(fg, bg, need)})
        ol = d.get("outline")
        if ol and "focus" in sel and "none" not in ol and page_bg:
            col = next((parse_color(resolve(t, env) or "") for t in re.findall(r"var\([^)]*\)|#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|\b[a-z]+\b", ol) if parse_color(resolve(t, env) or "")), None)
            if col:
                r = ratio(over(col, page_bg), page_bg)
                rows.append({"selector": sel, "kind": "focus ring", "fg": hexof(col), "bg": hexof(page_bg), "ratio": round(r, 2), "needs": 3, "pass": r >= 3, "assumed_bg": True,
                             "fix": None if r >= 3 else fix(col, page_bg, 3)})
    return rows, unmeasured, page_bg


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("paths", nargs="+")
    ap.add_argument("--theme", choices=("light", "dark", "both"), default="both")
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--min-text", type=float, default=4.5)
    ap.add_argument("--min-large", type=float, default=3.0)
    a = ap.parse_args(argv)
    css = collect(a.paths)
    if not css.strip():
        print("contrast: no CSS found in " + ", ".join(a.paths), file=sys.stderr)
        sys.exit(2)
    result, failed = {}, False
    for theme in (("light", "dark") if a.theme == "both" else (a.theme,)):
        rows, unm, bg = analyse(css, theme, a.min_text, a.min_large)
        seen, uniq = set(), []
        for r in rows:
            k = (r["selector"], r["fg"], r["bg"], r["kind"])
            if k not in seen:
                seen.add(k); uniq.append(r)
        result[theme] = {"page_background": hexof(bg) if bg else None, "measured": uniq, "not_measured": [{"selector": s, "why": w} for s, w in unm]}
        failed = failed or any(not r["pass"] and not r["assumed_bg"] for r in uniq)
    if a.json:
        print(json.dumps(result, indent=1))
    else:
        for theme, res in result.items():
            fails = [r for r in res["measured"] if not r["pass"] and not r["assumed_bg"]]
            maybe = [r for r in res["measured"] if not r["pass"] and r["assumed_bg"]]
            print("== %s theme: %d pairs measured, %d fail, %d to check (page background %s)" % (theme, len(res["measured"]), len(fails), len(maybe), res["page_background"]))
            for r in fails:
                print("BLOCKER %-34s %s on %s = %.2f:1, needs %.1f:1%s" % (r["selector"][:34], r["fg"], r["bg"], r["ratio"], r["needs"],
                      "  -> use %s" % r["fix"] if r["fix"] else "  -> no foreground of this hue can reach it; change the background"))
            for r in maybe:
                print("check   %-34s %s on the page background %s = %.2f:1: only valid if nothing else sits behind it (a panel, a card). page_contrast.py reads the real background." % (r["selector"][:34], r["fg"], r["bg"], r["ratio"]))
            low = sorted([r for r in res["measured"] if r["pass"]], key=lambda r: r["ratio"] / r["needs"])[:3]
            for r in low:
                print("tight   %-34s %s on %s = %.2f:1 (needs %.1f)" % (r["selector"][:34], r["fg"], r["bg"], r["ratio"], r["needs"]))
            for u in res["not_measured"][:6]:
                print("not measured: %s (%s): check by eye" % (u["selector"][:40], u["why"]))
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
