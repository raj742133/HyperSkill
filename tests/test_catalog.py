import http.client
import json
import os
import shutil
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
from _auth import confirm_items, seed_docs, write_state  # noqa: E402,F401
import hs_live  # noqa: E402

TRACKER = os.path.join(SCRIPTS, "hyperskill.py")
HOOK = os.path.join(SCRIPTS, "hs_hook.py")
EMPTY_HOME = tempfile.mkdtemp()


def tracker(root, *args, check=True):
    return subprocess.run([sys.executable, TRACKER, "--root", root, *args], capture_output=True, text=True, check=check,
                          env=dict(os.environ, HOME=EMPTY_HOME))


def free_port():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def catalog():
    with open(os.path.join(ROOT, "skills", "hyperskill", "catalog.json"), encoding="utf-8") as f:
        return json.load(f)


def phases():
    with open(os.path.join(ROOT, "skills", "hyperskill", "gates.json"), encoding="utf-8") as f:
        return [p["id"] for p in json.load(f)["phases"]]


class CatalogDataTests(unittest.TestCase):
    def groups(self):
        return {g["id"]: g for g in catalog()["groups"]}

    def test_the_owners_lists_are_all_there(self):
        g = self.groups()
        self.assertEqual(len(g["tells"]["items"]), 30)
        self.assertEqual(len(g["concepts"]["items"]), 111)
        self.assertEqual(len(g["fixes"]["items"]), 20)
        names = {i["name"] for i in g["addons"]["items"]}
        for want in ("Dark mode toggle", "Optimistic UI", "Pagination", "Skip to content", "Expandable FAQ", "UTM tracking"):
            self.assertIn(want, names)
        concepts = {i["name"].lower() for i in g["concepts"]["items"]}
        for want in ("rate limiting", "idempotency", "saga pattern", "postmortems", "sql injection", "database migrations"):
            self.assertIn(want, concepts)

    def test_sitewright_is_listed_in_full(self):
        g = self.groups()
        self.assertGreaterEqual(len(g["sw-components"]["items"]), 58)
        self.assertEqual(len(g["sw-figures"]["items"]), 22)
        self.assertGreaterEqual(len(g["sw-hero"]["items"]), 10)
        self.assertEqual(len(g["sw-modules"]["items"]), 7)
        self.assertEqual({i["name"] for i in g["sw-extras"]["items"]}, {"cursor-glow", "scroll-progress", "click-spark", "count-up"})

    def test_every_item_is_well_formed(self):
        ids, valid = set(), set(phases())
        for g in catalog()["groups"]:
            self.assertIn(g["mode"], ("build", "track"))
            for it in g["items"]:
                self.assertTrue(it["id"].startswith(g["id"] + "/"), it["id"])
                self.assertNotIn(it["id"], ids)
                ids.add(it["id"])
                self.assertTrue(it["name"].strip(), it["id"])
                self.assertIn(it["phase"], valid, it["id"])
                self.assertEqual(it["mode"], g["mode"], it["id"])
                if it["mode"] == "track":
                    self.assertGreater(len(it["text"]), 20, it["id"])
                if g.get("exclusive"):
                    # True: the group is its own exclusive set; a string: it shares the set with the group of that name
                    self.assertEqual(it.get("exclusive"), g["exclusive"] if isinstance(g["exclusive"], str) else g["id"], it["id"])
        self.assertGreater(len(ids), 700)

    def test_palettes_carry_real_colours(self):
        for it in self.groups()["uu-palettes"]["items"]:
            self.assertEqual(len(it["swatch"]), 5)
            for c in it["swatch"]:
                self.assertRegex(c, r"^#[0-9A-Fa-f]{3,8}$", it["id"])

    @unittest.skipUnless(shutil.which("node"), "needs node to list Sitewright's options")
    def test_the_committed_catalogue_matches_what_the_packs_offer(self):
        r = subprocess.run([sys.executable, os.path.join(SCRIPTS, "build_catalog.py"), "--check"], capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stderr)


class SelectionTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.p = self.tmp.name
        tracker(self.p, "init", "--name", "demo", "--no-karpathy")

    def tearDown(self):
        self.tmp.cleanup()

    def state(self):
        with open(os.path.join(self.p, ".hyperskill", "state.json"), encoding="utf-8") as f:
            return json.load(f)

    def test_picking_tracks_only_the_items_that_need_doing(self):
        tracker(self.p, "catalog", "select", "concepts/rate-limiting", "sw-hero/aurora", "tells/harsh-gradients")
        st = self.state()
        self.assertEqual(sorted(st["catalog"]["selected"]), ["concepts/rate-limiting", "sw-hero/aurora", "tells/harsh-gradients"])
        self.assertEqual(sorted(st["extras"]), ["concepts/rate-limiting", "tells/harsh-gradients"], "a Sitewright effect is built, not tracked")
        self.assertEqual(st["extras"]["concepts/rate-limiting"]["phase"], "harden")

    def test_an_alternative_replaces_the_one_picked_before_but_set_is_strict(self):
        tracker(self.p, "catalog", "select", "sw-hero/aurora")
        tracker(self.p, "catalog", "select", "sw-hero/mesh")
        self.assertEqual(self.state()["catalog"]["selected"], ["sw-hero/mesh"])
        r = tracker(self.p, "catalog", "set", "sw-hero/aurora", "sw-hero/mesh", check=False)
        self.assertIn("pick one only", r.stderr)
        self.assertEqual(tracker(self.p, "catalog", "select", "nope/x", check=False).returncode, 1)

    def test_a_phase_cannot_end_while_a_picked_check_is_open(self):
        tracker(self.p, "catalog", "select", "tells/purple-and-black-palette", "concepts/ci-cd")
        st = self.state()
        self.assertEqual(st["extras"]["concepts/ci-cd"]["phase"], "ship")
        cur = "research"
        tracker(self.p, "catalog", "unselect", "concepts/ci-cd", "tells/purple-and-black-palette")
        tracker(self.p, "catalog", "select", "fixes/add-a-favicon")  # product phase
        ids = ",".join(i["id"] for i in json.load(open(os.path.join(ROOT, "skills", "hyperskill", "gates.json"), encoding="utf-8"))["phases"][0]["gate"])
        confirm_items(self.p, cur)
        tracker(self.p, "gate", cur, "--waive", ids, "--reason", "test run")
        out = tracker(self.p, "advance").stdout
        self.assertIn("advanced: research -> plan", out)

    def test_open_checks_in_the_current_phase_block_advance_until_closed_with_evidence_or_a_reason(self):
        tracker(self.p, "catalog", "select", "concepts/semantic-versioning", "concepts/dns")
        tracker(self.p, "catalog", "select", "concepts/timeouts")  # foundation
        # a research-phase pick: add a tracked item whose phase is research by selecting while current is research? use CLI set on a real item
        st = self.state()
        st["extras"]["concepts/dns"]["phase"] = "research"
        write_state(self.p, st)
        ids = ",".join(i["id"] for i in json.load(open(os.path.join(ROOT, "skills", "hyperskill", "gates.json"), encoding="utf-8"))["phases"][0]["gate"])
        confirm_items(self.p, "research")
        tracker(self.p, "gate", "research", "--waive", ids, "--reason", "test run")
        r = tracker(self.p, "advance", check=False)
        self.assertNotEqual(r.returncode, 0)
        self.assertIn("selected checks still open in 'research': concepts/dns", r.stderr)
        self.assertNotEqual(tracker(self.p, "extras", "done", "concepts/dns", "--evidence", "looks fine", check=False).returncode, 0, "vague evidence is refused")
        self.assertNotEqual(tracker(self.p, "extras", "waive", "concepts/dns", check=False).returncode, 0, "a waiver needs a reason")
        tracker(self.p, "extras", "waive", "concepts/dns", "--reason", "DNS is managed by the host for this project")
        self.assertIn("advanced", tracker(self.p, "advance").stdout)

    def test_the_brief_and_the_sitewright_config_add_up_the_picks(self):
        tracker(self.p, "catalog", "select", "sw-modules/landing", "sw-hero/aurora", "sw-components/hold-to-confirm", "sw-components/ring-chart",
                "sw-extras/scroll-progress", "sw-theme/classic", "sw-figures/padlock", "sw-figures/vault")
        cfg = json.loads(tracker(self.p, "catalog", "sitewright").stdout)
        self.assertEqual(cfg["modules"], ["landing"])
        self.assertEqual(cfg["effects"]["heroBackground"], "aurora")
        self.assertEqual(sorted(cfg["effects"]["components"]), ["hold-to-confirm", "ring-chart"])
        self.assertEqual(cfg["effects"]["extras"], ["scroll-progress"])
        self.assertEqual(cfg["design"], {"theme": "classic"})
        self.assertEqual(cfg["effects"]["figures"], {"signin": "padlock", "mfa": "vault"})
        brief = tracker(self.p, "catalog", "brief", "--phase", "plan").stdout
        self.assertIn("hold-to-confirm", brief)
        self.assertIn("Sitewright config", brief)

    def test_the_session_hook_hands_claude_the_picks(self):
        tracker(self.p, "catalog", "select", "sw-hero/aurora", "concepts/webhooks")
        st = self.state()
        st["current"] = "plan"
        st["extras"]["concepts/webhooks"]["phase"] = "plan"
        write_state(self.p, st)
        r = subprocess.run([sys.executable, HOOK, "start"], input=json.dumps({"cwd": self.p}), capture_output=True, text=True,
                           env=dict(os.environ, HYPERSKILL_NO_LIVE="1", HOME=EMPTY_HOME))
        ctx = json.loads(r.stdout)["hookSpecificOutput"]["additionalContext"]
        self.assertIn("HyperSkill selections", ctx)
        self.assertIn("aurora", ctx)
        self.assertIn("concepts/webhooks", ctx)


