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
