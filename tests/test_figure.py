import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TRACKER = os.path.join(ROOT, "scripts", "hyperskill.py")
FIGURE = os.path.join(ROOT, "skills", "hs-figure")


def tracker(project, *args):
    return subprocess.run([sys.executable, TRACKER, *args], cwd=project, capture_output=True, text=True)


class FigureIntegrationTests(unittest.TestCase):
    def setUp(self):
        self.project = tempfile.mkdtemp(prefix="hs-figure-")
        self.addCleanup(shutil.rmtree, self.project, ignore_errors=True)
        self.assertEqual(tracker(self.project, "init", "--name", "demo").returncode, 0)

    def test_the_slot_resolves_to_the_built_in_kit_and_keeps_the_third_party_one_opt_in(self):
        out = json.loads(tracker(self.project, "integrations", "resolve", "explainer-figure", "--json").stdout)
        self.assertEqual(out["use"], "hyperskill-figure")
        rows = {r["id"]: r for r in out["providers"]}
        self.assertTrue(rows["hyperskill-figure"]["installed"] and rows["hyperskill-figure"]["allowed"])
        self.assertFalse(rows["anatomy"]["allowed"], "the third-party skill stays off until the owner enables it")
        self.assertIn("opt-in", rows["anatomy"]["why"])
        self.assertTrue(out["fallback"])

    def test_enabling_the_third_party_provider_offers_its_install_and_its_risks(self):
        self.assertEqual(tracker(self.project, "integrations", "enable", "anatomy").returncode, 0)
        out = json.loads(tracker(self.project, "integrations", "resolve", "explainer-figure", "--json").stdout)
        self.assertEqual(out["use"], "hyperskill-figure", "the built-in kit still comes first")
        hint = next(s for s in out["suggest_install"] if s["id"] == "anatomy")
        self.assertEqual(hint["license"], "MIT")
        self.assertTrue(any("Chrome" in r for r in hint["risks"]), "the risk of running local scripts that start Chrome is shown")
        self.assertIn("wheresryan22/anatomy", " ".join(hint["install"]))

    def test_the_registry_entries_carry_licence_policy_and_what_was_reviewed(self):
        with open(os.path.join(ROOT, "skills", "hyperskill", "integrations.json"), encoding="utf-8") as f:
            reg = json.load(f)
        for pid in ("hyperskill-figure", "anatomy"):
            self.assertIn(pid, reg["providers"])
            self.assertIn("license", reg["providers"][pid]); self.assertIn("policy", reg["providers"][pid])
        self.assertEqual(reg["providers"]["anatomy"]["policy"], "opt-in")
        self.assertIn("scripts were not audited", reg["providers"]["anatomy"]["vetted"], "what was and was not read is stated")
        self.assertTrue(reg["providers"]["hyperskill-figure"]["builtin"])

    def test_the_phases_that_can_use_a_figure_name_the_slot(self):
        with open(os.path.join(ROOT, "skills", "hyperskill", "gates.json"), encoding="utf-8") as f:
            phases = {p["id"]: p for p in json.load(f)["phases"]}
        for pid in ("plan", "product", "launch"):
            self.assertIn("explainer-figure", phases[pid]["slots"], pid)
        out = tracker(self.project, "integrations", "phase", "plan").stdout
        self.assertIn("explainer-figure", out)

    def test_the_skill_and_the_command_exist_and_are_wired(self):
        with open(os.path.join(FIGURE, "SKILL.md"), encoding="utf-8") as f:
            skill = f.read()
        self.assertTrue(skill.startswith("---\nname: hs-figure\n"))
        self.assertIn("explainer-figure", skill)
        self.assertIn("not a ninth phase", skill)
        with open(os.path.join(ROOT, "commands", "hyperskill-figure.md"), encoding="utf-8") as f:
            cmd = f.read()
        self.assertIn("integrations resolve explainer-figure", cmd)
        self.assertIn("hs-figure", cmd)
        with open(os.path.join(ROOT, "skills", "hyperskill", "SKILL.md"), encoding="utf-8") as f:
            self.assertIn("/hyperskill-figure", f.read())
        for rel in re.findall(r"`((?:references|kit|examples)/[A-Za-z0-9_./-]+)`", skill):
            if rel.endswith("/") or "*" in rel:
                continue
            self.assertTrue(os.path.exists(os.path.join(FIGURE, rel)), "SKILL.md names a missing path: " + rel)

    def test_credit_is_given_and_what_was_not_audited_is_stated(self):
        with open(os.path.join(ROOT, "docs", "sources.md"), encoding="utf-8") as f:
            src = f.read()
        self.assertIn("wheresryan22/anatomy", src)
        self.assertIn("no code or text was copied", src)
        self.assertIn("not a clean-room design", src)

    @unittest.skipUnless(shutil.which("node"), "node is not installed, so the figure kit's JavaScript tests cannot run here")
    def test_the_figure_kit_example_and_page_tests_pass(self):
        r = subprocess.run(["node", "--test", "kit/*.test.mjs", "examples/canal/*.test.mjs"], cwd=FIGURE, capture_output=True, text=True, timeout=180)
        self.assertEqual(r.returncode, 0, r.stdout[-2000:] + r.stderr[-1000:])
        counts = dict(re.findall(r"^# (tests|pass|fail) (\d+)", r.stdout, re.M))
        self.assertGreaterEqual(int(counts["tests"]), 25)
        self.assertEqual(counts["fail"], "0")

    @unittest.skipUnless(shutil.which("node"), "node is not installed, so the figure audit cannot run here")
    def test_the_shipped_figure_passes_its_own_overlap_audit(self):
        r = subprocess.run(["node", "build.mjs", "--audit"], cwd=os.path.join(FIGURE, "examples", "canal"), capture_output=True, text=True, timeout=60)
        self.assertEqual(r.returncode, 0, r.stdout)


if __name__ == "__main__":
    unittest.main()
