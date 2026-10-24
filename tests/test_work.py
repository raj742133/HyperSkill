import json
import os
import re
import sys
import threading
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from test_run import Base, EMPTY_HOME, ROOT, SCRIPTS, free_port, tracker  # noqa: E402

sys.path.insert(0, SCRIPTS)
import hs_live  # noqa: E402
import hs_work as W  # noqa: E402


def frontmatter(path):
    with open(path, encoding="utf-8") as f:
        text = f.read()
    block = re.match(r"^---\n(.*?)\n---\n", text, re.S).group(1)
    return dict(line.split(": ", 1) for line in block.split("\n") if ": " in line)


class ClassifyTests(unittest.TestCase):
    def test_the_same_task_always_lands_on_the_same_tier_and_says_why(self):
        table = [(("lookup", 1, "none", False), "scout"), (("edit", 1, "none", False), "fixer"), (("docs", 1, "none", False), "fixer"),
                 (("build", 2, "none", False), "builder"), (("build", 5, "none", False), "builder-deep"), (("refactor", 4, "none", False), "builder-deep"),
                 (("debug", 2, "none", True), "architect"), (("design", 1, "none", False), "architect"), (("review", 1, "none", False), "reviewer")]
        for args, want in table:
            tier, score, why = W.classify(*args)
            self.assertEqual(tier, want, args)
            self.assertTrue(why, args)
            self.assertEqual(W.classify(*args)[0], tier)

    def test_security_money_and_data_work_is_never_given_to_the_cheap_tiers(self):
        for risk in ("security", "money"):
            for bias in W.BIAS:
                for kind in ("edit", "build", "refactor"):
                    tier, _, _ = W.classify(kind, 1, risk, False, bias)
                    self.assertNotIn(tier, ("fixer", "builder", "scout"), (risk, bias, kind))
        self.assertNotEqual(W.classify("build", 1, "data", False, "economy")[0], "fixer")

    def test_bias_moves_one_tier_and_economy_never_applies_to_risky_work(self):
        self.assertEqual(W.classify("build", 2, "none", False, "economy")[0], "fixer")
        self.assertEqual(W.classify("build", 2, "none", False, "quality")[0], "builder-deep")
        self.assertEqual(W.classify("build", 1, "data", False, "economy")[0], W.classify("build", 1, "data", False, "balanced")[0])

    def test_unknown_values_are_refused(self):
        with self.assertRaises(W.WorkError):
            W.classify("wizardry")
        with self.assertRaises(W.WorkError):
            W.classify("build", 1, "extreme")


