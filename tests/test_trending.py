"""The tools found in the trending posts: what was bundled, what was only registered, and how each is wired into the pipeline."""
import json
import os
import re
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from test_control import tracker  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def load(*parts):
    with open(os.path.join(ROOT, *parts), encoding="utf-8") as f:
        return json.load(f)


def text(*parts):
    with open(os.path.join(ROOT, *parts), encoding="utf-8") as f:
        return f.read()


def tree_bytes(path):
    return sum(os.path.getsize(os.path.join(d, f)) for d, _, files in os.walk(path) for f in files)


BUNDLED = {"hallmark": "hallmark", "humanizer": "humanizer", "diagram-design": "diagram-design"}
REGISTERED_ONLY = ("last30days", "scrapling", "rea")


class PackTests(unittest.TestCase):
    def test_each_new_pack_is_bundled_with_its_licence_notice_and_the_skill_it_promises(self):
        manifest = load("packs", "manifest.json")["packs"]
        for pid, skill in BUNDLED.items():
            self.assertIn(pid, manifest)
            self.assertEqual(manifest[pid]["license"], "MIT")
            base = os.path.join(ROOT, "packs", pid)
            self.assertIn("MIT License", text("packs", pid, "LICENSE"))
            notice = text("packs", pid, "NOTICE.md")
            self.assertIn("Bundled unmodified from https://github.com/%s" % manifest[pid]["repo"], notice)
            self.assertRegex(notice, r"commit `[0-9a-f]{40}`")
            body = text("packs", pid, "skills", skill, "SKILL.md")
            self.assertRegex(body, r"(?m)^name: %s$" % skill)
            self.assertTrue(os.path.isdir(base))

    def test_the_packs_stay_small_enough_not_to_bloat_the_install(self):
        limits = {"hallmark": 8_000_000, "humanizer": 100_000, "diagram-design": 2_500_000}
        for pid, limit in limits.items():
            self.assertLess(tree_bytes(os.path.join(ROOT, "packs", pid)), limit, pid)

    def test_the_big_examples_were_left_out_and_the_notice_says_exactly_what_was_copied(self):
        notice = text("packs", "diagram-design", "NOTICE.md")
        self.assertIn("skills/diagram-design/references", notice)
        self.assertFalse([f for f in os.listdir(os.path.join(ROOT, "packs", "diagram-design", "skills", "diagram-design", "assets")) if f.startswith("example-")])

    def test_nothing_that_edits_your_settings_or_installs_hooks_is_ever_run_by_hyperskill(self):
        for rel in (("skills", "hs-product", "SKILL.md"),):
            self.assertNotIn("install-hook", text(*rel))
        risks = " ".join(load("skills", "hyperskill", "integrations.json")["providers"]["hallmark"]["risks"])
        self.assertIn("install-hook.mjs", risks)
        self.assertIn(".claude/settings.json", risks)

    def test_enabling_copies_the_skill_into_the_project_and_disabling_removes_it(self):
        with tempfile.TemporaryDirectory() as p:
            tracker(p, "init", "--name", "demo", "--no-karpathy")
            for pid, skill in BUNDLED.items():
                tracker(p, "integrations", "enable", pid)
                self.assertTrue(os.path.isfile(os.path.join(p, ".claude", "skills", skill, "SKILL.md")), pid)
            self.assertTrue(os.path.isfile(os.path.join(p, ".claude", "skills", "hallmark", "scripts", "sloplint.mjs")))
            for pid in BUNDLED:
                tracker(p, "integrations", "disable", pid)
            self.assertEqual(os.listdir(os.path.join(p, ".claude", "skills")) if os.path.isdir(os.path.join(p, ".claude", "skills")) else [], [])


