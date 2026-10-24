import json
import os
import subprocess
import sys
import tempfile
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPTS = os.path.join(ROOT, "scripts")
sys.path.insert(0, SCRIPTS)
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _auth import confirm_items, seed_docs  # noqa: E402
import hs_activity as activity  # noqa: E402

TRACKER = os.path.join(SCRIPTS, "hyperskill.py")
HOOK = os.path.join(SCRIPTS, "hs_hook.py")


def run(project, *args):
    return subprocess.run([sys.executable, TRACKER, "--root", project, *args], capture_output=True, text=True)


def events(project):
    out, _ = activity.read_events(project)
    return out


class RedactionTests(unittest.TestCase):
    def test_secret_shapes_are_masked(self):
        cases = [
            "OPERATOR_TOKEN=abc123secret node server.js",
            "export API_KEY='sk-live-123456'",
            "curl -H 'Authorization: Bearer abcdefghijklmnop' https://x",
            "git clone https://user:hunter2@github.com/a/b",
            "ghp_" + "a" * 30,
            "AKIA" + "A" * 16,
            "password: s3cret-value",
            "deadbeef" * 8,
            "-----BEGIN RSA PRIVATE KEY-----",
        ]
        for c in cases:
            out = activity.redact(c)
            for secret in ("abc123secret", "sk-live-123456", "abcdefghijklmnop", "hunter2", "a" * 30, "s3cret-value", "deadbeef" * 2, "RSA PRIVATE"):
                self.assertNotIn(secret, out, c)
            self.assertIn("***", out, c)

    def test_ordinary_text_is_kept_and_long_text_is_cut(self):
        self.assertEqual(activity.redact("node --test tests/core.test.js"), "node --test tests/core.test.js")
        self.assertEqual(activity.redact("a\n\n  b\tc"), "a b c")
        out = activity.redact("word " * 400, 50)
        self.assertEqual(len(out), 50)
        self.assertTrue(out.endswith("…"))
        self.assertEqual(activity.redact(None), "")


class LogTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.p = self.tmp.name

    def tearDown(self):
        self.tmp.cleanup()

    def test_append_is_private_ignored_by_git_and_redacted(self):
        self.assertTrue(activity.append(self.p, "note", "token=abc12345 here", extra="Bearer abcdefghijklmnop"))
        path = activity.log_path(self.p)
        self.assertEqual(os.stat(path).st_mode & 0o077, 0)
        with open(os.path.join(self.p, ".hyperskill", ".gitignore")) as f:
            self.assertIn("activity.jsonl", f.read())
        with open(path) as f:
            raw = f.read()
        self.assertNotIn("abc12345", raw)
        self.assertNotIn("abcdefghijklmnop", raw)
        e = events(self.p)[0]
        self.assertEqual((e["type"], "ts" in e), ("note", True))

    def test_partial_last_line_waits_and_corrupt_lines_are_skipped(self):
        activity.append(self.p, "note", "one")
        path = activity.log_path(self.p)
        with open(path, "a") as f:
            f.write("not json\n")
            f.write('{"ts":"2026-01-01T00:00:00Z","type":"note","text":"half')
        evs, off = activity.read_events(self.p)
        self.assertEqual([e["text"] for e in evs], ["one"])
        with open(path, "a") as f:
            f.write('"}\n')
        evs2, _ = activity.read_events(self.p, off)
        self.assertEqual([e["text"] for e in evs2], ["half"])

    def test_offset_past_the_end_restarts_and_limit_keeps_the_newest(self):
        for i in range(5):
            activity.append(self.p, "note", "n%d" % i)
        evs, _ = activity.read_events(self.p, 10**9)
        self.assertEqual(len(evs), 5)
        evs, _ = activity.read_events(self.p, 0, limit=2)
        self.assertEqual([e["text"] for e in evs], ["n3", "n4"])

    def test_log_rotates_when_it_gets_large(self):
        old = activity.MAX_BYTES
        activity.MAX_BYTES = 200
        try:
            for i in range(20):
                activity.append(self.p, "note", "line %d " % i + "x" * 30)
        finally:
            activity.MAX_BYTES = old
        self.assertTrue(os.path.exists(os.path.join(self.p, ".hyperskill", "activity.1.jsonl")))

    def test_writing_failure_returns_false_and_does_not_raise(self):
        os.makedirs(os.path.join(self.p, ".hyperskill", "activity.jsonl"))  # a directory where the file should be
        self.assertFalse(activity.append(self.p, "note", "x"))

    def test_find_root_walks_up(self):
        os.makedirs(os.path.join(self.p, ".hyperskill"))
        with open(os.path.join(self.p, ".hyperskill", "state.json"), "w") as f:
            f.write("{}")
        deep = os.path.join(self.p, "a", "b")
        os.makedirs(deep)
        self.assertEqual(activity.find_root(deep), os.path.abspath(self.p))
        with tempfile.TemporaryDirectory() as other:
            self.assertIsNone(activity.find_root(other))


