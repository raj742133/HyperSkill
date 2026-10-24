import http.client
import json
import os
import socket
import subprocess
import sys
import tempfile
import threading
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPTS = os.path.join(ROOT, "scripts")
sys.path.insert(0, SCRIPTS)
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _auth  # noqa: E402,F401  (signs test clients in to the dashboard)
from _auth import confirm_items, seed_docs  # noqa: E402,F401
import hs_live  # noqa: E402

TRACKER = os.path.join(SCRIPTS, "hyperskill.py")
HOOK = os.path.join(SCRIPTS, "hs_hook.py")
EMPTY_HOME = tempfile.mkdtemp()


def tracker(root, *args, check=True):
    return subprocess.run([sys.executable, TRACKER, "--root", root, *args], capture_output=True, text=True, check=check, env=dict(os.environ, HOME=EMPTY_HOME))


def free_port():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def gate_ids(phase_index):
    with open(os.path.join(ROOT, "skills", "hyperskill", "gates.json"), encoding="utf-8") as f:
        return ",".join(i["id"] for i in json.load(f)["phases"][phase_index]["gate"])


class Base(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.p = self.tmp.name
        tracker(self.p, "init", "--name", "demo", "--no-karpathy")

    def tearDown(self):
        self.tmp.cleanup()

    def state(self):
        with open(os.path.join(self.p, ".hyperskill", "state.json"), encoding="utf-8") as f:
            return json.load(f)

    def clear_research(self):
        confirm_items(self.p, "research")
        tracker(self.p, "gate", "research", "--waive", gate_ids(0), "--reason", "test run")


class BriefTests(Base):
    def test_the_brief_is_saved_and_shown_with_the_precedence_rule(self):
        tracker(self.p, "brief", "set", "--text", "A roastery site with a landing page and staff login.")
        out = tracker(self.p, "brief", "show").stdout
        self.assertIn("roastery site", out)
        self.assertIn("what the user ticked in the dashboard", out)
        self.assertIn("never waives a gate", out)
        self.assertIn("Nothing has been extracted yet", out)
        with open(os.path.join(self.p, ".hyperskill", "brief.md"), encoding="utf-8") as f:
            self.assertIn("roastery", f.read())
        self.assertNotEqual(tracker(self.p, "brief", "set", "--text", "  ", check=False).returncode, 0)

    def test_a_gap_blocks_the_phase_until_the_user_answers_and_a_suggestion_does_not(self):
        tracker(self.p, "brief", "set", "--text", "idea")
        tracker(self.p, "brief", "finding", "add", "--kind", "gap", "--text", "Shared password or personal accounts?")
        tracker(self.p, "brief", "finding", "add", "--kind", "suggestion", "--text", "Add password reset", "--proposed", "email link")
        self.clear_research()
        r = tracker(self.p, "advance", check=False)
        self.assertNotEqual(r.returncode, 0)
        self.assertIn("has not answered these gaps or conflicts", r.stderr)
        self.assertIn("f1", r.stderr)
        self.assertNotIn("f2", r.stderr, "a suggestion never blocks")
        self.assertNotEqual(tracker(self.p, "brief", "resolve", "f1", "--state", "answered", check=False).returncode, 0, "an answer needs text")
        tracker(self.p, "brief", "resolve", "f1", "--state", "answered", "--answer", "personal accounts with MFA")
        self.assertIn("advanced", tracker(self.p, "advance").stdout)

    def test_what_the_user_decided_reaches_claude_and_open_questions_are_not_assumed(self):
        tracker(self.p, "brief", "set", "--text", "idea")
        tracker(self.p, "brief", "finding", "add", "--kind", "conflict", "--text", "MFA asked for but plan says shared password", "--proposed", "use MFA")
        tracker(self.p, "brief", "finding", "add", "--kind", "gap", "--text", "Which payment provider?")
        tracker(self.p, "brief", "resolve", "f1", "--state", "accepted")
        tracker(self.p, "brief", "req", "add", "--text", "Landing page")
        r = subprocess.run([sys.executable, HOOK, "start"], input=json.dumps({"cwd": self.p}), capture_output=True, text=True,
                           env=dict(os.environ, HYPERSKILL_NO_LIVE="1", HOME=EMPTY_HOME))
        ctx = json.loads(r.stdout)["hookSpecificOutput"]["additionalContext"]
        self.assertIn("Waiting for the user's answer (do not assume): f2", ctx)
        self.assertIn("Decided by the user: f1 accepted", ctx)
        self.assertIn("Requirements: 1, covered 0", ctx)

    def test_a_requirement_is_closed_only_with_concrete_evidence(self):
        tracker(self.p, "brief", "set", "--text", "idea")
        tracker(self.p, "brief", "req", "add", "--text", "Landing page")
        self.assertNotEqual(tracker(self.p, "brief", "req", "done", "r1", "--evidence", "done", check=False).returncode, 0)
        tracker(self.p, "brief", "req", "done", "r1", "--evidence", "src/app/page.tsx renders the hero; ran npm run build -> ok")
        self.assertEqual(self.state()["requirements"]["r1"]["state"], "covered")


class DesignMappingTests(Base):
    def test_the_users_design_picks_drive_sitewrights_brand_instead_of_its_defaults(self):
        tracker(self.p, "catalog", "select", "sw-modules/landing", "sw-modules/mfa", "uu-palettes/micro-saas", "uu-fonts/classic-elegant", "uu-styles/minimalism-swiss-style",
                "uu-landing/hero-features-cta")
        cfg = json.loads(tracker(self.p, "catalog", "sitewright").stdout)
        self.assertEqual(cfg["brand"]["colors"], {"primary": "#6366F1", "signal": "#059669"})
        self.assertEqual(cfg["brand"]["font"], {"display": "Playfair Display", "body": "Inter"})
        self.assertEqual(cfg["modules"], ["landing", "mfa"])
        text = " ".join(cfg["_guidance"])
        self.assertIn("visual style: Minimalism", text)
        self.assertIn("landing pattern: Hero + Features + CTA", text)
        brief = tracker(self.p, "catalog", "brief", "--phase", "plan").stdout
        self.assertIn("design picks win over Sitewright's default look", brief)

    def test_nothing_is_invented_when_no_design_was_picked(self):
        tracker(self.p, "catalog", "select", "sw-modules/landing")
        cfg = json.loads(tracker(self.p, "catalog", "sitewright").stdout)
        self.assertNotIn("brand", cfg)
        self.assertNotIn("_guidance", cfg)

    def test_picking_both_kinds_of_sign_in_asks_instead_of_guessing(self):
        tracker(self.p, "catalog", "select", "sw-modules/signin", "sw-modules/mfa")
        cfg = json.loads(tracker(self.p, "catalog", "sitewright").stdout)
        self.assertIn("alternatives", " ".join(cfg["_guidance"]))


class PlacementTests(Base):
    def test_a_picked_component_must_be_placed_and_really_used_before_the_phase_ends(self):
        tracker(self.p, "catalog", "select", "sw-components/ring-chart")
        ex = self.state()["extras"]["sw-components/ring-chart"]
        self.assertEqual((ex["phase"], ex["state"]), ("product", "open"))
        self.assertNotEqual(tracker(self.p, "place", "add", "sw-hero/aurora", "--where", "home", check=False).returncode, 0, "only components and figures are placeable")
        self.assertNotEqual(tracker(self.p, "place", "add", "sw-components/pie-chart", "--where", "home", check=False).returncode, 0, "not picked")
        tracker(self.p, "place", "add", "sw-components/ring-chart", "--where", "dashboard / usage card", "--why", "shows quota by category")
        out = tracker(self.p, "place", "check", "--close").stdout
        self.assertIn("used=NOT FOUND", out)
        self.assertEqual(self.state()["extras"]["sw-components/ring-chart"]["state"], "open")
        src = os.path.join(self.p, "src", "app", "dashboard")
        os.makedirs(src)
        with open(os.path.join(src, "page.tsx"), "w", encoding="utf-8") as f:
            f.write("import { RingChart } from '@/components/fx/ui';\nexport default function P() { return <RingChart />; }\n")
        out = tracker(self.p, "place", "check", "--close").stdout
        self.assertIn("src/app/dashboard/page.tsx", out)
        self.assertEqual(self.state()["extras"]["sw-components/ring-chart"]["state"], "done")

    def test_sitewrights_own_library_and_gallery_do_not_count_as_use(self):
        tracker(self.p, "catalog", "select", "sw-components/ring-chart")
        tracker(self.p, "place", "add", "sw-components/ring-chart", "--where", "dashboard")
        for rel in ("src/components/fx/ui/RingChart.tsx", "src/app/effects/page.tsx"):
            path = os.path.join(self.p, rel)
            os.makedirs(os.path.dirname(path), exist_ok=True)
            with open(path, "w", encoding="utf-8") as f:
                f.write("export function RingChart() {}\n<RingChart />")
        self.assertIn("used=NOT FOUND", tracker(self.p, "place", "check").stdout)

    def test_a_figure_counts_when_it_is_used_by_name(self):
        tracker(self.p, "catalog", "select", "sw-figures/padlock")
        tracker(self.p, "place", "add", "sw-figures/padlock", "--where", "sign-in card")
        path = os.path.join(self.p, "src", "app", "login", "page.tsx")
        os.makedirs(os.path.dirname(path))
        with open(path, "w", encoding="utf-8") as f:
            f.write('<Figure name="padlock" />')
        self.assertIn("src/app/login/page.tsx", tracker(self.p, "place", "check").stdout)


class DashboardBriefTests(Base):
    def setUp(self):
        super().setUp()
        self._home = os.environ.get("HOME")
        os.environ["HOME"] = EMPTY_HOME
        self.addCleanup(lambda: os.environ.__setitem__("HOME", self._home) if self._home is not None else os.environ.pop("HOME", None))
        self.server, self.port = hs_live.make_server(self.p, free_port(), controls=True)
        threading.Thread(target=self.server.serve_forever, daemon=True).start()
        self.addCleanup(lambda: (self.server.shutdown(), self.server.server_close()))

    def call(self, method, path, body=None):
        c = http.client.HTTPConnection("127.0.0.1", self.port, timeout=20)
        c.request(method, path, body=json.dumps(body) if body is not None else None, headers={"Content-Type": "application/json", "X-HS-Token": self.server.token})
        r = c.getresponse()
        data = r.read()
        c.close()
        return r.status, json.loads(data)

    def test_pasting_the_idea_asks_claude_to_extract_and_never_to_assume(self):
        status, res = self.call("POST", "/live/api/brief_save", {"text": "A roastery site. Landing page and staff login."})
        self.assertTrue(res["ok"])
        with open(os.path.join(self.p, ".hyperskill", "inbox.jsonl"), encoding="utf-8") as f:
            self.assertIn("Do not assume answers", f.read())
        _, state = self.call("GET", "/live/state.json")
        self.assertEqual(state["brief"]["version"], 1)
        self.assertIn("roastery", state["brief"]["text"])

    def test_the_user_answers_and_the_state_and_claude_see_it(self):
        tracker(self.p, "brief", "set", "--text", "idea")
        tracker(self.p, "brief", "finding", "add", "--kind", "gap", "--text", "Which login?")
        tracker(self.p, "brief", "finding", "add", "--kind", "suggestion", "--text", "Add password reset")
        self.assertEqual(self.call("POST", "/live/api/finding_resolve", {"id": "f9", "state": "accepted"})[0], 400)
        self.assertEqual(self.call("POST", "/live/api/finding_resolve", {"id": "../x", "state": "accepted"})[0], 400)
        self.assertEqual(self.call("POST", "/live/api/finding_resolve", {"id": "f1", "state": "maybe"})[0], 400)
        self.assertFalse(self.call("POST", "/live/api/finding_resolve", {"id": "f1", "state": "answered"})[1]["ok"], "a gap needs an answer")
        self.assertTrue(self.call("POST", "/live/api/finding_resolve", {"id": "f1", "state": "answered", "answer": "personal accounts"})[1]["ok"])
        self.assertTrue(self.call("POST", "/live/api/finding_resolve", {"id": "f2", "state": "rejected"})[1]["ok"])
        _, state = self.call("GET", "/live/state.json")
        got = {f["id"]: f for f in state["brief"]["findings"]}
        self.assertEqual((got["f1"]["state"], got["f1"]["answer"], got["f2"]["state"]), ("answered", "personal accounts", "rejected"))

    def test_placements_are_reported_for_picked_pieces(self):
        tracker(self.p, "catalog", "select", "sw-components/ring-chart")
        tracker(self.p, "place", "add", "sw-components/ring-chart", "--where", "dashboard")
        _, state = self.call("GET", "/live/state.json")
        self.assertEqual([(p["id"], p["placed"], p["used_in"]) for p in state["placements"]], [("sw-components/ring-chart", True, None)])

    def test_the_page_has_the_idea_box_and_still_never_uses_innerhtml(self):
        with open(os.path.join(ROOT, "site", "live", "index.html"), encoding="utf-8") as f:
            html = f.read()
        for marker in ('id="idea-text"', 'id="idea-list"', 'id="pl-list"'):
            self.assertIn(marker, html)
        with open(os.path.join(ROOT, "site", "live", "live.js"), encoding="utf-8") as f:
            self.assertNotIn("innerHTML", f.read())


if __name__ == "__main__":
    unittest.main()