class RegistryTests(unittest.TestCase):
    def setUp(self):
        self.reg = load("skills", "hyperskill", "integrations.json")

    def test_policies_follow_what_each_tool_does(self):
        p = self.reg["providers"]
        self.assertEqual(p["diagram-design"]["policy"], "recommended", "offline, no keys, and the plan phase needs a diagram")
        for pid in ("hallmark", "humanizer", "last30days", "scrapling", "rea"):
            self.assertEqual(p[pid]["policy"], "opt-in", pid)

    def test_the_tools_that_are_not_bundled_are_not_in_packs_and_say_why_in_their_risks(self):
        for pid in REGISTERED_ONLY:
            self.assertFalse(os.path.exists(os.path.join(ROOT, "packs", pid)), pid)
            self.assertTrue(self.reg["providers"][pid]["risks"], pid)
            self.assertTrue(self.reg["providers"][pid]["install"], pid)
        risks = lambda pid: " ".join(self.reg["providers"][pid]["risks"]).lower()
        self.assertIn("bot protection", risks("scrapling"))
        self.assertIn("authorised", risks("rea"))
        self.assertIn("provider", risks("last30days"))

    def test_licences_match_what_each_repository_ships(self):
        want = {"hallmark": "MIT", "humanizer": "MIT", "diagram-design": "MIT", "last30days": "MIT", "scrapling": "BSD-3-Clause", "rea": "MIT"}
        for pid, lic in want.items():
            self.assertEqual(self.reg["providers"][pid]["license"], lic, pid)

    def test_the_new_slots_exist_with_the_right_providers_and_an_honest_fallback(self):
        s = self.reg["slots"]
        self.assertEqual(s["architecture-diagram"]["providers"], ["diagram-design", "hyperfigure"])
        self.assertEqual(s["design-lint"]["providers"], ["hallmark"])
        self.assertEqual(s["community-research"]["providers"], ["last30days"])
        self.assertEqual(s["web-extraction"]["providers"], ["scrapling"])
        self.assertEqual(s["artifact-analysis"]["providers"], ["rea"])
        self.assertEqual(s["copy-review"]["providers"], ["slopmonster", "humanizer"])
        self.assertEqual(s["design-direction"]["providers"], ["taste-skill", "hallmark"])
        self.assertIn("never work around bot protection", s["web-extraction"]["fallback"])

    def test_each_new_slot_is_in_the_phase_that_uses_it_with_a_reason(self):
        orch = load("skills", "hyperskill", "orchestration.json")["phases"]
        gates = {p["id"]: p for p in load("skills", "hyperskill", "gates.json")["phases"]}
        where = {"architecture-diagram": "plan", "design-lint": "product", "community-research": "research", "web-extraction": "research", "artifact-analysis": "harden"}
        for slot, phase in where.items():
            self.assertIn(slot, gates[phase]["slots"], slot)
            entry = next(e for e in orch[phase] if e["slot"] == slot)
            self.assertGreater(len(entry["why"]), 40, slot)
        self.assertEqual(next(e for e in orch["plan"] if e["slot"] == "architecture-diagram")["need"], "core")
        for slot in ("web-extraction", "artifact-analysis"):
            self.assertEqual(next(e for e in orch[where[slot]] if e["slot"] == slot)["need"], "optional")

    def test_the_plan_for_a_new_project_asks_for_the_diagram_and_never_pulls_the_opt_in_tools_by_itself(self):
        with tempfile.TemporaryDirectory() as p:
            tracker(p, "init", "--name", "demo", "--no-karpathy")
            tracker(p, "skip", "research", "--reason", "idea already validated")
            rows = {r["slot"]: r for r in json.loads(tracker(p, "skills", "--json").stdout)}
            self.assertEqual(rows["architecture-diagram"]["need"], "core")
            self.assertIn("diagram-design", json.dumps(rows["architecture-diagram"]))
            refused = tracker(p, "skills", "pull", "architecture-diagram", "--provider", "hyperfigure", check=False)
            self.assertIsNotNone(refused)


