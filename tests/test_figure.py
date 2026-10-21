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
ANATOMY = os.path.join(ROOT, "skills", "anatomy")


def tracker(project, *args):
    return subprocess.run([sys.executable, TRACKER, *args], cwd=project, capture_output=True, text=True)


class BundledAnatomyTests(unittest.TestCase):
    def setUp(self):
        self.project = tempfile.mkdtemp(prefix="hs-anatomy-")
        self.addCleanup(shutil.rmtree, self.project, ignore_errors=True)
        self.assertEqual(tracker(self.project, "init", "--name", "demo").returncode, 0)

    def test_the_slot_resolves_to_the_bundled_copy(self):
        out = json.loads(tracker(self.project, "integrations", "resolve", "explainer-figure", "--json").stdout)
        self.assertEqual(out["use"], "anatomy")
        row = out["providers"][0]
        self.assertTrue(row["installed"] and row["allowed"], "it is bundled, so it needs no install and no opt-in")
        self.assertTrue(out["fallback"])

    def test_the_registry_entry_states_licence_what_was_read_and_the_risks(self):
        with open(os.path.join(ROOT, "skills", "hyperskill", "integrations.json"), encoding="utf-8") as f:
            reg = json.load(f)
        a = reg["providers"]["anatomy"]
        self.assertEqual((a["license"], a["policy"], a["builtin"]), ("MIT", "recommended", True))
        self.assertIn("not a line-by-line audit", a["vetted"].lower())
        self.assertIn("1482e84", a["vetted"])
        risks = " ".join(a["risks"])
        for word in ("Chrome", "Node 20.10", "27 MB", "beta", "publish.mjs"):
            self.assertIn(word, risks)
        self.assertNotIn("hyperskill-figure", reg["providers"], "the earlier small kit was replaced, not kept beside it")
        self.assertEqual(reg["slots"]["explainer-figure"]["providers"], ["anatomy"])

    def test_the_phases_that_can_use_a_figure_name_the_slot(self):
        with open(os.path.join(ROOT, "skills", "hyperskill", "gates.json"), encoding="utf-8") as f:
            phases = {p["id"]: p for p in json.load(f)["phases"]}
        for pid in ("plan", "product", "launch"):
            self.assertIn("explainer-figure", phases[pid]["slots"], pid)

    def test_the_bundled_skill_is_complete(self):
        with open(os.path.join(ANATOMY, "SKILL.md"), encoding="utf-8") as f:
            skill = f.read()
        self.assertTrue(skill.startswith("---\nname: anatomy\n"))
        self.assertIn("license: MIT", skill)
        for rel in ("README.md", "SECURITY.md", "CHANGELOG.md", "kit/iso-kit.mjs", "kit/gl.mjs", "kit/turn.mjs", "kit/lathe.mjs", "kit/tube.mjs", "scripts/capture.mjs", "scripts/drive.mjs", "scripts/print.mjs"):
            self.assertTrue(os.path.isfile(os.path.join(ANATOMY, rel)), rel)
        self.assertEqual(len([f for f in os.listdir(os.path.join(ANATOMY, "references")) if f.endswith(".md")]), 10)
        examples = [d for d in os.listdir(os.path.join(ANATOMY, "examples")) if os.path.isdir(os.path.join(ANATOMY, "examples", d))]
        self.assertGreaterEqual(len(examples), 9)
        for d in ("dial-indicator", "desk-computer", "arcade-cabinet", "raptor-engine", "ripple-tank", "test-rig", "spot-plate", "turning-dial", "push-button"):
            self.assertIn(d, examples)
        for rel in re.findall(r"`(references/[A-Za-z0-9_./-]+\.md)`", skill):
            self.assertTrue(os.path.isfile(os.path.join(ANATOMY, rel)), "SKILL.md names a missing file: " + rel)

    def test_the_licence_notice_stays_with_the_copy_and_the_origin_is_recorded(self):
        with open(os.path.join(ANATOMY, "LICENSE"), encoding="utf-8") as f:
            lic = f.read()
        self.assertIn("MIT License", lic)
        self.assertIn("Copyright (c) 2026 Ryan", lic, "the MIT licence requires the copyright notice to stay")
        self.assertIn("Permission is hereby granted, free of charge", lic)
        with open(os.path.join(ANATOMY, "UPSTREAM.md"), encoding="utf-8") as f:
            up = f.read()
        self.assertRegex(up, r"commit `[0-9a-f]{40}`")
        self.assertIn("https://github.com/wheresryan22/anatomy", up)
        self.assertIn("unmodified", up)
        with open(os.path.join(ROOT, "docs", "sources.md"), encoding="utf-8") as f:
            src = f.read()
        self.assertIn("bundled unmodified in `skills/anatomy`", src)
        self.assertIn("not a line-by-line audit", src)

    def test_the_command_points_at_the_bundled_skill(self):
        with open(os.path.join(ROOT, "commands", "hyperskill-figure.md"), encoding="utf-8") as f:
            cmd = f.read()
        self.assertIn("integrations resolve explainer-figure", cmd)
        self.assertIn("skills/anatomy/SKILL.md", cmd)
        with open(os.path.join(ROOT, "skills", "hyperskill", "SKILL.md"), encoding="utf-8") as f:
            self.assertIn("/hyperskill-figure", f.read())

    @unittest.skipUnless(os.environ.get("HS_RUN_ANATOMY_SUITE") == "1" and shutil.which("node") and os.environ.get("ANATOMY_TEST_DEPS"),
                         "set HS_RUN_ANATOMY_SUITE=1 and ANATOMY_TEST_DEPS=<a node_modules with react, react-dom, typescript and esbuild> to run Anatomy's own regression tests (slow)")
    def test_anatomys_own_regression_suite_passes_on_the_bundled_copy(self):
        env = dict(os.environ, NODE_PATH=os.environ["ANATOMY_TEST_DEPS"])
        files = sorted(f for f in os.listdir(os.path.join(ANATOMY, "scripts")) if f.endswith(".test.mjs"))
        r = subprocess.run(["node", "--test", *[os.path.join("scripts", f) for f in files]], cwd=ANATOMY, env=env, capture_output=True, text=True, timeout=1800)
        self.assertEqual(r.returncode, 0, r.stdout[-3000:] + r.stderr[-1000:])


if __name__ == "__main__":
    unittest.main()
