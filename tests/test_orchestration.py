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
import hs_live  # noqa: E402

TRACKER = os.path.join(SCRIPTS, "hyperskill.py")
HOOK = os.path.join(SCRIPTS, "hs_hook.py")


EMPTY_HOME = tempfile.mkdtemp()  # skills installed on the machine running the tests must not change what the plan says


def tracker(root, *args, check=True):
    return subprocess.run([sys.executable, TRACKER, "--root", root, *args], capture_output=True, text=True, check=check,
                          env=dict(os.environ, HOME=EMPTY_HOME))


def free_port():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def load(name):
    with open(os.path.join(ROOT, "skills", "hyperskill", name), encoding="utf-8") as f:
        return json.load(f)


class DataTests(unittest.TestCase):
    def test_every_phase_slot_has_a_when_and_a_why_and_nothing_extra(self):
        orch = load("orchestration.json")["phases"]
        for ph in load("gates.json")["phases"]:
            entries = orch[ph["id"]]
            self.assertEqual({e["slot"] for e in entries}, set(ph["slots"]), ph["id"])
            self.assertEqual(len(entries), len({e["slot"] for e in entries}), "duplicate slot in " + ph["id"])
            for e in entries:
                self.assertIn(e["need"], ("core", "situational", "optional"), e["slot"])
                self.assertGreater(len(e["when"]), 15, e["slot"])
                self.assertGreater(len(e["why"]), 15, e["slot"])

    def test_every_phase_has_a_core_decision_or_is_honestly_all_situational(self):
        orch = load("orchestration.json")["phases"]
        for pid, entries in orch.items():
            self.assertTrue(entries, pid)


class PlanTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.p = self.tmp.name
        tracker(self.p, "init", "--name", "demo", "--no-karpathy")

    def tearDown(self):
        self.tmp.cleanup()

    def rows(self, phase=None):
        args = ["skills", "--json"] + (["--phase", phase] if phase else [])
        return {r["slot"]: r for r in json.loads(tracker(self.p, *args).stdout)}

    def test_the_plan_says_what_to_do_for_each_slot(self):
        r = self.rows("product")
        self.assertEqual(r["design-direction"]["status"], "pull")
        self.assertEqual(r["design-direction"]["provider"], "taste-skill")
        self.assertEqual(r["design-direction"]["need"], "core")
        self.assertEqual(r["implementation-discipline"]["status"], "ask")
        self.assertEqual(r["site-scaffold"]["status"], "ask", "opt-in bundled skills wait for the user")
        self.assertEqual(self.rows("harden")["security-audit"]["status"], "pull")
        self.assertEqual(self.rows("operate")["canary"]["status"], "install", "gstack is opt-in and not bundled: the user installs it")
        self.assertEqual(self.rows("scale")["parallel-terminals"]["status"], "install")

    def test_pulling_a_recommended_skill_installs_it_and_makes_it_ready(self):
        tracker(self.p, "skills", "pull", "taste-skill", "--why", "product needs a direction")
        self.assertTrue(os.path.isfile(os.path.join(self.p, ".claude", "skills", "taste-skill", "SKILL.md")))
        self.assertEqual(self.rows("product")["design-direction"]["status"], "ready")

    def test_an_opt_in_skill_is_not_pulled_without_the_users_yes(self):
        r = tracker(self.p, "skills", "pull", "superpowers", check=False)
        self.assertNotEqual(r.returncode, 0)
        self.assertIn("ask the user", r.stderr)
        self.assertFalse(os.path.exists(os.path.join(self.p, ".claude", "skills", "brainstorming")))
        tracker(self.p, "skills", "pull", "superpowers", "--user-approved")
        self.assertTrue(os.path.isdir(os.path.join(self.p, ".claude", "skills", "brainstorming")))

    def test_skills_that_are_not_bundled_or_not_allowed_are_refused_with_the_reason(self):
        r = tracker(self.p, "skills", "pull", "gstack", "--user-approved", check=False)
        self.assertIn("not bundled", r.stderr)
        r = tracker(self.p, "skills", "pull", "onetake", check=False)
        self.assertNotEqual(r.returncode, 0)
        r = tracker(self.p, "skills", "pull", "mirofish", check=False)
        self.assertNotEqual(r.returncode, 0)

    def test_a_decision_needs_a_reason_and_a_real_slot_and_shows_in_the_plan(self):
        self.assertNotEqual(tracker(self.p, "skills", "skip", "deep-research", check=False).returncode, 0)
        self.assertNotEqual(tracker(self.p, "skills", "skip", "icons", "--why", "x", check=False).returncode, 0, "icons is not a research slot")
        tracker(self.p, "skills", "skip", "deep-research", "--why", "the market is already documented")
        row = self.rows()["deep-research"]
        self.assertEqual((row["decision"], row["decision_why"]), ("skipped", "the market is already documented"))
        tracker(self.p, "skills", "use", "video-analysis", "--why", "competitor demo video", "--provider", "watch")
        self.assertEqual(self.rows()["video-analysis"]["decision_provider"], "watch")

    def test_advance_warns_about_undecided_core_skills_prints_the_next_plan_and_releases_pulls(self):
        tracker(self.p, "skills", "pull", "taste-skill", "--phase", "research", "--why", "x")
        with open(os.path.join(self.p, ".hyperskill", "state.json"), encoding="utf-8") as f:
            st = json.load(f)
        self.assertEqual([x["id"] for x in st["pulled"]], ["taste-skill"])
        # clear the research gate with waivers so advance can run
        ids = ",".join(i["id"] for i in load("gates.json")["phases"][0]["gate"])
        tracker(self.p, "gate", "research", "--waive", ids, "--reason", "test run")
        out = tracker(self.p, "advance").stdout
        self.assertIn("skills not decided in research: deep-research", out)
        self.assertIn("Skills for phase plan", out)
        self.assertIn("released at the end of research: taste-skill", out)
        self.assertFalse(os.path.exists(os.path.join(self.p, ".claude", "skills", "taste-skill")))

    def test_a_pull_the_next_phase_still_wants_is_kept(self):
        tracker(self.p, "skills", "pull", "karpathy-skills", "--why", "discipline")
        ids = ",".join(i["id"] for i in load("gates.json")["phases"][0]["gate"])
        tracker(self.p, "gate", "research", "--waive", ids, "--reason", "test run")
        out = tracker(self.p, "advance").stdout
        self.assertNotIn("released", out)
        self.assertTrue(os.path.isdir(os.path.join(self.p, ".claude", "skills", "karpathy-guidelines")))

    def test_the_session_hook_hands_claude_the_plan(self):
        r = subprocess.run([sys.executable, HOOK, "start"], input=json.dumps({"cwd": self.p}), capture_output=True, text=True,
                           env=dict(os.environ, HYPERSKILL_NO_LIVE="1", HOME=EMPTY_HOME))
        ctx = json.loads(r.stdout)["hookSpecificOutput"]["additionalContext"]
        self.assertIn("Skills for phase research", ctx)
        self.assertIn("deep-research", ctx)
        self.assertIn("skills use|skip", ctx)


