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
HF = os.path.join(ROOT, "skills", "hyperfigure")
TEXT = (".md", ".mjs", ".js", ".ts", ".tsx", ".css", ".html", ".svg", ".json", ".yaml", ".yml", ".txt")


def tracker(project, *args):
    return subprocess.run([sys.executable, TRACKER, *args], cwd=project, capture_output=True, text=True)


def text_files(root):
    for dp, _, fns in os.walk(root):
        for f in fns:
            if f.endswith(TEXT) or f in ("LICENSE", ".gitignore", ".gitattributes"):
                yield os.path.relpath(os.path.join(dp, f), root), os.path.join(dp, f)


class HyperfigureTests(unittest.TestCase):
    def setUp(self):
        self.project = tempfile.mkdtemp(prefix="hs-hyperfigure-")
        self.addCleanup(shutil.rmtree, self.project, ignore_errors=True)
        self.assertEqual(tracker(self.project, "init", "--name", "demo").returncode, 0)

    # ---- integration
    def test_the_slot_resolves_to_the_bundled_skill(self):
        out = json.loads(tracker(self.project, "integrations", "resolve", "explainer-figure", "--json").stdout)
        self.assertEqual(out["use"], "hyperfigure")
        row = out["providers"][0]
        self.assertTrue(row["installed"] and row["allowed"], "it is bundled, so it needs no install and no opt-in")
        self.assertTrue(out["fallback"])

    def test_the_registry_entry_states_licence_origin_and_the_risks(self):
        with open(os.path.join(ROOT, "skills", "hyperskill", "integrations.json"), encoding="utf-8") as f:
            reg = json.load(f)
        a = reg["providers"]["hyperfigure"]
        self.assertEqual((a["license"], a["policy"], a["builtin"]), ("MIT", "recommended", True))
        self.assertIn("derived from anatomy", a["vetted"].lower())
        self.assertIn("1482e84", a["vetted"])
        self.assertIn("not a line-by-line audit", a["vetted"].lower())
        risks = " ".join(a["risks"])
        for word in ("Chrome", "Node 20.10", "27 MB", "beta"):
            self.assertIn(word, risks)
        self.assertNotIn("anatomy", reg["providers"], "the original name is no longer a separate provider")
        self.assertEqual(reg["slots"]["explainer-figure"]["providers"], ["hyperfigure"])

    def test_the_phases_that_can_use_a_figure_name_the_slot(self):
        with open(os.path.join(ROOT, "skills", "hyperskill", "gates.json"), encoding="utf-8") as f:
            phases = {p["id"]: p for p in json.load(f)["phases"]}
        for pid in ("plan", "product", "launch"):
            self.assertIn("explainer-figure", phases[pid]["slots"], pid)

    def test_the_command_points_at_the_bundled_skill(self):
        with open(os.path.join(ROOT, "commands", "hyperskill-figure.md"), encoding="utf-8") as f:
            cmd = f.read()
        self.assertIn("integrations resolve explainer-figure", cmd)
        self.assertIn("skills/hyperfigure/SKILL.md", cmd)
        with open(os.path.join(ROOT, "skills", "hyperskill", "SKILL.md"), encoding="utf-8") as f:
            self.assertIn("/hyperskill-figure", f.read())

    # ---- the skill is complete and fully rebranded
    def test_the_skill_is_complete(self):
        with open(os.path.join(HF, "SKILL.md"), encoding="utf-8") as f:
            skill = f.read()
        self.assertTrue(skill.startswith("---\nname: hyperfigure\n"))
        self.assertIn("license: MIT", skill)
        for rel in ("README.md", "SECURITY.md", "NOTICE.md", "CHANGELOG.md", "kit/iso-kit.mjs", "kit/gl.mjs", "kit/turn.mjs", "kit/lathe.mjs", "kit/tube.mjs", "scripts/capture.mjs", "scripts/drive.mjs", "scripts/print.mjs"):
            self.assertTrue(os.path.isfile(os.path.join(HF, rel)), rel)
        self.assertEqual(len([f for f in os.listdir(os.path.join(HF, "references")) if f.endswith(".md")]), 9)
        examples = [d for d in os.listdir(os.path.join(HF, "examples")) if os.path.isdir(os.path.join(HF, "examples", d))]
        for d in ("dial-indicator", "desk-computer", "arcade-cabinet", "raptor-engine", "ripple-tank", "test-rig", "spot-plate", "turning-dial", "push-button"):
            self.assertIn(d, examples)
        for rel in re.findall(r"`(references/[A-Za-z0-9_./-]+\.md)`", skill):
            self.assertTrue(os.path.isfile(os.path.join(HF, rel)), "SKILL.md names a missing file: " + rel)
        for f in os.listdir(os.path.join(HF, "assets")):
            self.assertTrue(f.endswith(".webp"))

    def test_nothing_of_the_original_brand_or_its_author_s_channels_is_left_in_the_working_parts(self):
        allowed = {"LICENSE", "NOTICE.md", "CHANGELOG.md", "CHANGELOG-anatomy-upstream.md", "README.md"}
        bad = []
        for rel, path in text_files(HF):
            with open(path, encoding="utf-8", errors="ignore") as f:
                s = f.read()
            if rel in allowed:
                continue  # these name the original on purpose: the licence, the notice, the history, the credit line
            if "--anatomy-" in s:
                bad.append(rel + ": still uses the --anatomy- CSS prefix")
            if re.search(r"anatomy|wheresryan", s, re.I):
                bad.append(rel)
        self.assertEqual(bad, [], "the rename missed these")
        self.assertFalse(os.path.exists(os.path.join(HF, "scripts", "publish.mjs")), "the original author's gallery flow is removed")
        self.assertFalse(os.path.exists(os.path.join(HF, "references", "publish.md")))
        self.assertFalse(os.path.exists(os.path.join(HF, ".github")))
        with open(os.path.join(HF, "README.md"), encoding="utf-8") as f:
            readme = f.read()
        for url in ("wheresryan", "skills.wheresryan.sh", "npx skills add", "actions/workflows"):
            self.assertNotIn(url, readme, "the README must not send people to the original author's channels: " + url)

    # ---- the licence: this is the one thing that must not be removed
    def test_the_original_copyright_notice_stays_and_the_owner_s_is_added(self):
        with open(os.path.join(HF, "LICENSE"), encoding="utf-8") as f:
            lic = f.read()
        self.assertIn("MIT License", lic)
        self.assertIn("Copyright (c) 2026 Ryan", lic, "the MIT licence requires the original copyright notice to stay with every copy")
        self.assertIn("Copyright (c) 2026 raj742133", lic, "the owner's line for their own changes")
        self.assertIn("Permission is hereby granted, free of charge", lic)
        self.assertIn("The above copyright notice and this permission notice shall be included", lic)

    def test_the_notice_records_the_origin_and_what_was_changed(self):
        with open(os.path.join(HF, "NOTICE.md"), encoding="utf-8") as f:
            n = f.read()
        self.assertRegex(n, r"commit `[0-9a-f]{40}`")
        self.assertIn("https://github.com/wheresryan22/anatomy", n)
        self.assertIn("What was changed", n)
        self.assertTrue(os.path.isfile(os.path.join(HF, "CHANGELOG-anatomy-upstream.md")))
        with open(os.path.join(ROOT, "docs", "sources.md"), encoding="utf-8") as f:
            src = f.read()
        self.assertIn("rebranded as Hyperfigure", src)
        self.assertIn("not a line-by-line audit", src)
        self.assertIn("cannot be removed", src)

    @unittest.skipUnless(os.environ.get("HS_RUN_HYPERFIGURE_SUITE") == "1" and shutil.which("node") and os.environ.get("HYPERFIGURE_TEST_DEPS") and os.environ.get("CHROME_PATH"),
                         "set HS_RUN_HYPERFIGURE_SUITE=1, CHROME_PATH and HYPERFIGURE_TEST_DEPS=<a node_modules with react, react-dom, typescript and esbuild> to run the skill's own regression tests (slow, needs a quiet machine)")
    def test_the_skill_s_own_regression_suite_passes(self):
        env = dict(os.environ, NODE_PATH=os.environ["HYPERFIGURE_TEST_DEPS"])
        files = sorted(f for f in os.listdir(os.path.join(HF, "scripts")) if f.endswith(".test.mjs"))
        r = subprocess.run(["node", "--test", *[os.path.join("scripts", f) for f in files]], cwd=HF, env=env, capture_output=True, text=True, timeout=1800)
        self.assertEqual(r.returncode, 0, r.stdout[-3000:] + r.stderr[-1000:])


if __name__ == "__main__":
    unittest.main()
