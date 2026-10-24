import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TRACKER = os.path.join(ROOT, "scripts", "hyperskill.py")
WATCH = os.path.join(ROOT, "skills", "hs-watch", "scripts", "watch.py")
CONVERT = os.path.join(ROOT, "skills", "hs-convert", "scripts", "convert.py")
LOGO = os.path.join(ROOT, "skills", "hs-logo", "scripts", "logo.py")
CLIP = os.path.join(ROOT, "site", "live", "previews", "styles-popular", "brutalism.mp4")
MARK = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect x="6" y="6" width="52" height="52" rx="14" fill="#1b4dff"/><path d="M20 44V20h6l12 16V20h6v24h-6L26 28v16z" fill="#fff"/></svg>'


def py(script, *args, cwd=None):
    return subprocess.run([sys.executable, script, *args], capture_output=True, text=True, cwd=cwd)


class Tmp(unittest.TestCase):
    def setUp(self):
        self.d = tempfile.mkdtemp(prefix="hs-own-")
        self.addCleanup(shutil.rmtree, self.d, ignore_errors=True)

    def write(self, name, body, mode="w"):
        p = os.path.join(self.d, name)
        with open(p, mode) as f:
            f.write(body)
        return p


class Wiring(Tmp):
    def test_the_three_skills_are_bundled_and_answer_their_slots(self):
        for name in ("hs-watch", "hs-convert", "hs-logo"):
            body = open(os.path.join(ROOT, "skills", name, "SKILL.md"), encoding="utf-8").read()
            self.assertTrue(body.startswith("---\nname: %s\n" % name), name)
        for cmd in ("watch", "convert", "logo"):
            self.assertTrue(os.path.isfile(os.path.join(ROOT, "commands", "hyperskill-%s.md" % cmd)))
        py(TRACKER, "init", "--name", "demo", "--no-karpathy", cwd=self.d)
        for slot, want in (("video-analysis", "hs-watch"), ("file-convert", "hs-convert"), ("logo-design", "hs-logo")):
            out = json.loads(py(TRACKER, "integrations", "resolve", slot, "--json", cwd=self.d).stdout or "{}")
            self.assertEqual(out.get("use"), want, slot)

    def test_each_provider_says_where_it_came_from_and_what_is_untested(self):
        reg = json.load(open(os.path.join(ROOT, "skills", "hyperskill", "integrations.json"), encoding="utf-8"))
        for pid in ("hs-watch", "hs-convert", "hs-logo"):
            p = reg["providers"][pid]
            self.assertTrue(p["builtin"] and p["policy"] == "recommended")
            self.assertIn("no code copied", p["vetted"], pid)
            self.assertTrue(p["risks"])
        self.assertIn("untested", reg["providers"]["hs-convert"]["vetted"])


@unittest.skipUnless(shutil.which("ffmpeg") and shutil.which("ffprobe") and os.path.isfile(CLIP), "needs ffmpeg and the demo clip")
class WatchTests(Tmp):
    def test_run_writes_frames_hook_sheet_and_a_report_with_pending_markers(self):
        out = os.path.join(self.d, "w")
        r = py(WATCH, "run", CLIP, "--out", out, "--question", "what happens")
        self.assertEqual(r.returncode, 0, r.stderr)
        res = json.loads(r.stdout)
        self.assertGreater(res["frames"], 5)
        self.assertGreater(res["hook_frames"], 5)
        self.assertTrue(os.path.getsize(os.path.join(out, "sheet.jpg")) > 1000)
        report = open(os.path.join(out, "report.md"), encoding="utf-8").read()
        self.assertEqual(report.count("<!-- pending"), 4)
        self.assertIn("No captions were available", report)
        self.assertIn("question: what happens", report)

    def test_a_focused_range_stays_inside_the_range(self):
        out = os.path.join(self.d, "f")
        r = py(WATCH, "frames", CLIP, "--out", out, "--start", "2", "--end", "4", "--every", "0.5")
        self.assertEqual(r.returncode, 0, r.stderr)
        times = sorted(float(f[1:-4]) for f in os.listdir(out))
        self.assertTrue(times and times[0] >= 2 and times[-1] <= 4.2, times)

    def test_links_to_private_addresses_and_other_schemes_are_refused(self):
        fake = os.path.join(self.d, "bin")
        os.makedirs(fake)
        self.write("bin/yt-dlp", "#!/bin/sh\nexit 1\n")
        os.chmod(os.path.join(fake, "yt-dlp"), 0o755)
        env = dict(os.environ, PATH=fake + os.pathsep + os.environ["PATH"])
        for url, word in (("http://127.0.0.1:8000/v.mp4", "private"), ("file:///etc/passwd", "http and https")):
            r = subprocess.run([sys.executable, WATCH, "fetch", url, "--out", os.path.join(self.d, "x")], capture_output=True, text=True, env=env)
            self.assertNotEqual(r.returncode, 0)
            self.assertIn(word, r.stderr)

    def test_captions_are_read_in_order_without_rolling_duplicates(self):
        vtt = self.write("c.vtt", "WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nHello <b>there</b>\n\n00:00:02.000 --> 00:00:03.000\nHello there\n\n00:01:05.500 --> 00:01:06.000\nSecond\n")
        r = py(WATCH, "captions", vtt)
        self.assertEqual(r.stdout.splitlines(), ["[00:01] Hello there", "[01:06] Second"])


