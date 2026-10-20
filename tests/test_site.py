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

    def test_chaser_copy_is_up_to_date(self):
        r = subprocess.run([sys.executable, os.path.join(ROOT, "scripts", "sync_chaser.py"), "--check"], capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stderr)

    def test_tide_copy_matches_the_example(self):
        """site/tide is a copy of examples/tide with absolute asset paths; fail when they drift apart."""
        src = os.path.join(ROOT, "examples", "tide")
        for name in ("styles.css", "app.js", "timer.js", "liquid.js", "favicon.svg"):
            with open(os.path.join(src, name), "rb") as a, open(os.path.join(SITE, "tide", name), "rb") as b:
                self.assertEqual(a.read(), b.read(), name + " differs: copy examples/tide/" + name + " to site/tide/")
        with open(os.path.join(src, "index.html"), encoding="utf-8") as f:
            html = f.read()
        for name in ("favicon.svg", "styles.css", "app.js"):
            html = html.replace('"' + name + '"', '"/tide/' + name + '"')
        with open(os.path.join(SITE, "tide", "index.html"), encoding="utf-8") as f:
            self.assertEqual(f.read(), html, "site/tide/index.html differs from examples/tide/index.html")

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

    def test_live_view_files_are_published_and_the_policy_lets_the_replay_load_its_data(self):
        for name in ("index.html", "live.css", "live.js", "replay.json"):
            self.assertTrue(os.path.isfile(os.path.join(SITE, "live", name)), name)
        self.assertTrue(os.path.isfile(os.path.join(SITE, "live-view.png")))
        with open(os.path.join(ROOT, "vercel.json"), encoding="utf-8") as f:
            csp = next(h["value"] for rule in json.load(f)["headers"] for h in rule["headers"] if h["key"] == "Content-Security-Policy")
        self.assertIn("connect-src 'self'", csp)
        self.assertNotIn("unsafe-inline", csp)
        with open(os.path.join(SITE, "index.html"), encoding="utf-8") as f:
            html = f.read()
        self.assertIn('href="/live"', html)
        self.assertIn('src="live-view.png"', html)

    def test_the_recorded_replay_is_well_formed_and_carries_no_secrets_or_local_paths(self):
        with open(os.path.join(SITE, "live", "replay.json"), encoding="utf-8") as f:
            raw = f.read()
        data = json.loads(raw)
        self.assertEqual(len(data["phases"]), 9)
        self.assertTrue(data["events"])
        self.assertEqual([e["ts"] for e in data["events"]], sorted(e["ts"] for e in data["events"]), "events are in recorded order")
        for needle in ("/tmp/", "/home/", "/root", "claude-0", "scratchpad", "OPERATOR_TOKEN", "Bearer ", "sk-", "ghp_"):
            self.assertNotIn(needle, raw, needle)
        types = {e["type"] for e in data["events"]}
        for want in ("file", "test", "gate_pass", "check_failed", "refused", "decision", "progress"):
            self.assertIn(want, types, want)
        tests = [e for e in data["events"] if e["type"] == "test"]
        self.assertTrue(any(t["failed"] for t in tests) and any(not t["failed"] for t in tests), "the recording shows a failing and a passing run")

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
