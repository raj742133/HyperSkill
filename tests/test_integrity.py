import http.client
import json
import os
import stat
import subprocess
import sys
import tempfile
import threading
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPTS = os.path.join(ROOT, "scripts")
sys.path.insert(0, SCRIPTS)
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _auth  # noqa: E402,F401
from _auth import confirm_items, seed_docs  # noqa: E402
import hs_live  # noqa: E402

TRACKER = os.path.join(SCRIPTS, "hyperskill.py")
HOOK = os.path.join(SCRIPTS, "hs_hook.py")


def run(root, *args, env=None):
    return subprocess.run([sys.executable, TRACKER, "--root", root, *args], capture_output=True, text=True, env=dict(os.environ, **(env or {})))


class Base(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.p = self.tmp.name
        self.assertEqual(run(self.p, "init", "--name", "demo", "--tenancy", "none", "--no-karpathy").returncode, 0)
        seed_docs(self.p)

    def state_path(self):
        return os.path.join(self.p, ".hyperskill", "state.json")

    def state(self):
        with open(self.state_path(), encoding="utf-8") as f:
            return json.load(f)


class TamperTests(Base):
    def forge(self):
        st = self.state()
        for item in ("problem-statement", "alternatives-mapped", "user-evidence", "risks-listed", "go-no-go"):
            st["phases"]["research"]["gate"][item] = {"state": "passed", "evidence": "docs/research.md 5 items", "at": "now"}
        with open(self.state_path(), "w", encoding="utf-8") as f:
            json.dump(st, f)

    def test_passing_every_check_by_editing_the_state_file_no_longer_advances_anything(self):
        self.forge()
        r = run(self.p, "advance")
        self.assertNotEqual(r.returncode, 0)
        self.assertIn("changed outside HyperSkill commands", r.stderr)
        self.assertEqual(self.state()["current"], "research")
        for cmd in (("status",), ("gate", "research"), ("log", "x")):
            self.assertNotEqual(run(self.p, *cmd).returncode, 0, cmd)

    def test_deleting_the_signature_of_a_signed_state_is_caught_too(self):
        os.remove(os.path.join(self.p, ".hyperskill", "state.sig"))
        r = run(self.p, "status")
        self.assertNotEqual(r.returncode, 0)
        self.assertIn("state.sig is missing", r.stderr)

    def test_the_refusal_is_written_to_the_activity_log_so_the_dashboard_shows_it(self):
        self.forge()
        run(self.p, "status")
        with open(os.path.join(self.p, ".hyperskill", "activity.jsonl"), encoding="utf-8") as f:
            last = [json.loads(line) for line in f][-1]
        self.assertEqual(last["type"], "refused")
        self.assertIn("outside HyperSkill commands", last["text"])

    def test_a_person_can_keep_the_edit_or_go_back_and_nothing_is_lost_either_way(self):
        before = self.state()
        self.forge()
        edited = self.state()
        self.assertEqual(run(self.p, "repair").returncode, 0)
        self.assertIn("tampered", run(self.p, "repair").stdout)
        self.assertEqual(run(self.p, "repair", "--restore").returncode, 0)
        self.assertEqual(self.state()["phases"]["research"]["gate"], before["phases"]["research"]["gate"])
        self.assertEqual(run(self.p, "status").returncode, 0)
        with open(self.state_path() + ".rejected", encoding="utf-8") as f:
            self.assertEqual(json.load(f)["phases"]["research"]["gate"], edited["phases"]["research"]["gate"], "the file that was replaced is kept")
        self.forge()
        self.assertEqual(run(self.p, "repair", "--accept").returncode, 0)
        self.assertEqual(run(self.p, "status").returncode, 0)

    def test_the_keys_are_private_and_the_signature_follows_every_save(self):
        self.assertEqual(stat.S_IMODE(os.stat(os.path.join(self.p, ".hyperskill", "secret.key")).st_mode), 0o600)
        run(self.p, "log", "hello")
        self.assertEqual(run(self.p, "repair").stdout.split()[1], "ok")

    def test_init_force_starts_over_with_a_new_secret(self):
        with open(os.path.join(self.p, ".hyperskill", "secret.key"), encoding="utf-8") as f:
            old = f.read()
        self.assertEqual(run(self.p, "init", "--force", "--name", "demo", "--no-karpathy").returncode, 0)
        with open(os.path.join(self.p, ".hyperskill", "secret.key"), encoding="utf-8") as f:
            self.assertNotEqual(f.read(), old)
        self.assertEqual(run(self.p, "status").returncode, 0)


class RecoveryTests(Base):
    def test_a_damaged_file_says_how_to_recover_instead_of_a_traceback(self):
        with open(self.state_path(), "w", encoding="utf-8") as f:
            f.write("{bad")
        r = run(self.p, "status")
        self.assertNotEqual(r.returncode, 0)
        self.assertNotIn("Traceback", r.stderr)
        self.assertIn("repair --restore", r.stderr)
        self.assertEqual(run(self.p, "repair", "--restore").returncode, 0)
        self.assertEqual(run(self.p, "status").returncode, 0)

    def test_every_save_keeps_the_previous_good_copy(self):
        run(self.p, "decide", "--title", "Pick Node", "--choice", "Node 22", "--why", "known")
        with open(self.state_path() + ".bak", encoding="utf-8") as f:
            self.assertEqual(json.load(f)["decisions"], [])
        self.assertEqual(len(self.state()["decisions"]), 1)

    def test_repair_refuses_when_there_is_nothing_to_go_back_to(self):
        os.remove(self.state_path() + ".bak")
        with open(self.state_path(), "w", encoding="utf-8") as f:
            f.write("{bad")
        r = run(self.p, "repair", "--restore")
        self.assertNotEqual(r.returncode, 0)
        self.assertNotEqual(run(self.p, "repair", "--accept").returncode, 0, "a file that cannot be read cannot be accepted")

    def test_a_project_from_before_signing_is_signed_by_its_next_save(self):
        st = self.state()
        del st["signed"]
        with open(self.state_path(), "w", encoding="utf-8") as f:
            json.dump(st, f)
        os.remove(os.path.join(self.p, ".hyperskill", "state.sig"))
        self.assertEqual(run(self.p, "status").returncode, 0)
        self.assertEqual(run(self.p, "log", "x").returncode, 0)
        self.assertTrue(self.state()["signed"])


class EvidenceTests(Base):
    def test_a_file_that_does_not_exist_is_not_evidence(self):
        r = run(self.p, "gate", "research", "--pass", "problem-statement", "--evidence", "written up in docs/nope.md (3 pages)")
        self.assertNotEqual(r.returncode, 0)
        self.assertIn("docs/nope.md", r.stderr)
        self.assertEqual(run(self.p, "gate", "research", "--pass", "problem-statement", "--evidence", "written up in docs/research.md (3 pages)").returncode, 0)

    def test_a_bare_file_name_must_exist_somewhere_in_the_project_and_links_and_versions_are_ignored(self):
        os.makedirs(os.path.join(self.p, "src"))
        with open(os.path.join(self.p, "src", "app.js"), "w") as f:
            f.write("x")
        ok = "read src/app.js and see https://example.com/page.html and v1.2.3 plus 3.5 ms"
        self.assertEqual(run(self.p, "gate", "research", "--pass", "problem-statement", "--evidence", ok).returncode, 0)
        r = run(self.p, "gate", "research", "--pass", "alternatives-mapped", "--evidence", "see ghost.js for the 3 alternatives compared")
        self.assertNotEqual(r.returncode, 0)
        self.assertIn("ghost.js", r.stderr)
        self.assertEqual(run(self.p, "gate", "research", "--pass", "alternatives-mapped", "--evidence", "see app.js for the 3 alternatives compared").returncode, 0)

    def test_commands_that_cannot_fail_are_refused_and_real_ones_run(self):
        for cmd in ("true", ":", "exit 0", "echo ok", "printf done", "sleep 1", "npm test || true", "make check; true", "echo a && echo b"):
            r = run(self.p, "gate", "research", "--run", "problem-statement", "--cmd", cmd)
            self.assertNotEqual(r.returncode, 0, cmd)
            self.assertIn("proves nothing", r.stderr, cmd)
        self.assertNotIn("problem-statement", self.state()["phases"]["research"]["gate"])
        self.assertEqual(run(self.p, "gate", "research", "--run", "problem-statement", "--cmd", "test -f docs/research.md && cat docs/research.md").returncode, 0)


class ConfirmTests(Base):
    ITEMS = (("research", "go-no-go"), ("plan", "system-design-read"), ("plan", "architecture-explained"), ("launch", "promo-rendered"))

    def test_the_four_things_only_a_person_can_know_are_marked(self):
        with open(os.path.join(ROOT, "skills", "hyperskill", "gates.json"), encoding="utf-8") as f:
            marked = sorted((ph["id"], it["id"]) for ph in json.load(f)["phases"] for it in ph["gate"] if it.get("confirm"))
        self.assertEqual(marked, sorted(self.ITEMS))

    def test_claude_cannot_pass_waive_or_run_them_without_the_person(self):
        for phase, item in self.ITEMS[:1]:
            for argv in (("--pass", item, "--evidence", "docs/research.md: the user said go"), ("--waive", item, "--reason", "they agreed"),
                         ("--run", item, "--cmd", "test -f docs/research.md")):
                r = run(self.p, "gate", phase, *argv)
                self.assertNotEqual(r.returncode, 0, argv)
                self.assertIn(item, r.stderr)
            self.assertNotIn(item, self.state()["phases"][phase]["gate"])

    def test_the_confirm_command_needs_the_dashboards_key_which_claude_does_not_have(self):
        self.assertNotEqual(run(self.p, "gate", "research", "--confirm", "go-no-go").returncode, 0)
        self.assertNotEqual(run(self.p, "gate", "research", "--confirm", "go-no-go", env={"HYPERSKILL_CONFIRM_KEY": "guess"}).returncode, 0)
        with open(os.path.join(self.p, ".hyperskill", "live.key"), "w", encoding="utf-8") as f:
            f.write("the-real-key")
        self.assertNotEqual(run(self.p, "gate", "research", "--confirm", "go-no-go", env={"HYPERSKILL_CONFIRM_KEY": ""}).returncode, 0, "an empty guess never matches")
        self.assertNotEqual(run(self.p, "gate", "research", "--confirm", "go-no-go", env={"HYPERSKILL_CONFIRM_KEY": "the-real-keY"}).returncode, 0)
        self.assertNotIn("research/go-no-go", self.state().get("confirmations", {}))
        self.assertEqual(run(self.p, "gate", "research", "--confirm", "go-no-go", env={"HYPERSKILL_CONFIRM_KEY": "the-real-key"}).returncode, 0)
        self.assertIn("research/go-no-go", self.state()["confirmations"])
        r = run(self.p, "gate", "research", "--pass", "go-no-go", "--evidence", "docs/research.md: go, confirmed by the user")
        self.assertEqual(r.returncode, 0, r.stderr)

    def test_only_items_that_need_it_can_be_confirmed(self):
        with open(os.path.join(self.p, ".hyperskill", "live.key"), "w", encoding="utf-8") as f:
            f.write("k")
        r = run(self.p, "gate", "research", "--confirm", "risks-listed", env={"HYPERSKILL_CONFIRM_KEY": "k"})
        self.assertNotEqual(r.returncode, 0)
        self.assertIn("does not need", r.stderr)

    def test_when_no_person_is_available_the_existing_unavailable_route_still_works_and_is_recorded(self):
        run(self.p, "config", "--unavailable", "human")
        self.assertEqual(run(self.p, "gate", "research", "--waive-unavailable").returncode, 0)
        rec = self.state()["phases"]["research"]["gate"]["go-no-go"]
        self.assertEqual(rec["state"], "waived")
        self.assertIn("human", rec["reason"])


class ProtectionTests(Base):
    def gate(self, tool, inp):
        r = subprocess.run([sys.executable, HOOK, "gate"], input=json.dumps({"cwd": self.p, "tool_name": tool, "tool_input": inp}), capture_output=True, text=True)
        self.assertEqual(r.returncode, 0)
        return "deny" in r.stdout

    def test_claude_cannot_write_the_state_the_signature_or_the_backups(self):
        for name in ("state.json", "state.sig", "state.json.bak", "secret.key", "live.key", "anything.txt"):
            for tool in ("Write", "Edit", "MultiEdit"):
                self.assertTrue(self.gate(tool, {"file_path": os.path.join(self.p, ".hyperskill", name), "content": "x"}), (tool, name))
        self.assertFalse(self.gate("Write", {"file_path": os.path.join(self.p, "src", "a.js"), "content": "x"}))
        self.assertFalse(self.gate("Write", {"file_path": os.path.join(self.p, "docs", "research.md"), "content": "x"}))

    def test_claude_cannot_read_a_key_but_may_read_the_state(self):
        for name in ("secret.key", "live.key", "open.html"):
            self.assertTrue(self.gate("Read", {"file_path": os.path.join(self.p, ".hyperskill", name)}), name)
        self.assertFalse(self.gate("Read", {"file_path": os.path.join(self.p, ".hyperskill", "state.json")}))
        self.assertFalse(self.gate("Read", {"file_path": os.path.join(self.p, "README.md")}))
        self.assertTrue(self.gate("Grep", {"path": os.path.join(self.p, ".hyperskill"), "pattern": "key"}))
        self.assertFalse(self.gate("Grep", {"path": self.p, "pattern": "key"}))

    def test_shell_commands_that_touch_keys_or_the_state_are_refused_unless_they_are_only_the_tracker(self):
        for cmd in ("cat .hyperskill/live.key", "cp .hyperskill/secret.key /tmp/x", "sed -i 's/a/b/' .hyperskill/state.json", "echo '{}' > .hyperskill/state.json",
                    "python3 -c \"open('.hyperskill/state.json','w')\"", "python3 /p/scripts/hyperskill.py status; rm .hyperskill/state.sig", "cat .hyperskill/open.html"):
            self.assertTrue(self.gate("Bash", {"command": cmd}), cmd)
        for cmd in ("python3 /p/scripts/hyperskill.py gate research", "npm test", "ls src", "git status", "python3 /p/scripts/hyperskill.py repair --accept .hyperskill/state.json"):
            self.assertFalse(self.gate("Bash", {"command": cmd}), cmd)

    def test_the_hook_is_registered_for_reads_and_searches_too(self):
        with open(os.path.join(ROOT, "hooks", "hooks.json"), encoding="utf-8") as f:
            hooks = json.load(f)["hooks"]["PreToolUse"]
        gate = next(h for h in hooks if "gate" in h["hooks"][0]["command"])
        for tool in ("Write", "Edit", "Bash", "Read", "Grep"):
            self.assertIn(tool, gate["matcher"].split("|"))


class DashboardConfirmTests(Base):
    def setUp(self):
        super().setUp()
        self.server, self.port = hs_live.make_server(self.p, _free_port(), controls=True)
        threading.Thread(target=self.server.serve_forever, daemon=True).start()
        self.addCleanup(lambda: (self.server.shutdown(), self.server.server_close()))

    def call(self, method, path, body=None):
        c = http.client.HTTPConnection("127.0.0.1", self.port, timeout=20)
        c.request(method, path, body=json.dumps(body) if body is not None else None, headers={"Content-Type": "application/json", "X-HS-Token": self.server.token})
        r = c.getresponse()
        data = json.loads(r.read())
        c.close()
        return r.status, data

    def test_the_confirm_button_records_the_persons_word_and_the_check_then_shows_it(self):
        items = {i["id"]: i for i in self.call("GET", "/live/state.json")[1]["phases"][0]["items"]}
        self.assertEqual(items["go-no-go"]["confirm"], "needed")
        self.assertNotIn("confirm", items["risks-listed"])
        self.assertTrue(self.call("POST", "/live/api/confirm", {"phase": "research", "item": "go-no-go"})[1]["ok"])
        items = {i["id"]: i for i in self.call("GET", "/live/state.json")[1]["phases"][0]["items"]}
        self.assertEqual(items["go-no-go"]["confirm"], "confirmed")
        self.assertFalse(self.call("POST", "/live/api/confirm", {"phase": "research", "item": "risks-listed"})[1]["ok"])
        self.assertEqual(self.call("POST", "/live/api/confirm", {"phase": "nope", "item": "go-no-go"})[0], 400)

    def test_a_tampered_state_shows_a_banner_with_a_choice_and_the_person_can_resolve_it(self):
        st = self.state()
        st["current"] = "ship"
        with open(self.state_path(), "w", encoding="utf-8") as f:
            json.dump(st, f)
        s = self.call("GET", "/live/state.json")[1]
        self.assertEqual(s["broken"]["kind"], "tampered")
        self.assertTrue(s["control"]["enabled"])
        self.assertTrue(self.call("POST", "/live/api/state_restore")[1]["ok"])
        s = self.call("GET", "/live/state.json")[1]
        self.assertNotIn("broken", s)
        self.assertEqual(s["current"], "research")

    def test_the_page_can_draw_the_banner_and_the_confirm_button(self):
        with open(os.path.join(ROOT, "site", "live", "live.js"), encoding="utf-8") as f:
            js = f.read()
        for needle in ("state.broken", '"state_accept"', '"state_restore"', '"confirm"', "waiting for your confirmation"):
            self.assertIn(needle, js)


def _free_port():
    import socket
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


if __name__ == "__main__":
    unittest.main()