@unittest.skipUnless(shutil.which("ffmpeg") or shutil.which("convert"), "needs an image tool")
class ConvertTests(Tmp):
    def test_an_image_converts_and_an_existing_output_is_never_overwritten(self):
        src = os.path.join(self.d, "a.webp")
        shutil.copyfile(os.path.join(ROOT, "site", "live", "previews", "styles-popular", "brutalism.webp"), src)
        r = py(CONVERT, "run", src, "png")
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertTrue(json.loads(r.stdout)["ok"])
        out = os.path.join(self.d, "a.png")
        before = os.path.getmtime(out)
        again = py(CONVERT, "run", src, "png")
        self.assertNotEqual(again.returncode, 0)
        self.assertIn("already exists", again.stdout)
        self.assertEqual(os.path.getmtime(out), before)
        self.assertEqual(py(CONVERT, "run", src, "png", "--force").returncode, 0)

    def test_an_impossible_route_and_a_missing_file_are_reported_not_guessed(self):
        txt = self.write("n.txt", "hello")
        r = py(CONVERT, "run", txt, "mp3")
        self.assertNotEqual(r.returncode, 0)
        self.assertIn("no route", r.stdout)
        self.assertNotEqual(py(CONVERT, "run", os.path.join(self.d, "none.png"), "jpg").returncode, 0)

    def test_the_plan_shows_the_command_and_runs_nothing(self):
        src = self.write("p.png", "not really a png")
        r = py(CONVERT, "plan", src, "webp")
        self.assertEqual(r.returncode, 0, r.stdout)
        plan = json.loads(r.stdout)
        self.assertIsInstance(plan["command"], list)
        self.assertTrue(os.path.isabs(plan["command"][-2] if plan["engine"] != "imagemagick" else plan["command"][1].split("[")[0]))
        self.assertFalse(os.path.exists(os.path.join(self.d, "p.webp")))

    def test_a_file_named_like_an_option_or_coder_is_treated_as_a_file(self):
        src = os.path.join(self.d, "-label:evil.webp")
        shutil.copyfile(os.path.join(ROOT, "site", "live", "previews", "styles-popular", "brutalism.webp"), src)
        r = py(CONVERT, "run", src, "png", cwd=self.d)
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertTrue(os.path.isfile(os.path.join(self.d, "-label:evil.png")))

    def test_a_failed_conversion_leaves_no_partial_file(self):
        bad = self.write("bad.png", "this is not an image")
        r = py(CONVERT, "run", bad, "jpg")
        self.assertNotEqual(r.returncode, 0)
        self.assertFalse(os.path.exists(os.path.join(self.d, "bad.jpg")))


