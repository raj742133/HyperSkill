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


class LiveViewStructureTests(unittest.TestCase):
    def test_hooks_json_is_valid_and_every_script_it_runs_exists(self):
        with open(os.path.join(ROOT, "hooks", "hooks.json"), encoding="utf-8") as f:
            hooks = json.load(f)["hooks"]
        self.assertEqual(set(hooks), {"PreToolUse", "PostToolUse", "PostToolUseFailure"})
        for event, rules in hooks.items():
            for rule in rules:
                self.assertTrue(rule["matcher"], event)
                for h in rule["hooks"]:
                    self.assertEqual(h["type"], "command")
                    self.assertLessEqual(h["timeout"], 10, "a hook must never hold up a tool call for long")
                    m = re.search(r'\$\{CLAUDE_PLUGIN_ROOT\}/(scripts/[A-Za-z0-9_.-]+\.py)', h["command"])
                    self.assertTrue(m, h["command"])
                    self.assertTrue(os.path.isfile(os.path.join(ROOT, m.group(1))), m.group(1))
        self.assertIn("Bash", hooks["PostToolUseFailure"][0]["matcher"])

    def test_the_live_command_and_skill_instructions_exist(self):
        path = os.path.join(ROOT, "commands", "hyperskill-live.md")
        self.assertTrue(os.path.isfile(path))
        self.assertIsNotNone(frontmatter(path))
        with open(os.path.join(ROOT, "skills", "hyperskill", "SKILL.md"), encoding="utf-8") as f:
            skill = f.read()
        self.assertIn("hyperskill.py event", skill)
        self.assertIn("/hyperskill-live", skill)

    def test_every_script_the_hook_and_dashboard_import_is_present(self):
        for name in ("hs_activity.py", "hs_hook.py", "hs_live.py", "make_replay.py"):
            self.assertTrue(os.path.isfile(os.path.join(ROOT, "scripts", name)), name)


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