class DashboardCatalogTests(unittest.TestCase):
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
        c = http.client.HTTPConnection("127.0.0.1", self.port, timeout=20)
        c.request(method, path, body=json.dumps(body) if body is not None else None,
                  headers={"Content-Type": "application/json", "X-HS-Token": self.server.token})
        r = c.getresponse()
        data = r.read()
        c.close()
        return r.status, data

    def test_the_catalogue_is_served_and_the_state_reports_the_picks(self):
        status, data = self.call("GET", "/live/catalog.json")
        self.assertEqual(status, 200)
        self.assertGreater(sum(len(g["items"]) for g in json.loads(data)["groups"]), 700)
        status, res = self.call("POST", "/live/api/catalog_apply", {"ids": ["concepts/timeouts", "sw-hero/aurora"], "tell_claude": True})
        self.assertTrue(json.loads(res)["ok"])
        state = json.loads(self.call("GET", "/live/state.json")[1])
        self.assertEqual(sorted(state["catalog"]["selected"]), ["concepts/timeouts", "sw-hero/aurora"])
        self.assertEqual([e["id"] for e in state["extras"]], ["concepts/timeouts"])
        with open(os.path.join(self.p, ".hyperskill", "inbox.jsonl"), encoding="utf-8") as f:
            self.assertIn("catalog brief", f.read())

    def test_bad_ids_and_alternatives_are_refused_and_checks_close_with_the_trackers_rules(self):
        self.assertEqual(self.call("POST", "/live/api/catalog_apply", {"ids": ["../x"]})[0], 400)
        self.assertEqual(self.call("POST", "/live/api/catalog_apply", {"ids": "nope"})[0], 400)
        res = json.loads(self.call("POST", "/live/api/catalog_apply", {"ids": ["sw-hero/aurora", "sw-hero/mesh"]})[1])
        self.assertFalse(res["ok"])
        self.call("POST", "/live/api/catalog_apply", {"ids": ["concepts/timeouts"]})
        self.assertEqual(self.call("POST", "/live/api/extra_done", {"id": "concepts/unknown", "evidence": "x"})[0], 400)
        res = json.loads(self.call("POST", "/live/api/extra_waive", {"id": "concepts/timeouts", "reason": "handled by the host"})[1])
        self.assertTrue(res["ok"])
        state = json.loads(self.call("GET", "/live/state.json")[1])
        self.assertEqual(state["extras"][0]["state"], "waived")

    def test_the_page_has_the_picker_and_never_uses_innerhtml(self):
        with open(os.path.join(ROOT, "site", "live", "index.html"), encoding="utf-8") as f:
            html = f.read()
        for marker in ('id="kit"', 'id="kit-nav"', 'id="kit-save"', 'id="xt"'):
            self.assertIn(marker, html)
        with open(os.path.join(ROOT, "site", "live", "live.js"), encoding="utf-8") as f:
            self.assertNotIn("innerHTML", f.read())


if __name__ == "__main__":
    unittest.main()