class LogoTests(Tmp):
    def test_a_clean_mark_passes_and_a_dirty_one_fails_with_reasons(self):
        good = self.write("good.svg", MARK)
        r = py(LOGO, "audit", good, "--json")
        self.assertEqual(r.returncode, 0, r.stdout)
        self.assertEqual([x["level"] for x in json.loads(r.stdout)], ["ok"])
        bad = self.write("bad.svg", '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" onload="x()"><script>1</script><image href="https://x.test/a.png"/><text x="0" y="9" opacity=".5" fill="red">Hi</text></svg>')
        r = py(LOGO, "audit", bad, "--json")
        self.assertEqual(r.returncode, 1)
        codes = {x["code"] for x in json.loads(r.stdout)}
        self.assertTrue({"script", "handler", "external", "raster", "live-text", "no-viewbox", "opacity"} <= codes, codes)

    def test_warnings_for_gradients_thin_strokes_and_an_off_centre_mark(self):
        svg = self.write("w.svg", '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g"><stop offset="0" stop-color="#f00"/></linearGradient></defs><circle cx="20" cy="20" r="10" fill="url(#g)" stroke="#000" stroke-width="0.5"/></svg>')
        codes = {x["code"] for x in json.loads(py(LOGO, "audit", svg, "--json").stdout)}
        self.assertTrue({"gradient", "thin-stroke", "off-centre", "small"} <= codes, codes)

    def test_entities_are_refused_before_parsing(self):
        svg = self.write("e.svg", '<?xml version="1.0"?><!DOCTYPE svg [<!ENTITY a "aaaa">]><svg xmlns="http://www.w3.org/2000/svg">&a;</svg>')
        r = py(LOGO, "audit", svg)
        self.assertNotEqual(r.returncode, 0)
        self.assertIn("entities", r.stderr)

    def test_the_kit_makes_valid_icons_a_manifest_and_a_head_snippet(self):
        svg = self.write("m.svg", MARK)
        out = os.path.join(self.d, "kit")
        r = py(LOGO, "kit", svg, "--out", out, "--name", "Demo", "--theme", "#1b4dff", "--background", "#ffffff")
        self.assertEqual(r.returncode, 0, r.stderr)
        res = json.loads(r.stdout)
        manifest = json.load(open(os.path.join(out, "site.webmanifest")))
        self.assertEqual(manifest["name"], "Demo")
        self.assertIn("maskable", [i.get("purpose") for i in manifest["icons"]])
        self.assertIn("rel=\"manifest\"", open(os.path.join(out, "head-snippet.html")).read())
        if res["skipped"] and not shutil.which("google-chrome") and not shutil.which("chromium") and not os.path.isfile("/opt/pw-browsers/chromium"):
            self.skipTest("no browser here to render PNGs")
        self.assertIsNone(res["skipped"], res)
        for name in ("apple-touch-icon.png", "icon-maskable-512.png"):
            self.assertTrue(os.path.isfile(os.path.join(out, name)), name)
        import struct
        for name, size in (("favicon-16.png", 16), ("favicon-32.png", 32), ("icon-192.png", 192), ("icon-512.png", 512)):
            d = open(os.path.join(out, name), "rb").read()
            self.assertEqual(d[:8], b"\x89PNG\r\n\x1a\n", name)
            self.assertEqual(struct.unpack(">II", d[16:24]), (size, size), name)
        ico = open(os.path.join(out, "favicon.ico"), "rb").read()
        self.assertEqual(struct.unpack("<HHH", ico[:6]), (0, 1, 3))
        # the 16 px icon is not blank
        raw16 = open(os.path.join(out, "favicon-16.png"), "rb").read()
        self.assertGreater(len(raw16), 150)

    def test_the_kit_refuses_a_file_with_errors_and_bad_colours(self):
        bad = self.write("b.svg", '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8"><script>1</script></svg>')
        self.assertNotEqual(py(LOGO, "kit", bad, "--out", os.path.join(self.d, "k")).returncode, 0)
        ok = self.write("o.svg", MARK)
        self.assertNotEqual(py(LOGO, "kit", ok, "--out", os.path.join(self.d, "k2"), "--theme", "red;x").returncode, 0)

    def test_the_test_sheet_loads_the_mark_only_as_an_image(self):
        svg = self.write("t.svg", MARK)
        res = json.loads(py(LOGO, "test", svg, "--out", os.path.join(self.d, "t")).stdout)
        html = open(res["html"], encoding="utf-8").read()
        self.assertNotIn("<script", html)
        self.assertIn("data:image/svg+xml;base64,", html)
        for block in ("Size ladder", "One colour", "Squint", "browser tab"):
            self.assertIn(block, html)


if __name__ == "__main__":
    unittest.main()