class TaskTests(unittest.TestCase):
    def setUp(self):
        self.st = {}

    def add(self, title, kind="build", **kw):
        return W.add(self.st, "product", title, kind, **kw)

    def test_helpers_that_edit_the_same_files_never_share_a_wave(self):
        a, b, c = self.add("a", paths="src/a.js"), self.add("b", paths="src/a.js"), self.add("c", paths="src/c.js")
        waves, left = W.plan(self.st, "product")
        self.assertEqual([[t["id"] for t in w] for w in waves], [[a["id"], c["id"]], [b["id"]]])
        self.assertEqual(left, [])

    def test_a_folder_overlaps_the_files_inside_it_and_a_task_without_paths_runs_alone(self):
        a, b = self.add("a", paths="src"), self.add("b", paths="src/x/y.js")
        self.assertEqual(len(W.plan(self.st, "product")[0]), 2)
        c = self.add("c")
        waves = W.plan(self.st, "product")[0]
        self.assertEqual([c["id"]], [t["id"] for t in waves[-1]])

    def test_readers_never_conflict_and_dependencies_wait(self):
        r1, r2 = self.add("find", "lookup"), self.add("find more", "lookup")
        w = self.add("write", paths="a", depends=r1["id"])
        waves = W.plan(self.st, "product")[0]
        self.assertEqual([[t["id"] for t in x] for x in waves], [[r1["id"], r2["id"]], [w["id"]]])

    def test_at_most_parallel_run_together_and_helpers_off_means_one_at_a_time(self):
        for i in range(5):
            self.add("t%d" % i, "lookup")
        W.set_policy(self.st, parallel=2)
        self.assertEqual([len(w) for w in W.plan(self.st, "product")[0]], [2, 2, 1])
        W.set_policy(self.st, helpers=False)
        self.assertEqual([len(w) for w in W.plan(self.st, "product")[0]], [1] * 5)

    def test_a_failed_task_moves_up_a_tier_and_a_failure_at_the_top_needs_a_person(self):
        t = self.add("x", "edit", paths="a")
        seen = [t["tier"]]
        for _ in range(6):
            W.start(self.st, t["id"])
            W.fail(self.st, t["id"], "tests red")
            seen.append(t["tier"])
            if t["status"] == "blocked":
                break
        self.assertEqual(seen[:5], ["fixer", "builder", "builder-deep", "architect", "architect"])
        self.assertEqual(t["status"], "blocked")
        self.assertIn(t["id"], W.open_tasks(self.st, "product"))
        with self.assertRaises(W.WorkError):
            W.start(self.st, t["id"])

    def test_done_needs_a_result_and_overriding_the_tier_needs_a_reason(self):
        t = self.add("x", paths="a")
        W.start(self.st, t["id"])
        with self.assertRaises(W.WorkError):
            W.finish(self.st, t["id"], "  ")
        W.finish(self.st, t["id"], "pytest: 12 passed")
        self.assertEqual(t["status"], "done")
        with self.assertRaises(W.WorkError):
            self.add("y", tier="architect")
        y = self.add("y", tier="architect", why="touches the billing model")
        self.assertEqual((y["tier"], y["suggested"]), ("architect", "builder"))
        self.assertIn("overridden", " ".join(y["reasons"]))

    def test_a_read_only_tier_cannot_be_given_writing_work_and_paths_cannot_escape(self):
        with self.assertRaises(W.WorkError):
            self.add("x", "build", tier="scout", why="cheap")
        for bad in ("../x", "/etc/passwd", ".git/config", ".hyperskill/state.json"):
            with self.assertRaises(W.WorkError, msg=bad):
                self.add("x", paths=bad)

    def test_a_dependency_must_exist(self):
        with self.assertRaises(W.WorkError):
            self.add("x", depends="T9")
        with self.assertRaises(W.WorkError):
            self.add("x", depends="../../x")


class AgentFileTests(unittest.TestCase):
    def test_every_tier_has_an_agent_file_whose_model_and_effort_match_the_table(self):
        for t in W.tiers().values():
            fm = frontmatter(os.path.join(ROOT, "agents", t["agent"] + ".md"))
            self.assertEqual(fm["name"], t["agent"])
            self.assertEqual((fm["model"], fm["effort"]), (t["model"], t["effort"]), t["id"])
            tools = {x.strip() for x in fm["tools"].split(",")}
            if not t["writes"]:
                self.assertFalse(tools & {"Edit", "Write"}, t["id"] + " is read-only")
            self.assertNotIn("Agent", tools, "helpers do not spawn more helpers")

    def test_the_cheap_tiers_are_haiku_low_and_coding_is_sonnet_with_more_than_one_effort(self):
        tr = W.tiers()
        self.assertEqual([(tr[i]["model"], tr[i]["effort"]) for i in ("scout", "fixer")], [("haiku", "low")] * 2)
        self.assertEqual({tr[i]["effort"] for i in ("builder", "builder-deep") if tr[i]["model"] == "sonnet"}, {"medium", "high"})

    def test_the_conductor_skill_teaches_the_loop_and_every_agent_name(self):
        with open(os.path.join(ROOT, "skills", "hyperskill", "SKILL.md"), encoding="utf-8") as f:
            text = f.read()
        for t in W.tiers().values():
            self.assertIn(t["agent"], text)
        for cmd in ("work add", "work plan", "work done", "work fail"):
            self.assertIn(cmd, text)