class CatalogTests(unittest.TestCase):
    def setUp(self):
        self.groups = {g["id"]: g for g in load("skills", "hyperskill", "catalog.json")["groups"]}

    def test_the_ten_styles_from_the_post_are_one_click_and_each_has_a_picture_and_a_recipe(self):
        g = self.groups["styles-popular"]
        names = [i["name"] for i in g["items"]]
        self.assertEqual(names, ["Skeuomorphism", "Neumorphism", "Glassmorphism", "Claymorphism", "Brutalism", "Minimalism", "Maximalism", "Liquid Glass", "Bento Grid", "Spatial UI"])
        big = {i["id"] for i in self.groups["uu-styles"]["items"]}
        recipes = text("skills", "hs-product", "references", "style-recipes.md")
        for it in g["items"]:
            self.assertTrue(os.path.isfile(os.path.join(ROOT, "site", "live", "previews", it["media"]["src"])), it["name"])
            self.assertTrue(os.path.isfile(os.path.join(ROOT, "site", "live", "previews", it["media"]["poster"])), it["name"])
            self.assertRegex(recipes, r"(?m)^## %s" % re.escape(it["name"].split(" (")[0] if it["name"] not in ("Brutalism",) else "Brutalism"))
            self.assertEqual(it["exclusive"], "uu-styles")
        self.assertIn("style-recipes.md", g["blurb"])

    def test_each_style_has_a_self_contained_interactive_demo_with_a_clip(self):
        base = os.path.join(ROOT, "site", "live", "previews", "styles-popular")
        for it in self.groups["styles-popular"]["items"]:
            self.assertEqual(it["demo"], it["media"]["src"].rsplit(".", 1)[0] + ".html")
            html = text("site", "live", "previews", it["demo"])
            stripped = html.replace("http://www.w3.org/2000/svg", "").replace("http://www.w3.org/1999/xlink", "")
            self.assertNotRegex(stripped, r"https?://", it["name"] + " must not fetch anything")
            for hook in ('id="habits"', 'id="add-form"', 'id="add-input"', 'id="toast"', "[role=switch]", "data-demo"):
                self.assertIn(hook, html, "%s lacks %s" % (it["name"], hook))
            self.assertIn("prefers-reduced-motion", html, it["name"])
            self.assertIn("focus-visible", html, it["name"])
            self.assertGreater(os.path.getsize(os.path.join(ROOT, "site", "live", "previews", it["media"]["src"])), 10000, it["name"])
        self.assertEqual(len([f for f in os.listdir(base) if f.endswith(".html")]), 10)

    def test_the_picker_offers_the_live_demo_in_a_sandbox(self):
        js = text("site", "live", "live.js")
        self.assertIn("Try the live demo", js)
        self.assertIn("kit-demo", js)
        self.assertIn('setAttribute("sandbox", "allow-scripts allow-forms")', js)
        live = text("scripts", "hs_live.py")
        m = re.search(r'DEMO_CSP = \((.*?)\)\n', live, re.S)
        self.assertTrue(m)
        csp = m.group(1)
        self.assertIn("sandbox allow-scripts allow-forms", csp)
        self.assertNotIn("allow-same-origin", csp)
        self.assertIn("connect-src 'none'", csp)

    def test_every_recipe_has_the_traps_and_the_checks_that_make_it_safe_to_ship(self):
        body = text("skills", "hs-product", "references", "style-recipes.md")
        sections = re.split(r"(?m)^## ", body)[1:11]
        self.assertEqual(len(sections), 10)
        for sec in sections:
            for needle in ("**Use when**", "**Recipe:**", "**Traps:**", "**Checks:**"):
                self.assertIn(needle, sec, sec.splitlines()[0])

    def test_a_popular_pick_and_a_pick_from_the_big_list_replace_each_other(self):
        with tempfile.TemporaryDirectory() as p:
            tracker(p, "init", "--name", "demo", "--no-karpathy")
            tracker(p, "catalog", "select", "uu-styles/minimalism-swiss-style")
            tracker(p, "catalog", "select", "styles-popular/glassmorphism")
            with open(os.path.join(p, ".hyperskill", "state.json"), encoding="utf-8") as f:
                st = json.load(f)
            chosen = [i for i in st["catalog"]["selected"] if i.startswith(("uu-styles/", "styles-popular/"))] if "catalog" in st else []
            self.assertEqual(chosen, ["styles-popular/glassmorphism"])

    def test_the_self_hosted_blocks_state_their_licence_and_what_done_looks_like(self):
        g = self.groups["selfhost"]
        self.assertEqual([i["name"] for i in g["items"]], ["GlitchTip", "Gotify", "Windmill", "Vikunja", "celld"])
        by = {i["name"]: i for i in g["items"]}
        for name, lic in (("GlitchTip", "MIT"), ("Gotify", "MIT"), ("Windmill", "AGPL-3.0"), ("Vikunja", "AGPL-3.0"), ("celld", "Apache-2.0")):
            self.assertIn(lic, by[name]["desc"], name)
        for it in g["items"]:
            self.assertEqual(it["mode"], "track")
            self.assertIn("Done when", it["text"], it["name"])
        self.assertIn("proprietary", by["Windmill"]["desc"])
        self.assertIn("alpha", by["celld"]["text"])
        self.assertEqual({i["phase"] for i in g["items"]}, {"operate", "launch", "scale"})

    def test_a_selected_self_hosted_block_becomes_a_check_that_blocks_its_phase(self):
        with tempfile.TemporaryDirectory() as p:
            tracker(p, "init", "--name", "demo", "--no-karpathy")
            tracker(p, "catalog", "select", "selfhost/glitchtip")
            with open(os.path.join(p, ".hyperskill", "state.json"), encoding="utf-8") as f:
                st = json.load(f)
            self.assertEqual(st["extras"]["selfhost/glitchtip"]["phase"], "operate")
            self.assertIn("Done when", st["extras"]["selfhost/glitchtip"]["text"])

    def test_the_new_skills_show_up_in_the_skills_group_without_hand_editing(self):
        names = {i["name"] for i in self.groups["skills"]["items"]}
        for skill in ("hallmark: hallmark", "humanizer: humanizer", "diagram-design: diagram-design"):
            self.assertIn(skill, names)


class DashboardNavTests(unittest.TestCase):
    def test_every_catalogue_group_can_be_reached_from_the_pickers_navigation(self):
        js = text("site", "live", "live.js")
        clusters = re.search(r"const CLUSTERS = (\[.*?\]\]);", js, re.S).group(1)
        prefixes = re.findall(r'"([a-z-]+)"', clusters)
        def reachable(gid):
            return any(gid == p or (p.endswith("-") and gid.startswith(p)) for p in prefixes)
        missing = [g["id"] for g in load("skills", "hyperskill", "catalog.json")["groups"] if not reachable(g["id"])]
        self.assertEqual(missing, [], "these groups would exist but never be shown in the dashboard")


class DocsTests(unittest.TestCase):
    def test_the_research_note_records_every_finding_with_its_decision(self):
        body = text("docs", "integration-research.md")
        for name in ("REA", "Hallmark", "Humanizer", "last30days", "Scrapling", "Diagram Design", "Windmill", "GlitchTip", "celld", "Vikunja", "Gotify", "Onyx"):
            self.assertIn(name, body)
        self.assertIn("could not run", body.lower(), "says plainly that the external code was read, not executed")

    def test_the_product_skill_points_at_the_recipes_and_the_linter(self):
        body = text("skills", "hs-product", "SKILL.md")
        self.assertIn("references/style-recipes.md", body)
        self.assertIn("sloplint.mjs", body)


if __name__ == "__main__":
    unittest.main()
