import glob
import json
import os
import re
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def frontmatter(path):
    with open(path, encoding="utf-8") as f:
        text = f.read()
    m = re.match(r"^---\n(.*?)\n---\n", text, re.S)
    if not m:
        return None
    out = {}
    for line in m.group(1).splitlines():
        if ":" in line:
            k, v = line.split(":", 1)
            out[k.strip()] = v.strip()
    return out


class StructureTests(unittest.TestCase):
    def test_manifests_are_valid_json(self):
        for rel in (".claude-plugin/plugin.json", ".claude-plugin/marketplace.json",
                    "skills/hyperskill/gates.json"):
            with open(os.path.join(ROOT, rel), encoding="utf-8") as f:
                json.load(f)

    def test_every_skill_has_matching_name_and_description(self):
        skills = glob.glob(os.path.join(ROOT, "skills", "*", "SKILL.md"))
        self.assertGreaterEqual(len(skills), 10)
        for path in skills:
            fm = frontmatter(path)
            self.assertIsNotNone(fm, path)
            self.assertEqual(fm.get("name"), os.path.basename(os.path.dirname(path)), path)
            self.assertTrue(len(fm.get("description", "")) > 40, path)

    def test_agents_and_commands_have_frontmatter(self):
        for path in glob.glob(os.path.join(ROOT, "agents", "*.md")):
            fm = frontmatter(path)
            self.assertIsNotNone(fm, path)
            self.assertEqual(fm.get("name"), os.path.splitext(os.path.basename(path))[0])
            self.assertIn("description", fm)
        for path in glob.glob(os.path.join(ROOT, "commands", "*.md")):
            fm = frontmatter(path)
            self.assertIsNotNone(fm, path)
            self.assertIn("description", fm)

    def test_referenced_files_exist(self):
        pat = re.compile(r"`((?:references|\.\./\.\./scripts)/[A-Za-z0-9_./-]+\.(?:md|py|json))`")
        for path in glob.glob(os.path.join(ROOT, "skills", "*", "SKILL.md")):
            base = os.path.dirname(path)
            with open(path, encoding="utf-8") as f:
                for rel in pat.findall(f.read()):
                    self.assertTrue(os.path.exists(os.path.normpath(os.path.join(base, rel))),
                                    "%s references missing %s" % (path, rel))

    def test_every_gate_phase_skill_is_routable(self):
        with open(os.path.join(ROOT, "skills", "hyperskill", "gates.json"), encoding="utf-8") as f:
            phases = json.load(f)["phases"]
        self.assertEqual([p["id"] for p in phases],
                         ["research", "plan", "foundation", "product", "ship",
                          "harden", "operate", "launch", "scale"])


if __name__ == "__main__":
    unittest.main()