class DashboardTests(unittest.TestCase):
    def setUp(self):
        self._home = os.environ.get("HOME")
        os.environ["HOME"] = EMPTY_HOME
        self.addCleanup(lambda: os.environ.__setitem__("HOME", self._home) if self._home is not None else os.environ.pop("HOME", None))
        self.tmp = tempfile.TemporaryDirectory()
        self.p = self.tmp.name
        tracker(self.p, "init", "--name", "demo", "--no-karpathy")
        self.server, self.port = hs_live.make_server(self.p, free_port(), controls=True)
        threading.Thread(target=self.server.serve_forever, daemon=True).start()

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.tmp.cleanup()

    def call(self, method, path, body=None):
        c = http.client.HTTPConnection("127.0.0.1", self.port, timeout=15)
        h = {"Content-Type": "application/json", "X-HS-Token": self.server.token}
        c.request(method, path, body=json.dumps(body) if body is not None else None, headers=h)
        r = c.getresponse()
        data = r.read()
        c.close()
        return r.status, json.loads(data)

    def test_state_carries_the_plan_and_the_buttons_act_on_it(self):
        _, state = self.call("GET", "/live/state.json")
        rows = {r["slot"]: r for r in state["skillplan"]}
        self.assertIn("deep-research", rows)
        self.assertEqual(rows["video-analysis"]["status"], "ask")
        status, res = self.call("POST", "/live/api/skill_skip", {"slot": "deep-research", "why": "known market"})
        self.assertTrue(res["ok"])
        status, res = self.call("POST", "/live/api/pull", {"id": "watch"})
        self.assertTrue(res["ok"], "a click is the user's yes for an opt-in skill")
        _, state = self.call("GET", "/live/state.json")
        rows = {r["slot"]: r for r in state["skillplan"]}
        self.assertEqual(rows["deep-research"]["decision"], "skipped")
        self.assertEqual(rows["video-analysis"]["status"], "ready")

    def test_the_buttons_refuse_unknown_slots_providers_and_empty_reasons(self):
        self.assertEqual(self.call("POST", "/live/api/skill_use", {"slot": "../x", "why": "y"})[0], 400)
        self.assertEqual(self.call("POST", "/live/api/skill_skip", {"slot": "deep-research", "why": ""})[0], 400)
        self.assertEqual(self.call("POST", "/live/api/pull", {"id": "nope"})[0], 400)
        self.assertEqual(self.call("POST", "/live/api/pull", {"id": "gstack"})[1]["ok"], False)


if __name__ == "__main__":
    unittest.main()
