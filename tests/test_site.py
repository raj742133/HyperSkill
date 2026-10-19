import json
import os
import re
import subprocess
import sys
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = os.path.join(ROOT, "site")


class SiteTests(unittest.TestCase):
    def test_data_js_is_up_to_date(self):
        r = subprocess.run([sys.executable, os.path.join(ROOT, "scripts", "build_site.py"), "--check"],
                           capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stderr)

    def test_html_references_exist(self):
        with open(os.path.join(SITE, "index.html"), encoding="utf-8") as f:
            html = f.read()
        for ref in re.findall(r'(?:src|href)="([^"#:]+\.(?:js|css|svg))"', html):
            self.assertTrue(os.path.isfile(os.path.join(SITE, ref)), ref)

    def test_no_inline_script_or_style_so_strict_csp_holds(self):
        with open(os.path.join(SITE, "index.html"), encoding="utf-8") as f:
            html = f.read()
        self.assertIsNone(re.search(r"<script(?![^>]*\bsrc=)[^>]*>", html))
        self.assertIsNone(re.search(r"\sstyle=", html))
        self.assertIsNone(re.search(r"\son\w+=", html))

    def test_vercel_config(self):
        with open(os.path.join(ROOT, "vercel.json"), encoding="utf-8") as f:
            cfg = json.load(f)
        self.assertEqual(cfg["outputDirectory"], "site")
        self.assertTrue(os.path.isdir(os.path.join(ROOT, cfg["outputDirectory"])))
        keys = {h["key"] for rule in cfg["headers"] for h in rule["headers"]}
        for k in ("Content-Security-Policy", "X-Content-Type-Options", "Strict-Transport-Security"):
            self.assertIn(k, keys)

    def test_site_makes_no_claims_the_repo_cannot_back(self):
        with open(os.path.join(SITE, "index.html"), encoding="utf-8") as f:
            html = f.read().lower()
        for banned in ("mit license", "mit-style", "trusted by", "10k+", "% satisfaction"):
            self.assertNotIn(banned, html)


if __name__ == "__main__":
    unittest.main()
