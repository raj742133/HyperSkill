#!/usr/bin/env python3
"""hs-a11y-review: contrast of every piece of text on a built page, as the browser actually paints it.

    page_contrast.py PAGE.html [--width 1280] [--scheme light|dark|both] [--json]

Opens a temporary copy of the page in headless Chrome (HYPERSKILL_CHROME, google-chrome or chromium), walks every
element that has its own text, reads the computed colour and the real background (compositing every translucent
ancestor), and reports the WCAG 2.x ratio against the 4.5:1 (3:1 for large text) it needs. Text over a gradient or
an image is listed as "not measured". The page's own files are never modified; the copy goes in a temp folder with a
<base> pointing back at the original. Exit status 1 when any text fails. Standard library only.
"""
import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from contrast import fix, hexof, ratio  # noqa: E402

PROBE = r"""
(function () {
  function parse(s) { var m = /rgba?\(([^)]+)\)/.exec(s); if (!m) return null; var p = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; }
  function over(a, b) { var al = a[3]; return [a[0] * al + b[0] * (1 - al), a[1] * al + b[1] * (1 - al), a[2] * al + b[2] * (1 - al), 1]; }
  function path(el) { var out = []; while (el && el.nodeType === 1 && out.length < 4) { var s = el.tagName.toLowerCase(); if (el.id) { out.unshift(s + "#" + el.id); break; } if (el.className && typeof el.className === "string") s += "." + el.className.trim().split(/\s+/).slice(0, 2).join("."); out.unshift(s); el = el.parentElement; } return out.join(" > "); }
  function run() {
    var res = { measured: [], unmeasured: [] }, seen = 0;
    var els = document.body.querySelectorAll("*");
    for (var i = 0; i < els.length && seen < 4000; i++) {
      var el = els[i], own = "";
      for (var c = el.firstChild; c; c = c.nextSibling) if (c.nodeType === 3) own += c.nodeValue;
      own = own.replace(/\s+/g, " ").trim();
      if (!own) continue;
      var cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || cs.display === "none" || parseFloat(cs.opacity) === 0) continue;
      var r = el.getBoundingClientRect(); if (r.width === 0 || r.height === 0) continue;
      seen++;
      var layers = [], image = false, node = el;
      while (node && node.nodeType === 1) {
        var st = getComputedStyle(node);
        var bg = parse(st.backgroundColor);
        if (st.backgroundImage && st.backgroundImage !== "none" && !(bg && bg[3] >= 1)) { image = true; }   // an image over a solid colour (a faint grid, a pattern) is measured against the colour
        if (bg && bg[3] > 0) { layers.push(bg); if (bg[3] >= 1) break; }
        node = node.parentElement;
      }
      if (image) { res.unmeasured.push({ sel: path(el), text: own.slice(0, 40), why: "a gradient or image is behind it" }); continue; }
      var base = [255, 255, 255, 1];
      for (var k = layers.length - 1; k >= 0; k--) base = over(layers[k], base);
      var fg = parse(cs.color); if (!fg) continue;
      if (fg[3] < 1) fg = over(fg, base);
      res.measured.push({ sel: path(el), text: own.slice(0, 40), fg: fg.slice(0, 3), bg: base.slice(0, 3), size: parseFloat(cs.fontSize), weight: parseInt(cs.fontWeight, 10) || 400 });
    }
    console.log("HSRESULT" + btoa(unescape(encodeURIComponent(JSON.stringify(res)))));
  }
  window.addEventListener("load", run);   // synchronously on load: --dump-dom prints right after the load event
})();
"""


def browser():
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


_OLD_HEADLESS = False


def _set_old(flag):
    """The new headless mode timed out once: use the old one for the rest of this run instead of waiting every time."""
    global _OLD_HEADLESS
    if flag == "--headless":
        _OLD_HEADLESS = True


