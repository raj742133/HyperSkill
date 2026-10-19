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


class InstallScriptTests(unittest.TestCase):
    def test_script_parses_and_every_added_repo_is_in_the_registry(self):
        path = os.path.join(ROOT, "scripts", "install-skills.sh")
        self.assertEqual(subprocess.run(["bash", "-n", path]).returncode, 0)
        with open(path, encoding="utf-8") as f:
            repos = re.findall(r"^add (\S+)", f.read(), re.M)
        with open(os.path.join(ROOT, "skills", "hyperskill", "integrations.json"), encoding="utf-8") as f:
            known = " ".join(p.get("repo", "") for p in json.load(f)["providers"].values())
        for r in repos:
            owner_repo = r if r != "vercel-labs/agent-skills" else "vercel-labs/agent-skills"
            self.assertIn(owner_repo, known, r)

    def test_script_never_installs_blocked_or_reference_only_tools(self):
        with open(os.path.join(ROOT, "scripts", "install-skills.sh"), encoding="utf-8") as f:
            body = "\n".join(l for l in f.read().splitlines() if l.startswith("add "))
        for banned in ("onetake", "gstack", "MiroFish", "openui", "morluto/rea", "api-anything"):
            self.assertNotIn(banned, body)


if __name__ == "__main__":
    unittest.main()
