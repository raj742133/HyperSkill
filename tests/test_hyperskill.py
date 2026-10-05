import json
import os
import subprocess
import sys
import tempfile
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPT = os.path.join(ROOT, "scripts", "hyperskill.py")
GATES = os.path.join(ROOT, "skills", "hyperskill", "gates.json")


def run(project, *args):
    return subprocess.run([sys.executable, SCRIPT, "--root", project, *args],
                          capture_output=True, text=True)


def gates():
    with open(GATES, encoding="utf-8") as f:
        return json.load(f)["phases"]


class GateTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.p = self.tmp.name
        self.assertEqual(run(self.p, "init", "--name", "demo").returncode, 0)

    def tearDown(self):
        self.tmp.cleanup()

    def state(self):
        with open(os.path.join(self.p, ".hyperskill", "state.json"), encoding="utf-8") as f:
            return json.load(f)

    def test_cannot_advance_with_open_gate(self):
        r = run(self.p, "advance")
        self.assertNotEqual(r.returncode, 0)
        self.assertIn("problem-statement", r.stderr)

    def test_pass_requires_evidence(self):
        r = run(self.p, "gate", "research", "--pass", "problem-statement")
        self.assertNotEqual(r.returncode, 0)
        self.assertIn("evidence", r.stderr)

    def test_waive_requires_reason(self):
        r = run(self.p, "gate", "research", "--waive", "go-no-go")
        self.assertNotEqual(r.returncode, 0)

    def test_unknown_item_rejected(self):
        r = run(self.p, "gate", "research", "--pass", "nope", "--evidence", "x")
        self.assertNotEqual(r.returncode, 0)

    def test_full_walk_through_every_phase(self):
        for ph in gates():
            ids = ",".join(i["id"] for i in ph["gate"])
            self.assertEqual(run(self.p, "gate", ph["id"], "--pass", ids, "--evidence", "ran it").returncode, 0)
            r = run(self.p, "advance")
            self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIsNone(self.state()["current"])
        self.assertIn("pipeline complete", run(self.p, "status").stdout)

    def test_waived_items_clear_the_gate(self):
        ids = [i["id"] for i in gates()[0]["gate"]]
        run(self.p, "gate", "research", "--pass", ",".join(ids[:-1]), "--evidence", "e")
        run(self.p, "gate", "research", "--waive", ids[-1], "--reason", "n/a")
        self.assertEqual(run(self.p, "advance").returncode, 0)
        self.assertEqual(self.state()["current"], "plan")

    def test_skip_phase_moves_on_and_advance_jumps_over(self):
        self.assertEqual(run(self.p, "skip", "research", "--reason", "idea already validated").returncode, 0)
        self.assertEqual(self.state()["current"], "plan")
        run(self.p, "skip", "foundation", "--reason", "static site")
        ids = ",".join(i["id"] for i in gates()[1]["gate"])
        run(self.p, "gate", "plan", "--pass", ids, "--evidence", "e")
        run(self.p, "advance")
        self.assertEqual(self.state()["current"], "product")

    def test_decide_writes_record_with_sequential_numbers(self):
        run(self.p, "decide", "--title", "Auth provider", "--choice", "Clerk", "--why", "least code")
        run(self.p, "decide", "--title", "Hosting: Vercel!", "--choice", "Vercel", "--why", "managed")
        files = sorted(os.listdir(os.path.join(self.p, "docs", "decisions")))
        self.assertEqual(files, ["0001-auth-provider.md", "0002-hosting-vercel.md"])
        self.assertEqual(len(self.state()["decisions"]), 2)

    def test_init_refuses_to_overwrite(self):
        self.assertNotEqual(run(self.p, "init").returncode, 0)
        self.assertEqual(run(self.p, "init", "--force").returncode, 0)


class DataTests(unittest.TestCase):
    def test_gate_ids_unique_per_phase_and_skills_exist(self):
        for ph in gates():
            ids = [i["id"] for i in ph["gate"]]
            self.assertEqual(len(ids), len(set(ids)), ph["id"])
            self.assertTrue(os.path.isfile(os.path.join(ROOT, "skills", ph["skill"], "SKILL.md")),
                            "missing skill " + ph["skill"])


if __name__ == "__main__":
    unittest.main()


class IntegrationTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.p = self.tmp.name
        self.home = os.path.join(self.p, "home")
        os.makedirs(self.home)
        self.proj = os.path.join(self.p, "proj")
        os.makedirs(self.proj)
        run(self.proj, "init", "--name", "x")

    def tearDown(self):
        self.tmp.cleanup()

    def irun(self, *args, root=None):
        env = dict(os.environ, HOME=self.home, PATH="/usr/bin:/bin")
        return subprocess.run([sys.executable, SCRIPT, "--root", root or self.proj, *args],
                              capture_output=True, text=True, env=env)

    def resolve(self, slot, root=None):
        r = self.irun("integrations", "resolve", slot, "--json", root=root)
        self.assertEqual(r.returncode, 0, r.stderr)
        return json.loads(r.stdout)

    def install_fake_skill(self, name):
        d = os.path.join(self.home, ".claude", "skills", name)
        os.makedirs(d)
        with open(os.path.join(d, "SKILL.md"), "w", encoding="utf-8") as f:
            f.write("---\nname: %s\ndescription: fake\n---\n" % name)

    def test_missing_provider_falls_back_and_suggests_install(self):
        out = self.resolve("design-direction")
        self.assertIsNone(out["use"])
        self.assertEqual(out["suggest_install"][0]["id"], "taste-skill")
        self.assertIn("design-system", out["fallback"])

    def test_installed_provider_is_detected_and_used(self):
        self.install_fake_skill("impeccable")
        self.assertEqual(self.resolve("design-critique")["use"], "impeccable")

    def test_noncommercial_licence_blocked_for_commercial_project(self):
        self.install_fake_skill("onetake")
        out = self.resolve("video-continuous")
        self.assertIsNone(out["use"])
        self.assertIn("commercial", out["providers"][0]["why"])

    def test_noncommercial_project_unlocks_it(self):
        self.install_fake_skill("onetake")
        nc = os.path.join(self.p, "nc")
        os.makedirs(nc)
        run(nc, "init", "--noncommercial")
        self.assertEqual(self.resolve("video-continuous", root=nc)["use"], "onetake")

    def test_opt_in_provider_needs_enable(self):
        self.install_fake_skill("watch")
        self.assertIsNone(self.resolve("video-analysis")["use"])
        self.assertEqual(self.irun("integrations", "enable", "watch").returncode, 0)
        self.assertEqual(self.resolve("video-analysis")["use"], "watch")
        self.irun("integrations", "disable", "watch")
        self.assertIsNone(self.resolve("video-analysis")["use"])

    def test_gstack_stays_off_unless_enabled(self):
        self.install_fake_skill("office-hours")
        self.assertIsNone(self.resolve("product-interrogation")["use"])

    def test_unknown_slot_and_provider_rejected(self):
        self.assertNotEqual(self.irun("integrations", "resolve", "nope").returncode, 0)
        self.assertNotEqual(self.irun("integrations", "enable", "nope").returncode, 0)

    def test_every_phase_slot_and_provider_is_defined(self):
        with open(os.path.join(ROOT, "skills", "hyperskill", "integrations.json"), encoding="utf-8") as f:
            reg = json.load(f)
        for ph in gates():
            for slot in ph["slots"]:
                self.assertIn(slot, reg["slots"], "%s: slot %s" % (ph["id"], slot))
        for slot, sd in reg["slots"].items():
            self.assertTrue(sd["fallback"], slot)
            for pid in sd["providers"]:
                self.assertIn(pid, reg["providers"], "%s -> %s" % (slot, pid))
        for pid, prov in reg["providers"].items():
            self.assertIn("policy", prov, pid)
            self.assertIn("license", prov, pid)

    def test_phase_view_resolves_all_slots(self):
        r = self.irun("integrations", "phase", "harden")
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn("security-audit", r.stdout)


class RunGateTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.p = self.tmp.name
        run(self.p, "init")

    def tearDown(self):
        self.tmp.cleanup()

    def test_passing_command_records_evidence(self):
        r = run(self.p, "gate", "research", "--run", "problem-statement", "--cmd", "echo proof-123")
        self.assertEqual(r.returncode, 0, r.stderr)
        with open(os.path.join(self.p, ".hyperskill", "state.json"), encoding="utf-8") as f:
            rec = json.load(f)["phases"]["research"]["gate"]["problem-statement"]
        self.assertTrue(rec["ran"])
        self.assertIn("proof-123", rec["evidence"])

    def test_failing_command_leaves_item_open(self):
        r = run(self.p, "gate", "research", "--run", "problem-statement", "--cmd", "exit 3")
        self.assertNotEqual(r.returncode, 0)
        self.assertNotIn("[x] problem-statement", run(self.p, "gate", "research").stdout)

    def test_run_needs_cmd_and_valid_item(self):
        self.assertNotEqual(run(self.p, "gate", "research", "--run", "problem-statement").returncode, 0)
        self.assertNotEqual(run(self.p, "gate", "research", "--run", "nope", "--cmd", "true").returncode, 0)
