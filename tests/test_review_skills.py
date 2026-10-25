import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
A11Y = os.path.join(ROOT, "skills", "hs-a11y-review", "scripts")
CONTRAST = os.path.join(A11Y, "contrast.py")
PAGE_CONTRAST = os.path.join(A11Y, "page_contrast.py")
PAGE_CHECK = os.path.join(ROOT, "skills", "hs-responsive", "scripts", "page_check.py")
sys.path.insert(0, A11Y)
import contrast as C  # noqa: E402


def have_browser():
    if os.environ.get("HYPERSKILL_CHROME"):
        return True
    return any(shutil.which(n) for n in ("google-chrome", "chromium", "chromium-browser")) or os.path.isfile("/opt/pw-browsers/chromium")


def run(script, *args):
    return subprocess.run([sys.executable, script, *args], capture_output=True, text=True, timeout=300)


class Tmp(unittest.TestCase):
    def setUp(self):
        self.d = tempfile.mkdtemp(prefix="hs-rv-")
        self.addCleanup(shutil.rmtree, self.d, ignore_errors=True)

    def write(self, name, body):
        p = os.path.join(self.d, name)
        with open(p, "w", encoding="utf-8") as f:
            f.write(body)
        return p


class ContrastMath(unittest.TestCase):
    def test_known_ratios(self):
        self.assertAlmostEqual(C.ratio((0, 0, 0, 1), (255, 255, 255, 1)), 21.0, places=1)
        self.assertAlmostEqual(C.ratio((119, 119, 119, 1), (255, 255, 255, 1)), 4.48, places=1)   # #777 on white just fails AA
        self.assertEqual(C.ratio((10, 20, 30, 1), (10, 20, 30, 1)), 1.0)

    def test_the_suggested_fix_really_passes_and_keeps_the_hue(self):
        fg, bg = C.parse_color("#aaaaaa"), C.parse_color("#ffffff")
        out = C.fix(fg, bg, 4.5)
        self.assertGreaterEqual(C.ratio(C.parse_color(out), bg), 4.5)
        orange = C.fix(C.parse_color("#ffb347"), bg, 4.5)
        r, g, b = [int(orange[i:i + 2], 16) for i in (1, 3, 5)]
        self.assertTrue(r > g > b, "still orange: " + orange)

    def test_colour_syntaxes(self):
        self.assertEqual(C.parse_color("#fff")[:3], (255, 255, 255))
        self.assertEqual(C.parse_color("rgb(10, 20, 30)")[:3], (10, 20, 30))
        self.assertAlmostEqual(C.parse_color("rgba(0 0 0 / 50%)")[3], .5)
        self.assertEqual(C.parse_color("hsl(0 100% 50%)")[:3], (255, 0, 0))
        self.assertIsNone(C.parse_color("inherit"))


class StaticContrast(Tmp):
    def test_a_failing_pair_is_a_blocker_with_a_fix_and_exit_1(self):
        css = self.write("a.css", ":root{--bg:#ffffff;--muted:#aaaaaa}body{background:var(--bg)}.note{color:var(--muted);background:var(--bg)}.ok{color:#111;background:#fff}")
        r = run(CONTRAST, css, "--theme", "light")
        self.assertEqual(r.returncode, 1, r.stdout)
        self.assertIn("BLOCKER .note", r.stdout)
        self.assertIn("2.32:1", r.stdout)
        self.assertIn("-> use #", r.stdout)
        self.assertNotIn("BLOCKER .ok", r.stdout)

    def test_a_colour_without_its_own_background_is_only_a_check_not_a_failure(self):
        css = self.write("b.css", "body{background:#fff}.on-dark-panel{color:#eee}")
        r = run(CONTRAST, css, "--theme", "light")
        self.assertEqual(r.returncode, 0, r.stdout)
        self.assertIn("check", r.stdout)

    def test_dark_theme_overrides_apply_only_to_the_dark_run(self):
        css = self.write("c.css", ":root{--bg:#fff;--fg:#111}body{background:var(--bg)}p{color:var(--fg);background:var(--bg)}"
                                  "@media (prefers-color-scheme: dark){:root{--bg:#111;--fg:#222}}")
        light = json.loads(run(CONTRAST, css, "--theme", "light", "--json").stdout)["light"]["measured"]
        dark = json.loads(run(CONTRAST, css, "--theme", "dark", "--json").stdout)["dark"]["measured"]
        self.assertTrue(all(r["pass"] for r in light if r["selector"] == "p"))
        self.assertFalse(all(r["pass"] for r in dark if r["selector"] == "p"), "#222 on #111 must fail in the dark theme")

    def test_large_text_needs_only_three_to_one_and_gradients_are_not_measured(self):
        css = self.write("d.css", "h1{color:#8a8a8a;background:#fff;font-size:32px}.hero{color:#999;background:linear-gradient(#fff,#000)}")
        res = json.loads(run(CONTRAST, css, "--theme", "light", "--json").stdout)["light"]
        h1 = [r for r in res["measured"] if r["selector"] == "h1"][0]
        self.assertEqual(h1["needs"], 3.0)
        self.assertTrue(h1["pass"])
        self.assertTrue(any(u["selector"] == ".hero" for u in res["not_measured"]))

    def test_a_focus_ring_is_held_to_three_to_one(self):
        css = self.write("e.css", "body{background:#fff}a:focus-visible{outline:2px solid #ccc}")
        res = json.loads(run(CONTRAST, css, "--theme", "light", "--json").stdout)["light"]["measured"]
        ring = [r for r in res if r["kind"] == "focus ring"][0]
        self.assertFalse(ring["pass"])

    def test_this_sites_own_stylesheet_has_no_certain_failures(self):
        r = run(CONTRAST, os.path.join(ROOT, "site", "styles.css"))
        self.assertEqual(r.returncode, 0, r.stdout)