class TrackerTests(Base):
    def test_advance_is_refused_while_helper_tasks_are_open(self):
        tracker(self.p, "work", "add", "fix the thing", "--kind", "edit", "--paths", "a.js")
        r = tracker(self.p, "advance", check=False)
        self.assertNotEqual(r.returncode, 0)
        out = r.stdout + r.stderr
        self.assertTrue("helper tasks" in out or "gate not clear" in out)
        tracker(self.p, "work", "drop", "T1", "--why", "not needed")
        self.assertEqual(tracker(self.p, "work", "list").stdout.split()[1], "dropped")

    def test_the_cli_prints_the_tier_the_reason_and_the_waves(self):
        out = tracker(self.p, "work", "add", "pricing", "--kind", "build", "--paths", "p.js", "--risk", "security").stdout
        self.assertIn("Deep builder (sonnet, high)", out)
        self.assertIn("security risk", out)
        plan = tracker(self.p, "work", "plan").stdout
        self.assertIn("hs-builder-deep", plan)
        self.assertIn("wave 1", plan)


class DashboardTests(Base):
    def setUp(self):
        super().setUp()
        self._home = os.environ.get("HOME")
        os.environ["HOME"] = EMPTY_HOME
        self.addCleanup(lambda: os.environ.__setitem__("HOME", self._home) if self._home is not None else os.environ.pop("HOME", None))
        self.server, self.port = hs_live.make_server(self.p, free_port(), controls=True, allow_run=True)
        threading.Thread(target=self.server.serve_forever, daemon=True).start()
        self.addCleanup(lambda: (self.server.runner.stop(), self.server.shutdown(), self.server.server_close()))

    def call(self, method, path, body=None):
        import http.client
        c = http.client.HTTPConnection("127.0.0.1", self.port, timeout=20)
        c.request(method, path, body=json.dumps(body) if body is not None else None, headers={"Content-Type": "application/json", "X-HS-Token": self.server.token})
        r = c.getresponse()
        data = json.loads(r.read())
        c.close()
        return r.status, data

    def run_and_args(self, body):
        import time
        if os.path.exists(self.log):
            os.remove(self.log)
        s, d = self.call("POST", "/live/api/run_start", dict({"text": "go", "mode": "edits"}, **body))
        self.assertEqual(s, 200, d)
        end = time.time() + 15
        while time.time() < end and not (os.path.exists(self.log) and not self.call("GET", "/live/state.json")[1]["run"]["running"]):
            time.sleep(0.1)
        return self.calls()[0]["args"]

    def test_helpers_are_allowed_by_default_and_not_at_all_when_off(self):
        self.assertIn("Agent", self.run_and_args({}))
        self.call("POST", "/live/api/run_new", {})
        a = self.run_and_args({"helpers": "off"})
        self.assertNotIn("Agent", a)
        self.assertFalse(self.call("GET", "/live/state.json")[1]["work"]["policy"]["helpers"])

    def test_always_split_tells_claude_to_use_helpers_even_for_a_narrow_request(self):
        a = self.run_and_args({"helpers": "split"})
        prompt = a[a.index("-p") + 1]
        self.assertIn("asked for helper agents", prompt)
        self.assertIn("Agent", a)
        self.call("POST", "/live/api/run_new", {})
        self.assertNotIn("asked for helper agents", self.run_and_args({"helpers": "auto"})[a.index("-p") + 1])

    def test_the_choice_of_cheaper_or_stronger_is_stored_and_a_bad_one_is_refused(self):
        self.run_and_args({"helpers": "economy"})
        self.assertEqual(self.call("GET", "/live/state.json")[1]["work"]["policy"]["bias"], "economy")
        self.assertEqual(self.call("POST", "/live/api/run_start", {"text": "x", "mode": "edits", "helpers": "yolo"})[0], 400)

    def test_the_board_shows_tasks_with_their_wave_and_the_user_can_drop_one_or_change_the_limit(self):
        tracker(self.p, "work", "add", "a", "--kind", "edit", "--paths", "a")
        tracker(self.p, "work", "add", "b", "--kind", "edit", "--paths", "a")
        w = self.call("GET", "/live/state.json")[1]["work"]
        self.assertEqual([(t["id"], t["wave"], t["agent"]) for t in w["tasks"]], [("T1", 1, "hs-fixer"), ("T2", 2, "hs-fixer")])
        self.assertEqual(self.call("POST", "/live/api/work_drop", {"id": "T2", "why": "x"})[0], 200)
        self.assertEqual(self.call("POST", "/live/api/work_drop", {"id": "../x"})[0], 400)
        self.assertEqual(self.call("POST", "/live/api/work_policy", {"parallel": 5})[0], 200)
        self.assertFalse(self.call("POST", "/live/api/work_policy", {"parallel": 99})[1]["ok"])
        w = self.call("GET", "/live/state.json")[1]["work"]
        self.assertEqual((w["policy"]["parallel"], w["tasks"][1]["status"]), (5, "dropped"))

    def test_the_page_has_the_helper_controls_and_board(self):
        base = os.path.join(ROOT, "site", "live")
        with open(os.path.join(base, "index.html"), encoding="utf-8") as f:
            html = f.read()
        for ident in ("chat-helpers", "wk-list", "wk-tiers", "wk-par"):
            self.assertIn('id="%s"' % ident, html)