class TestSummaryTests(unittest.TestCase):
    def test_runners(self):
        self.assertEqual(activity.parse_test_summary("# tests 39\n# suites 0\n# pass 38\n# fail 1\n# cancelled 0\n# skipped 2\n"),
                         {"runner": "node:test", "passed": 38, "failed": 1, "skipped": 2, "total": 39})
        self.assertEqual(activity.parse_test_summary("..\nRan 54 tests in 6.8s\n\nOK\n")["passed"], 54)
        u = activity.parse_test_summary("Ran 10 tests in 1s\n\nFAILED (failures=2, errors=1)\n")
        self.assertEqual((u["passed"], u["failed"]), (7, 3))
        for line in ("=== 1 failed, 3 passed in 0.12s ===", "=== 3 passed, 1 failed in 0.12s ===", "1 failed, 3 passed in 0.12s"):
            p = activity.parse_test_summary(line)
            self.assertEqual((p["runner"], p["passed"], p["failed"]), ("pytest", 3, 1), line)
        self.assertEqual(activity.parse_test_summary("=== 4 passed, 1 skipped in 2s ===")["skipped"], 1)
        j = activity.parse_test_summary("Tests:       1 failed, 5 passed, 6 total\n")
        self.assertEqual((j["runner"], j["passed"], j["failed"], j["total"]), ("jest", 5, 1, 6))

    def test_filtered_node_output_with_only_pass_and_fail_lines_still_counts(self):
        r = activity.parse_test_summary("# pass 4\n# fail 0\n")
        self.assertEqual((r["passed"], r["failed"], r["total"]), (4, 0, 4))
        r = activity.parse_test_summary("# pass 2\n# fail 1\n# skipped 1\n")
        self.assertEqual((r["passed"], r["failed"], r["total"]), (2, 1, 4))

    def test_non_test_output_is_not_a_test(self):
        for text in ["", None, "hello world", "# pass the salt", "Ran out of memory"]:
            self.assertIsNone(activity.parse_test_summary(text), text)


class TrackerLogsItsActionsTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.p = self.tmp.name
        self.assertEqual(run(self.p, "init", "--name", "demo", "--tenancy", "user").returncode, 0)
        seed_docs(self.p)

    def tearDown(self):
        self.tmp.cleanup()

    def types(self):
        return [e["type"] for e in events(self.p)]

    def test_init_config_decide_log_and_event_are_recorded(self):
        run(self.p, "config", "--unavailable", "host")
        run(self.p, "decide", "--title", "Pick Node", "--choice", "Node 22", "--why", "known")
        run(self.p, "log", "a note")
        r = run(self.p, "event", "Writing the form", "--kind", "building")
        self.assertEqual(r.returncode, 0)
        self.assertEqual(self.types(), ["init", "config", "decision", "note", "progress"])
        last = events(self.p)[-1]
        self.assertEqual((last["text"], last["kind"], last["phase"]), ("Writing the form", "building", "research"))
        self.assertEqual(events(self.p)[2]["n"], 1)

    def test_a_passing_command_records_the_check_and_its_test_counts(self):
        cmd = "python3 -c \"print('# tests 5'); print('# pass 5'); print('# fail 0')\""
        self.assertEqual(run(self.p, "gate", "research", "--run", "problem-statement", "--cmd", cmd).returncode, 0)
        evs = events(self.p)
        test = next(e for e in evs if e["type"] == "test")
        self.assertEqual((test["passed"], test["failed"], test["item"]), (5, 0, "problem-statement"))
        gp = next(e for e in evs if e["type"] == "gate_pass")
        self.assertTrue(gp["ran"])
        self.assertIn("Problem, target user", gp["label"])

    def test_a_failing_command_records_a_failed_check(self):
        r = run(self.p, "gate", "research", "--run", "problem-statement", "--cmd", "python3 -c \"print('# tests 3'); print('# pass 2'); print('# fail 1'); raise SystemExit(1)\"")
        self.assertNotEqual(r.returncode, 0)
        evs = events(self.p)
        self.assertIn("check_failed", [e["type"] for e in evs])
        self.assertEqual(next(e for e in evs if e["type"] == "test")["failed"], 1)
        self.assertNotIn("gate_pass", [e["type"] for e in evs])

    def test_pass_waive_and_waive_unavailable_are_recorded_with_their_text(self):
        run(self.p, "gate", "research", "--pass", "risks-listed", "--evidence", "docs/research.md section 6: 5 risks")
        run(self.p, "gate", "research", "--waive", "user-evidence", "--reason", "no users yet")
        run(self.p, "config", "--unavailable", "human")
        run(self.p, "gate", "research", "--waive-unavailable")
        evs = events(self.p)
        self.assertEqual([e["item"] for e in evs if e["type"] == "gate_pass"], ["risks-listed"])
        waived = [e["item"] for e in evs if e["type"] == "gate_waive"]
        self.assertIn("user-evidence", waived)
        self.assertIn("go-no-go", waived)
        self.assertEqual(next(e for e in evs if e["type"] == "gate_waive")["reason"], "no users yet")

    def test_advance_refusal_and_success_are_recorded(self):
        self.assertNotEqual(run(self.p, "advance").returncode, 0)
        refused = events(self.p)[-1]
        self.assertEqual(refused["type"], "refused")
        self.assertIn("problem-statement", refused["open"])
        ids = "problem-statement,alternatives-mapped,user-evidence,risks-listed,go-no-go"
        confirm_items(self.p, "research")
        run(self.p, "gate", "research", "--pass", ids, "--evidence", "docs/research.md section 1: all five")
        self.assertEqual(run(self.p, "advance").returncode, 0)
        adv = events(self.p)[-1]
        self.assertEqual((adv["type"], adv["to"]), ("advance", "plan"))

    def test_a_broken_log_never_breaks_a_command(self):
        os.remove(os.path.join(self.p, ".hyperskill", "activity.jsonl"))
        os.makedirs(os.path.join(self.p, ".hyperskill", "activity.jsonl"))
        self.assertEqual(run(self.p, "log", "still works").returncode, 0)
        self.assertEqual(run(self.p, "gate", "research", "--pass", "risks-listed", "--evidence", "docs/research.md section 6: 5 risks").returncode, 0)

    def test_secrets_in_evidence_are_masked_in_the_log_but_the_state_file_is_unchanged(self):
        run(self.p, "gate", "research", "--pass", "risks-listed", "--evidence", "docs/x.md: ran with OPERATOR_TOKEN=supersecret99 and 5 checks")
        with open(activity.log_path(self.p)) as f:
            self.assertNotIn("supersecret99", f.read())


class HookTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.p = os.path.realpath(self.tmp.name)
        run(self.p, "init", "--name", "demo")
        self.before = len(events(self.p))

    def tearDown(self):
        self.tmp.cleanup()

    def hook(self, payload, when="post", cwd=None, raw=None):
        return subprocess.run([sys.executable, HOOK, when], input=raw if raw is not None else json.dumps(payload),
                              capture_output=True, text=True, cwd=cwd or self.p)

    def new(self):
        return events(self.p)[self.before:]

    def test_a_written_file_is_recorded_with_a_relative_path_and_line_count(self):
        r = self.hook({"tool_name": "Write", "cwd": self.p, "tool_input": {"file_path": os.path.join(self.p, "src", "a.js"), "content": "a\nb\nc"}})
        self.assertEqual(r.returncode, 0)
        e = self.new()[0]
        self.assertEqual((e["type"], e["action"], e["path"], e["lines"]), ("file", "write", os.path.join("src", "a.js"), 3))

    def test_edit_and_multiedit_are_recorded_and_files_outside_the_project_are_reduced_to_a_name(self):
        self.hook({"tool_name": "Edit", "cwd": self.p, "tool_input": {"file_path": os.path.join(self.p, "b.js")}})
        self.hook({"tool_name": "MultiEdit", "cwd": self.p, "tool_input": {"file_path": os.path.join(self.p, "c.js"), "edits": [{}, {}]}})
        self.hook({"tool_name": "Write", "cwd": self.p, "tool_input": {"file_path": "/home/someone/secret-dir/notes.txt", "content": "x"}})
        evs = self.new()
        self.assertEqual([e["action"] for e in evs], ["edit", "edit", "write"])
        self.assertEqual(evs[1]["edits"], 2)
        self.assertNotIn("someone", json.dumps(evs[2]))
        self.assertIn("notes.txt", evs[2]["path"])

    def test_the_trackers_own_files_and_commands_are_not_logged_twice(self):
        self.hook({"tool_name": "Write", "cwd": self.p, "tool_input": {"file_path": os.path.join(self.p, ".hyperskill", "state.json"), "content": "{}"}})
        self.hook({"tool_name": "Bash", "cwd": self.p, "tool_input": {"command": "python3 /x/scripts/hyperskill.py gate research"}})
        self.assertEqual(self.new(), [])

    def test_a_command_is_recorded_with_secrets_masked_and_test_results_are_extracted(self):
        self.hook({"tool_name": "Bash", "cwd": self.p, "tool_input": {"command": "OPERATOR_TOKEN=abc12345678 node --test", "description": "run the tests"},
                   "tool_response": {"stdout": "# tests 12\n# pass 11\n# fail 1\n", "stderr": ""}})
        cmd, test = self.new()
        self.assertEqual(cmd["type"], "command")
        self.assertNotIn("abc12345678", json.dumps(self.new()))
        self.assertEqual((test["type"], test["passed"], test["failed"]), ("test", 11, 1))

    def test_a_failing_command_and_its_failing_tests_are_recorded_from_the_failure_event(self):
        self.hook({"tool_name": "Bash", "cwd": self.p, "tool_input": {"command": "node --test", "description": "run the tests"},
                   "error": "Exit code 1\n# tests 5\n# pass 4\n# fail 1\n"}, "fail")
        cmd, test = self.new()
        self.assertEqual((cmd["type"], cmd["ok"], cmd["exit"]), ("command", False, 1))
        self.assertEqual((test["type"], test["passed"], test["failed"]), ("test", 4, 1))

    def test_a_failing_command_without_test_output_is_still_shown_as_failed(self):
        self.hook({"tool_name": "Bash", "cwd": self.p, "tool_input": {"command": "false"}, "error": "Exit code 1"}, "fail")
        self.assertEqual([(e["type"], e["ok"]) for e in self.new()], [("command", False)])

    def test_failures_of_other_tools_and_of_the_tracker_are_ignored(self):
        self.hook({"tool_name": "Write", "cwd": self.p, "tool_input": {"file_path": os.path.join(self.p, "a")}, "error": "no"}, "fail")
        self.hook({"tool_name": "Bash", "cwd": self.p, "tool_input": {"command": "python3 /x/hyperskill.py advance"}, "error": "Exit code 1"}, "fail")
        self.assertEqual(self.new(), [])

    def test_a_successful_command_is_marked_ok(self):
        self.hook({"tool_name": "Bash", "cwd": self.p, "tool_input": {"command": "ls"}, "tool_response": "x"})
        self.assertIs(self.new()[0]["ok"], True)

    def test_the_project_folder_is_shown_as_a_dot_in_commands(self):
        self.hook({"tool_name": "Bash", "cwd": self.p, "tool_input": {"command": "cd %s && node --test" % self.p}, "tool_response": "ok"})
        text = self.new()[0]["text"]
        self.assertNotIn(self.p, text)
        self.assertTrue(text.startswith("cd . && node --test"), text)

    def test_a_command_without_test_output_records_only_the_command(self):
        self.hook({"tool_name": "Bash", "cwd": self.p, "tool_input": {"command": "ls"}, "tool_response": "file1\nfile2"})
        self.assertEqual([e["type"] for e in self.new()], ["command"])

    def test_helper_agents_are_recorded_when_they_start_and_finish(self):
        self.hook({"tool_name": "Agent", "cwd": self.p, "tool_input": {"description": "Research the market", "subagent_type": "general-purpose"}}, "pre")
        self.hook({"tool_name": "Agent", "cwd": self.p, "tool_input": {"description": "Research the market"}}, "post")
        a, b = self.new()
        self.assertEqual((a["state"], b["state"]), ("started", "finished"))
        self.assertIn("Research the market", a["text"])

    def test_it_does_nothing_outside_a_hyperskill_project_and_never_fails(self):
        with tempfile.TemporaryDirectory() as other:
            r = self.hook({"tool_name": "Write", "cwd": other, "tool_input": {"file_path": os.path.join(other, "x"), "content": "x"}}, cwd=other)
            self.assertEqual(r.returncode, 0)
            self.assertFalse(os.path.exists(os.path.join(other, ".hyperskill")))
        for raw in ["garbage", "", "[]", "null", '{"tool_name": 5, "tool_input": "x"}']:
            self.assertEqual(self.hook(None, raw=raw).returncode, 0, raw)
        self.assertEqual(self.new(), [])


if __name__ == "__main__":
    unittest.main()
