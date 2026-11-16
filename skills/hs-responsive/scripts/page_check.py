#!/usr/bin/env python3
"""hs-responsive: check a built page at phone, tablet and desktop widths and say what breaks.

    page_check.py PAGE.html [--widths 390,768,1280] [--json]

Loads a temporary copy of the page into an iframe of each width in headless Chrome (HYPERSKILL_CHROME,
google-chrome or chromium; Chrome will not open a window narrower than 500 px, hence the iframe) and measures:
horizontal overflow and the elements that cause it, tap targets under 44 px (under 24 px is a blocker), form
fields under 16 px (iOS zooms the page when one is focused), text under 12 px, a missing viewport meta tag.
The page's own files are not modified. Exit status 1 when a blocker is found. Standard library only.
"""
import argparse
import html as H
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile

PROBE = r"""
(function () {
  function path(el) { var out = []; while (el && el.nodeType === 1 && out.length < 4) { var s = el.tagName.toLowerCase(); if (el.id) { out.unshift(s + "#" + el.id); break; } if (el.className && typeof el.className === "string" && el.className.trim()) s += "." + el.className.trim().split(/\s+/).slice(0, 2).join("."); out.unshift(s); el = el.parentElement; } return out.join(" > "); }
  function scroller(el) { for (var p = el.parentElement; p && p !== document.body; p = p.parentElement) { var o = getComputedStyle(p).overflowX; if (o === "auto" || o === "scroll" || o === "hidden") return true; } return false; }
  function visible(el, cs) { var r = el.getBoundingClientRect(); return cs.display !== "none" && cs.visibility !== "hidden" && r.width > 0 && r.height > 0; }
  function run() {
    var W = document.documentElement.clientWidth, res = { width: W, overflow: document.documentElement.scrollWidth - W, wide: [], small_targets: [], small_fields: [], small_text: [], viewport: !!document.querySelector('meta[name=viewport]') };
    var all = document.body.querySelectorAll("*");
    for (var i = 0; i < all.length; i++) {
      var el = all[i], cs = getComputedStyle(el); if (!visible(el, cs)) continue;
      var r = el.getBoundingClientRect();
      if (res.overflow > 0 && r.right > W + 1 && !scroller(el) && cs.position !== "fixed" && res.wide.length < 8) res.wide.push({ sel: path(el), right: Math.round(r.right), width: Math.round(r.width) });
      var tag = el.tagName.toLowerCase();
      if ((tag === "a" && el.hasAttribute("href")) || tag === "button" || tag === "select" || tag === "summary" || el.getAttribute("role") === "button" || (tag === "input" && el.type !== "hidden")) {
        var m = Math.min(r.width, r.height);
        if (m < 44 && !(tag === "a" && el.closest("p, li") && cs.display === "inline") && res.small_targets.length < 40) res.small_targets.push({ sel: path(el), w: Math.round(r.width), h: Math.round(r.height), text: (el.textContent || el.value || "").trim().slice(0, 24) });
      }
      if ((tag === "input" || tag === "select" || tag === "textarea") && parseFloat(cs.fontSize) < 16 && el.type !== "hidden" && el.type !== "checkbox" && el.type !== "radio") res.small_fields.push({ sel: path(el), size: parseFloat(cs.fontSize) });
      var own = ""; for (var c = el.firstChild; c; c = c.nextSibling) if (c.nodeType === 3) own += c.nodeValue;
      if (own.trim() && parseFloat(cs.fontSize) < 12 && res.small_text.length < 10) res.small_text.push({ sel: path(el), size: parseFloat(cs.fontSize), text: own.trim().slice(0, 24) });
    }
    window.__HS = JSON.stringify(res);
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


def measure(page, widths):
    exe = browser()
    if not exe:
        raise SystemExit("page_check: no Chrome-family browser found (set HYPERSKILL_CHROME)")
    src = open(page, encoding="utf-8", errors="replace").read()
    base = '<base href="file://%s/">' % os.path.dirname(os.path.abspath(page)).replace('"', "%22")
    html = re.sub(r"(<head[^>]*>)", r"\1" + base, src, count=1, flags=re.I) if re.search(r"<head", src, re.I) else base + src
    html = html.replace("</body>", "<script>" + PROBE + "</script></body>") if "</body>" in html else html + "<script>" + PROBE + "</script>"
    out = []
    with tempfile.TemporaryDirectory(prefix="hs-rs-") as d:
        open(os.path.join(d, "page.html"), "w", encoding="utf-8").write(html)
        for w in widths:
            wrap = ('<!doctype html><meta charset="utf-8"><body style="margin:0"><iframe id="f" src="page.html" style="border:0;width:%dpx;height:900px"></iframe><pre id="hs-out"></pre>'
                    '<script>window.addEventListener("load",function(){var v="";try{v=document.getElementById("f").contentWindow.__HS||""}catch(e){}console.log("HSRESULT"+btoa(unescape(encodeURIComponent(v))))})</script>' % w)
            open(os.path.join(d, "wrap.html"), "w").write(wrap)
            got = run_chrome_console(exe, ["--disable-gpu", "--hide-scrollbars", "--window-size=%d,900" % max(w + 20, 520), "--allow-file-access-from-files",
                                           "--user-data-dir=" + os.path.join(d, "profile%d" % w)] + (["--no-sandbox"] if hasattr(os, "geteuid") and os.geteuid() == 0 else []),
                                     "file://" + os.path.join(d, "wrap.html"))
            if not got:
                raise SystemExit("page_check: the page did not report back at %d px (a script error, or a resource that never loads?)" % w)
            res = json.loads(got)
            res["requested"] = w
            out.append(res)
    return out


def findings(res):
    f = []
    if not res["viewport"]:
        f.append(("blocker", "no <meta name=\"viewport\">: phones will show the desktop layout zoomed out"))
    if res["overflow"] > 0:
        who = "; ".join("%s (right edge %dpx)" % (x["sel"], x["right"]) for x in res["wide"][:3]) or "cause not found (a fixed-width or negative-margin element)"
        f.append(("blocker", "the page scrolls sideways by %dpx: %s" % (res["overflow"], who)))
    tiny = [t for t in res["small_targets"] if min(t["w"], t["h"]) < 24]
    mid = [t for t in res["small_targets"] if 24 <= min(t["w"], t["h"]) < 44]
    if tiny:
        f.append(("blocker", "%d tap targets under 24px, e.g. %s" % (len(tiny), "; ".join('%s "%s" %dx%d' % (t["sel"], t["text"], t["w"], t["h"]) for t in tiny[:3]))))
    if mid and res["requested"] <= 768:
        f.append(("important", "%d tap targets between 24 and 44px, e.g. %s" % (len(mid), "; ".join('%s "%s" %dx%d' % (t["sel"], t["text"], t["w"], t["h"]) for t in mid[:3]))))
    if res["small_fields"] and res["requested"] <= 768:
        f.append(("important", "form fields under 16px (iOS zooms the page when one is focused): " + ", ".join("%s %gpx" % (x["sel"], x["size"]) for x in res["small_fields"][:3])))
    if res["small_text"]:
        f.append(("polish", "text under 12px: " + ", ".join('%s %gpx "%s"' % (x["sel"], x["size"], x["text"]) for x in res["small_text"][:3])))
    return f


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("page")
    ap.add_argument("--widths", default="390,768,1280")
    ap.add_argument("--json", action="store_true")
    a = ap.parse_args(argv)
    if not os.path.isfile(a.page):
        raise SystemExit("page_check: no such file: " + a.page)
    widths = [int(x) for x in a.widths.split(",") if x.strip()]
    results = measure(a.page, widths)
    blockers = False
    if a.json:
        print(json.dumps([dict(r, findings=findings(r)) for r in results], indent=1))
    for r in results:
        fs = findings(r)
        blockers = blockers or any(l == "blocker" for l, _ in fs)
        if not a.json:
            print("== %d px: %s" % (r["requested"], "clean" if not fs else "%d finding(s)" % len(fs)))
            for level, msg in fs:
                print("%-9s %s" % (level.upper(), msg))
    sys.exit(1 if blockers else 0)


if __name__ == "__main__":
    main()