class TuneAndStatsTests(unittest.TestCase):
    def test_tuning_changes_one_project_and_reset_restores_the_defaults(self):
        st = {}
        self.assertEqual(W.add(st, "p", "x", "build", "a")["tier"], "builder")
        W.tune(st, "build", 3)
        self.assertEqual(W.add(st, "p", "y", "build", "b")["tier"], "builder-deep")
        W.tune(st, plus="unknown", value=0)
        self.assertEqual(W.add(st, "p", "z", "debug", "c", unknown=True)["score"], 3)
        W.tune(st, reset=True)
        self.assertEqual(W.rules(st), W.models()["rules"])
        with self.assertRaises(W.WorkError):
            W.tune(st, "lookup", 2)
        with self.assertRaises(W.WorkError):
            W.tune(st, "build", 9)
        with self.assertRaises(W.WorkError):
            W.tune(st, plus="vibes", value=1)

    def test_stats_count_first_time_successes_and_failures_and_advise_only_with_enough_data(self):
        st = {}
        for i in range(5):
            t = W.add(st, "p", "t%d" % i, "build", "f%d" % i)
            W.start(st, t["id"])
            if i < 3:
                W.fail(st, t["id"], "red")
                W.start(st, t["id"])
            W.finish(st, t["id"], "tests pass: %d" % i)
        rows, advice = W.stats(st)
        by = {r["tier"]: r for r in rows}
        self.assertEqual((by["builder"]["failed"], by["builder"]["done"], by["builder"]["first_try"]), (3, 2, 2))
        self.assertEqual((by["builder-deep"]["done"], by["builder-deep"]["first_try"]), (3, 0))
        self.assertEqual(len(advice), 1)
        self.assertIn("Builder got only 40%", advice[0])
        for i in range(4):
            t = W.add(st, "p", "more%d" % i, "build", "g%d" % i)
            W.start(st, t["id"])
            W.fail(st, t["id"], "red")
        self.assertIn("Builder got only 22%", W.stats(st)[1][0])
        self.assertEqual(W.stats({"work": {"seq": 0, "tasks": [], "policy": {}}})[1], [])
        self.assertEqual(W.stats({})[1], [], "no data, no advice")