@unittest.skipUnless(have_browser(), "needs a Chrome-family browser")
class PageChecks(Tmp):
    BAD = ('<!doctype html><title>t</title><style>body{margin:0;background:#fff;color:#111;font:16px sans-serif}.a{color:#aaa}.card{background:#222;padding:8px}.card p{color:#555}'
           '.hero{background:linear-gradient(#fff,#000);color:#888}.row{width:700px;background:#eee}a.x{display:inline-block;width:20px;height:20px;background:#00f}input{font-size:12px}'
           '@media (prefers-color-scheme:dark){body{background:#000;color:#eee}.a{color:#444}}</style>'
           '<body><p>Normal</p><p class="a">Light grey on white</p><div class="card"><p>Dark grey on a dark panel</p></div><div class="hero"><h1>Over a gradient</h1></div>'
           '<div class="row">fixed 700px</div><a class="x" href="#">x</a><input placeholder="name"></body>')
    GOOD = ('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>t</title><style>body{margin:0;background:#fff;color:#111;font:16px sans-serif}'
            'a,button{display:inline-block;min-width:44px;min-height:44px}input{font-size:16px;min-height:44px}main{padding:16px}</style>'
            '<body><main><p>All fine here</p><a href="#">Link</a> <button>Go</button> <input aria-label="name"></main></body>')

    def test_page_contrast_finds_the_real_background_and_runs_both_schemes(self):
        page = self.write("bad.html", self.BAD)
        r = run(PAGE_CONTRAST, page, "--json")
        self.assertEqual(r.returncode, 1, r.stdout + r.stderr)
        res = json.loads(r.stdout)
        light = {x["selector"].split(" > ")[-1]: x for x in res["light"]["failing"]}
        self.assertIn("p.a", light)
        self.assertIn("p", light)                                     # the grey paragraph inside the dark card, against #222 not the page
        self.assertTrue(any(x["bg"] == "#222222" for x in res["light"]["failing"]), "the card's own background must be used")
        self.assertTrue(any(u["text"].startswith("Over a gradient") for u in res["light"]["not_measured"]))
        dark_a = [x for x in res["dark"]["failing"] if x["text"].startswith("Light grey")]
        self.assertTrue(dark_a and dark_a[0]["bg"] == "#000000", "the dark scheme must be applied")

    def test_page_contrast_passes_a_good_page(self):
        r = run(PAGE_CONTRAST, self.write("good.html", self.GOOD))
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)

    def test_page_check_reports_overflow_targets_zoom_and_the_missing_viewport_tag(self):
        r = run(PAGE_CHECK, self.write("bad.html", self.BAD), "--json")
        self.assertEqual(r.returncode, 1, r.stdout + r.stderr)
        res = {x["requested"]: x for x in json.loads(r.stdout)}
        text = json.dumps(res[390]["findings"])
        for needle in ("viewport", "scrolls sideways by", "tap targets under 24px", "form fields under 16px"):
            self.assertIn(needle, text)
        self.assertEqual(res[390]["width"], 390, "measured at the requested width, not Chrome's minimum")
        self.assertEqual(res[1280]["overflow"], 0, "the 700px row fits on a desktop")

    def test_page_check_passes_a_good_page_at_every_width(self):
        r = run(PAGE_CHECK, self.write("good.html", self.GOOD), "--widths", "360,768")
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertEqual(r.stdout.count("clean"), 2)

    def test_this_site_has_no_sideways_scroll_on_a_phone(self):
        r = run(PAGE_CHECK, os.path.join(ROOT, "site", "index.html"), "--widths", "390", "--json")
        res = json.loads(r.stdout)[0]
        self.assertEqual(res["overflow"], 0, res["wide"])


class Wiring(Tmp):
    def test_the_skills_are_bundled_and_answer_their_slots(self):
        for name in ("hs-a11y-review", "hs-responsive", "hs-design-review"):
            with open(os.path.join(ROOT, "skills", name, "SKILL.md"), encoding="utf-8") as f:
                self.assertTrue(f.read().startswith("---\nname: %s\n" % name))
        with open(os.path.join(ROOT, "skills", "hyperskill", "integrations.json"), encoding="utf-8") as f:
            reg = json.load(f)
        self.assertIn("hs-a11y-review", reg["slots"]["a11y-audit"]["providers"])
        self.assertIn("hs-design-review", reg["slots"]["design-critique"]["providers"])
        self.assertEqual(reg["slots"]["responsive-check"]["providers"], ["hs-responsive"])
        self.assertEqual(reg["slots"]["design-critique"]["providers"][0], "impeccable", "the existing preference is unchanged")


if __name__ == "__main__":
    unittest.main()