def run_chrome_console(exe, args, url, timeout=45):
    """Open `url` in headless Chrome and return the first console line the page prints after the marker HSRESULT (base64 of JSON).

    Reading the console instead of `--dump-dom` works on Chrome builds where a page with a script keeps the dump from ever finishing;
    the process is killed as soon as the line arrives. The new headless mode is tried first, then the old one."""
    import base64
    import select
    import time
    for flag in (("--headless=old",) if _OLD_HEADLESS else ("--headless", "--headless=old")):
        p = subprocess.Popen([exe, flag] + args + ["--enable-logging=stderr", "--v=0", url], stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
        end, found = time.time() + (timeout if flag == "--headless=old" else 20), None
        try:
            while time.time() < end and found is None:
                ready, _, _ = select.select([p.stdout], [], [], 0.5)
                if ready:
                    line = p.stdout.readline()
                    if not line:
                        break
                    m = re.search(r"HSRESULT([A-Za-z0-9+/=]+)", line)
                    if m:
                        found = base64.b64decode(m.group(1)).decode("utf-8")
        finally:
            p.kill()
            p.wait()
        if found is not None:
            return found
        _set_old(flag)
    return None


def probe(page, width, dark):
    exe = browser()
    if not exe:
        raise SystemExit("page_contrast: no Chrome-family browser found (set HYPERSKILL_CHROME)")
    src = open(page, encoding="utf-8", errors="replace").read()
    base = '<base href="file://%s/">' % os.path.dirname(os.path.abspath(page)).replace('"', "%22")
    html = re.sub(r"(<head[^>]*>)", r"\1" + base, src, count=1, flags=re.I) if re.search(r"<head", src, re.I) else base + src
    html = html.replace("</body>", "<script>" + PROBE + "</script></body>") if "</body>" in html else html + "<script>" + PROBE + "</script>"
    with tempfile.TemporaryDirectory(prefix="hs-pc-") as d:
        p = os.path.join(d, "page.html")
        open(p, "w", encoding="utf-8").write(html)
        out = run_chrome_console(exe, ["--disable-gpu", "--hide-scrollbars", "--window-size=%d,900" % width, "--user-data-dir=" + os.path.join(d, "profile")]
                                 + (["--force-dark-mode"] if dark else []) + (["--no-sandbox"] if hasattr(os, "geteuid") and os.geteuid() == 0 else []), "file://" + p)
    if out is None:
        raise SystemExit("page_contrast: the page did not finish loading in Chrome (a script error or an external resource that hangs?)")
    return json.loads(out)


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("page")
    ap.add_argument("--width", type=int, default=1280)
    ap.add_argument("--scheme", choices=("light", "dark", "both"), default="both")
    ap.add_argument("--json", action="store_true")
    a = ap.parse_args(argv)
    if not os.path.isfile(a.page):
        raise SystemExit("page_contrast: no such file: " + a.page)
    out, failed = {}, False
    for scheme in (("light", "dark") if a.scheme == "both" else (a.scheme,)):
        raw = probe(a.page, a.width, scheme == "dark")
        rows, seen = [], set()
        for m in raw["measured"]:
            large = m["size"] >= 24 or (m["size"] >= 18.66 and m["weight"] >= 700)
            need = 3.0 if large else 4.5
            fg, bg = tuple(m["fg"]) + (1,), tuple(m["bg"]) + (1,)
            r = ratio(fg, bg)
            key = (hexof(fg), hexof(bg), large)
            if r + 1e-9 < need and key not in seen:
                seen.add(key)
                rows.append({"selector": m["sel"], "text": m["text"], "fg": hexof(fg), "bg": hexof(bg), "ratio": round(r, 2), "needs": need, "fix": fix(fg, bg, need)})
        pairs = len({(hexof(tuple(m["fg"]) + (1,)), hexof(tuple(m["bg"]) + (1,))) for m in raw["measured"]})
        out[scheme] = {"texts": len(raw["measured"]), "distinct_pairs": pairs, "failing": rows, "not_measured": raw["unmeasured"][:20]}
        failed = failed or bool(rows)
    if a.json:
        print(json.dumps(out, indent=1))
    else:
        for scheme, res in out.items():
            print("== %s: %d texts, %d distinct colour pairs, %d failing" % (scheme, res["texts"], res["distinct_pairs"], len(res["failing"])))
            for r in res["failing"]:
                print("BLOCKER %s  %s on %s = %.2f:1, needs %.1f:1  -> use %s   [\"%s\"]" % (r["selector"][:60], r["fg"], r["bg"], r["ratio"], r["needs"], r["fix"] or "a different background", r["text"]))
            for u in res["not_measured"][:5]:
                print("not measured: %s (%s) [\"%s\"]: look at it by eye" % (u["sel"][:50], u["why"], u["text"]))
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