class LockAndHookTests(Base):
    def test_many_tracker_calls_at_once_all_land_and_ids_stay_unique(self):
        import subprocess
        from test_run import TRACKER
        procs = [subprocess.Popen([sys.executable, TRACKER, "--root", self.p, "work", "add", "t%d" % i, "--kind", "lookup"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                                  env=dict(os.environ, HOME=EMPTY_HOME)) for i in range(12)]
        for pr in procs:
            self.assertEqual(pr.wait(), 0)
        with open(os.path.join(self.p, ".hyperskill", "state.json"), encoding="utf-8") as f:
            ids = [t["id"] for t in json.load(f)["work"]["tasks"]]
        self.assertEqual(sorted(ids, key=lambda x: int(x[1:])), ["T%d" % i for i in range(1, 13)])

    def hook(self, when, payload):
        import subprocess
        r = subprocess.run([sys.executable, os.path.join(SCRIPTS, "hs_hook.py"), when], input=json.dumps(dict(payload, cwd=self.p)), capture_output=True, text=True,
                           env=dict(os.environ, HOME=EMPTY_HOME, HYPERSKILL_NO_AUTOSTART="1"))
        self.assertEqual(r.returncode, 0, r.stderr)
        return r.stdout

    def status(self, tid):
        with open(os.path.join(self.p, ".hyperskill", "state.json"), encoding="utf-8") as f:
            st = json.load(f)
        return next(t for t in st["work"]["tasks"] if t["id"] == tid)["status"]

    def test_a_helper_dispatched_with_a_task_id_marks_the_task_running_when_it_starts(self):
        tracker(self.p, "work", "add", "x", "--kind", "edit", "--paths", "a")
        tracker(self.p, "work", "add", "y", "--kind", "edit", "--paths", "b")
        self.hook("pre", {"tool_name": "Agent", "tool_input": {"description": "T1: change the label", "subagent_type": "hyperskill:hs-fixer"}})
        self.assertEqual((self.status("T1"), self.status("T2")), ("running", "todo"))
        self.hook("pre", {"tool_name": "Agent", "tool_input": {"description": "T2: other", "subagent_type": "general-purpose"}})
        self.assertEqual(self.status("T2"), "todo", "only HyperSkill helpers start tasks")
        self.hook("pre", {"tool_name": "Agent", "tool_input": {"description": "no id here", "subagent_type": "hs-fixer"}})

    def test_when_a_helper_returns_the_conductor_is_told_to_verify_before_recording(self):
        out = json.loads(self.hook("post", {"tool_name": "Agent", "tool_input": {"description": "T4: x", "subagent_type": "hs-builder"}, "tool_response": "done"}))
        text = out["hookSpecificOutput"]["additionalContext"]
        self.assertIn("T4", text)
        self.assertIn("work done T4", text)
        self.assertIn("claim", text)

    def test_a_long_run_of_edits_with_no_tasks_gets_one_reminder_and_never_a_second(self):
        outs = []
        for i in range(12):
            outs.append(self.hook("post", {"tool_name": "Write", "tool_input": {"file_path": os.path.join(self.p, "f%d.js" % i), "content": "x"}, "tool_response": "ok"}))
        nudges = [o for o in outs if "no helper tasks" in o]
        self.assertEqual(len(nudges), 1)
        self.assertEqual(outs.index(nudges[0]), 7)

    def test_the_reminder_is_off_when_helpers_are_off_or_tasks_exist(self):
        tracker(self.p, "work", "policy", "--helpers", "off")
        outs = [self.hook("post", {"tool_name": "Edit", "tool_input": {"file_path": os.path.join(self.p, "a.js")}, "tool_response": "ok"}) for _ in range(10)]
        self.assertFalse(any("helper tasks" in o for o in outs))

    def test_a_new_session_is_handed_the_open_tasks_and_the_next_wave(self):
        tracker(self.p, "work", "add", "build it", "--kind", "build", "--paths", "src")
        out = json.loads(self.hook("start", {}))["hookSpecificOutput"]["additionalContext"]
        self.assertIn("helper tasks open", out)
        self.assertIn("T1", out)
        self.assertIn("wave 1", out)


class TestsModeTests(unittest.TestCase):
    def cmd(self, mode):
        import hs_run
        return hs_run.build_command("/tmp/x", "hi", mode, 1.0, None)

    def tools(self, mode):
        a = self.cmd(mode)
        return a[a.index("--allowedTools") + 1:]

    def test_tests_mode_adds_the_usual_test_commands_and_nothing_else_in_the_shell(self):
        edits, tests, build = self.tools("edits"), self.tools("tests"), self.tools("build")
        self.assertNotIn("Bash(npm test:*)", edits)
        self.assertIn("Bash(npm test:*)", tests)
        self.assertIn("Bash(python3 -m pytest:*)", tests)
        self.assertNotIn("Bash", tests)
        self.assertNotIn("Bash(curl:*)", tests)
        self.assertIn("Bash", build)
        self.assertTrue(any(t.startswith("Bash(python3 ") and "hyperskill.py" in t for t in tests))

    def test_tests_mode_is_offered_in_the_page_and_the_server_accepts_it(self):
        with open(os.path.join(ROOT, "site", "live", "index.html"), encoding="utf-8") as f:
            self.assertIn('<option value="tests">', f.read())
        import hs_run
        self.assertEqual(hs_run.MODES, ("edits", "tests", "build"))


if __name__ == "__main__":
    unittest.main()
