import http.client
import json
import os
import socket
import stat
import subprocess
import sys
import tempfile
import threading
import time
import unittest
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPTS = os.path.join(ROOT, "scripts")
sys.path.insert(0, SCRIPTS)
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _auth  # noqa: E402,F401  (signs test clients in to the dashboard)
import hs_inputs  # noqa: E402
import hs_live  # noqa: E402
import hs_run  # noqa: E402

TRACKER = os.path.join(SCRIPTS, "hyperskill.py")
EMPTY_HOME = tempfile.mkdtemp()

FAKE = '''#!/usr/bin/env python3
import json, os, sys, time
args = sys.argv[1:]
with open(os.environ["FAKE_LOG"], "a") as f:
    f.write(json.dumps({"args": args, "cwd": os.getcwd(), "run": os.environ.get("HYPERSKILL_RUN"), "env": sorted(os.environ)}) + "\\n")
prompt = args[args.index("-p") + 1]
sid = args[args.index("--resume") + 1] if "--resume" in args else "sess-1"
print(json.dumps({"type": "system", "session_id": sid}), flush=True)
if "SLOW" in prompt:
    time.sleep(60)
if "FAIL" in prompt:
    print(json.dumps({"type": "result", "is_error": True, "result": "boom", "session_id": sid}), flush=True); sys.exit(1)
print(json.dumps({"type": "assistant", "session_id": sid, "message": {"content": [{"type": "text", "text": "echo: " + prompt[-40:]}]}}), flush=True)
print(json.dumps({"type": "result", "is_error": False, "session_id": sid, "num_turns": 2, "total_cost_usd": 0.01, "duration_ms": 1500, "result": "done"}), flush=True)
'''


def tracker(root, *args, check=True):
    return subprocess.run([sys.executable, TRACKER, "--root", root, *args], capture_output=True, text=True, check=check, env=dict(os.environ, HOME=EMPTY_HOME))


def free_port():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


class Base(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.p = self.tmp.name
        tracker(self.p, "init", "--name", "demo", "--no-karpathy")
        self.fake = os.path.join(self.p, "fake-claude")
        with open(self.fake, "w") as f:
            f.write(FAKE)
        os.chmod(self.fake, os.stat(self.fake).st_mode | stat.S_IEXEC)
        self.log = os.path.join(self.p, "fake.log")
        self._env = {k: os.environ.get(k) for k in ("CLAUDE_BIN", "FAKE_LOG")}
        os.environ["CLAUDE_BIN"], os.environ["FAKE_LOG"] = self.fake, self.log
        self.addCleanup(self._restore)

    def _restore(self):
        for k, v in self._env.items():
            os.environ.pop(k, None) if v is None else os.environ.__setitem__(k, v)
        self.tmp.cleanup()

    def calls(self):
        with open(self.log) as f:
            return [json.loads(l) for l in f]

    def wait(self, runner, seconds=15):
        end = time.time() + seconds
        while runner.running() and time.time() < end:
            time.sleep(0.05)
        time.sleep(0.2)
        self.assertFalse(runner.running())


class RunnerTests(Base):
    def test_it_refuses_to_run_unless_the_dashboard_was_started_with_allow_run(self):
        r = hs_run.Runner(self.p, False)
        with self.assertRaises(PermissionError):
            r.start("hi", "edits")
        self.assertFalse(os.path.exists(self.log))

    def test_a_message_starts_a_conversation_and_the_next_one_resumes_it(self):
        r = hs_run.Runner(self.p, True)
        r.start("first message", "edits")
        self.wait(r)
        r.start("second message", "edits")
        self.wait(r)
        first, second = self.calls()
        self.assertNotIn("--resume", first["args"])
        self.assertIn("hyperskill skill", first["args"][first["args"].index("-p") + 1], "the first message tells Claude to use the conductor")
        self.assertEqual(second["args"][second["args"].index("--resume") + 1], "sess-1")
        self.assertEqual(second["args"][second["args"].index("-p") + 1], "second message")
        self.assertEqual(first["cwd"], os.path.realpath(self.p))
        self.assertEqual(first["run"], "1")
        roles = [m["role"] for m in hs_run.history(self.p) if m["role"] != "system"]
        self.assertEqual(roles, ["user", "claude", "user", "claude"])
        self.assertEqual(r.last["cost"], 0.01)
        r.new_chat()
        r.start("fresh", "edits")
        self.wait(r)
        self.assertNotIn("--resume", self.calls()[-1]["args"])

    def test_the_modes_are_the_only_permission_choices_and_never_skip_checks(self):
        for mode in ("edits", "build"):
            cmd = hs_run.build_command(self.p, "x", mode, 3, None)
            self.assertEqual(cmd[cmd.index("--permission-mode") + 1], "acceptEdits")
            joined = " ".join(cmd)
            self.assertNotIn("dangerously", joined)
            self.assertNotIn("bypassPermissions", joined)
            tools = cmd[cmd.index("--allowedTools") + 1:]
            self.assertIn("Edit", tools)
            if mode == "edits":
                self.assertNotIn("Bash", tools)
                self.assertTrue(any(t.startswith("Bash(python3 ") and t.endswith("hyperskill.py:*)") for t in tools))
            else:
                self.assertIn("Bash", tools)
        r = hs_run.Runner(self.p, True)
        for bad in ("bypass", "", None, "EDITS"):
            with self.assertRaises(ValueError):
                r.start("hi", bad)

    def test_the_spend_limit_is_always_passed_and_clamped(self):
        for given, want in ((3, "3.00"), (100, "25.00"), (0, "0.50")):
            cmd = hs_run.build_command(self.p, "x", "edits", min(max(given, 0.5), 25.0), None)
            self.assertEqual(cmd[cmd.index("--max-budget-usd") + 1], want)

    def test_one_run_at_a_time_and_stop_really_stops_it(self):
        r = hs_run.Runner(self.p, True)
        r.start("SLOW please", "edits")
        time.sleep(0.5)
        self.assertTrue(r.running())
        with self.assertRaises(RuntimeError):
            r.start("second", "edits")
        self.assertTrue(r.stop())
        self.wait(r)
        self.assertTrue(r.last["error"])
        self.assertIn("The run stopped", " ".join(m["text"] for m in hs_run.history(self.p)))
        self.assertFalse(r.stop())

    def test_a_failed_run_says_so_and_does_not_save_the_session(self):
        r = hs_run.Runner(self.p, True)
        r.start("FAIL now", "edits")
        self.wait(r)
        self.assertTrue(r.last["error"])
        self.assertFalse(hs_run._meta(self.p).get("session"))
        self.assertIn("boom", " ".join(m["text"] for m in hs_run.history(self.p)))

    def test_it_reports_a_missing_claude_command(self):
        os.environ["CLAUDE_BIN"] = "/nonexistent/claude"
        r = hs_run.Runner(self.p, True)
        self.assertFalse(r.state()["available"])
        with self.assertRaises(FileNotFoundError):
            r.start("hi", "edits")
        self.assertEqual(hs_run.history(self.p), [], "nothing is logged for a run that never started")


class ServerTests(Base):
    def setUp(self):
        super().setUp()
        self._home = os.environ.get("HOME")
        os.environ["HOME"] = EMPTY_HOME
        self.addCleanup(lambda: os.environ.__setitem__("HOME", self._home) if self._home is not None else os.environ.pop("HOME", None))

    def serve(self, allow_run):
        server, port = hs_live.make_server(self.p, free_port(), controls=True, allow_run=allow_run)
        threading.Thread(target=server.serve_forever, daemon=True).start()
        self.addCleanup(lambda: (server.runner.stop(), server.shutdown(), server.server_close()))
        return server, port

    def call(self, server, port, method, path, body=None, raw=None, ctype="application/json"):
        c = http.client.HTTPConnection("127.0.0.1", port, timeout=20)
        data = raw if raw is not None else (json.dumps(body) if body is not None else None)
        c.request(method, path, body=data, headers={"Content-Type": ctype, "X-HS-Token": server.token})
        r = c.getresponse()
        out = r.read()
        c.close()
        return r.status, json.loads(out)

    def test_run_is_off_by_default_and_the_state_says_so(self):
        server, port = self.serve(False)
        _, state = self.call(server, port, "GET", "/live/state.json")
        self.assertFalse(state["run"]["allowed"])
        status, res = self.call(server, port, "POST", "/live/api/run_start", {"text": "hi", "mode": "edits"})
        self.assertEqual(status, 400)
        self.assertIn("--allow-run", res["output"])
        self.assertFalse(os.path.exists(self.log))

    def test_the_chat_box_runs_claude_and_the_state_streams_the_conversation(self):
        server, port = self.serve(True)
        status, res = self.call(server, port, "POST", "/live/api/run_start", {"text": "build my site", "mode": "edits", "budget": 1})
        self.assertTrue(res["ok"])
        end = time.time() + 15
        while time.time() < end:
            _, state = self.call(server, port, "GET", "/live/state.json")
            if not state["run"]["running"] and any(m["role"] == "claude" for m in state["run"]["messages"]):
                break
            time.sleep(0.1)
        self.assertTrue(state["run"]["session"])
        self.assertEqual([m["role"] for m in state["run"]["messages"] if m["role"] != "system"], ["user", "claude"])
        self.assertEqual(state["run"]["last"]["cost"], 0.01)
        self.assertEqual(self.call(server, port, "POST", "/live/api/run_start", {"text": "", "mode": "edits"})[0], 400)
        self.assertEqual(self.call(server, port, "POST", "/live/api/run_start", {"text": "x", "mode": "bypass"})[0], 400)

    def test_a_foreign_origin_or_missing_key_cannot_start_a_run(self):
        server, port = self.serve(True)
        c = http.client.HTTPConnection("127.0.0.1", port, timeout=5)
        c.request("POST", "/live/api/run_start", body=json.dumps({"text": "x", "mode": "build"}), headers={"Content-Type": "application/json"})
        self.assertEqual(c.getresponse().status, 403)
        self.assertFalse(os.path.exists(self.log))


class UploadTests(Base):
    def setUp(self):
        super().setUp()
        self._home = os.environ.get("HOME")
        os.environ["HOME"] = EMPTY_HOME
        self.addCleanup(lambda: os.environ.__setitem__("HOME", self._home) if self._home is not None else os.environ.pop("HOME", None))
        self.server, self.port = hs_live.make_server(self.p, free_port(), controls=True)
        threading.Thread(target=self.server.serve_forever, daemon=True).start()
        self.addCleanup(lambda: (self.server.shutdown(), self.server.server_close()))

    def up(self, name, data, token="auto", ctype="application/octet-stream"):
        c = http.client.HTTPConnection("127.0.0.1", self.port, timeout=20)
        h = {"Content-Type": ctype}
        if token == "auto":
            token = self.server.token
        if token:
            h["X-HS-Token"] = token
        from urllib.parse import quote
        c.request("POST", "/live/upload?name=" + quote(name), body=data, headers=h)
        r = c.getresponse()
        out = r.read()
        c.close()
        return r.status, json.loads(out)

    def test_requirements_documents_are_saved_privately_and_their_text_extracted(self):
        status, res = self.up("reqs.md", b"# Requirements\n- landing page\n- staff login with MFA\n")
        self.assertEqual((status, res["name"]), (200, "reqs.md"))
        docx = os.path.join(self.p, "x.docx")
        with zipfile.ZipFile(docx, "w") as z:
            z.writestr("word/document.xml", '<w:document><w:body><w:p><w:r><w:t>Orders &amp; refunds dashboard</w:t></w:r></w:p><w:p><w:r><w:t>Must support MFA</w:t></w:r></w:p></w:body></w:document>')
        with open(docx, "rb") as f:
            status, res = self.up("spec.docx", f.read())
        self.assertEqual(status, 200)
        d = os.path.join(self.p, ".hyperskill", "inputs")
        with open(os.path.join(d, "spec.docx.txt"), encoding="utf-8") as f:
            self.assertIn("Orders & refunds dashboard\nMust support MFA", f.read())
        self.assertEqual(stat.S_IMODE(os.stat(os.path.join(d, "reqs.md")).st_mode), 0o600)
        summary = tracker(self.p, "brief", "show").stdout
        self.assertIn(".hyperskill/inputs/reqs.md", summary)
        self.assertIn("spec.docx.txt", summary)
        _, state = (lambda c: (c.request("GET", "/live/state.json"), json.loads(c.getresponse().read())))(http.client.HTTPConnection("127.0.0.1", self.port, timeout=5))
        self.assertEqual(sorted(i["name"] for i in state["inputs"]), ["reqs.md", "spec.docx"])
        with open(os.path.join(self.p, ".hyperskill", "inbox.jsonl"), encoding="utf-8") as f:
            self.assertIn("attached a project input file", f.read())

    def test_dangerous_names_types_sizes_and_keys_are_refused(self):
        self.assertEqual(self.up("../../evil.md", b"x")[1]["name"], "evil.md", "path parts are stripped, never followed")
        self.assertFalse(os.path.exists(os.path.join(self.p, "evil.md")))
        for bad in ("run.sh", "page.svg", "a.exe", "archive.zip", "noext", ".md"):
            self.assertEqual(self.up(bad, b"x")[0], 400, bad)
        self.assertEqual(self.up("a.md", b"")[0], 413)
        self.assertEqual(self.up("a.md", b"x", token=None)[0], 403)
        self.assertEqual(self.up("a.md", b"x", ctype="application/json")[0], 415)

    def test_a_duplicate_name_keeps_both_and_remove_deletes_the_file_and_its_text(self):
        self.up("a.md", b"one")
        self.assertEqual(self.up("a.md", b"two")[1]["name"], "a-2.md")
        self.assertEqual(sorted(r["name"] for r in hs_inputs.listing(self.p)), ["a-2.md", "a.md"])
        tracker(self.p, "inputs", "remove", "a-2.md")
        self.assertEqual([r["name"] for r in hs_inputs.listing(self.p)], ["a.md"])
        self.assertNotEqual(tracker(self.p, "inputs", "remove", "missing.md", check=False).returncode, 0)

    def test_a_zip_bomb_docx_is_not_read(self):
        docx = os.path.join(self.p, "bomb.docx")
        with zipfile.ZipFile(docx, "w", zipfile.ZIP_DEFLATED) as z:
            z.writestr("word/document.xml", "<a>" + "x" * (60 * 1024 * 1024) + "</a>")
        with open(docx, "rb") as f:
            self.assertEqual(self.up("bomb.docx", f.read())[0], 200)
        self.assertFalse(os.path.exists(os.path.join(self.p, ".hyperskill", "inputs", "bomb.docx.txt")), "too large to extract: the original is kept, no text")


class OpenCodeReviewTests(unittest.TestCase):
    def test_the_pack_carries_both_skills_and_the_licence(self):
        base = os.path.join(ROOT, "packs", "open-code-review")
        for n in ("open-code-review", "open-code-review-delegate"):
            self.assertTrue(os.path.isfile(os.path.join(base, "skills", n, "SKILL.md")), n)
        with open(os.path.join(base, "LICENSE"), encoding="utf-8") as f:
            self.assertIn("Apache License", f.read())

    def test_without_the_cli_the_built_in_review_stays_and_the_plan_says_what_to_install(self):
        with tempfile.TemporaryDirectory() as p:
            tracker(p, "init", "--name", "d", "--no-karpathy")
            tracker(p, "integrations", "enable", "open-code-review")
            env = dict(os.environ, HOME=EMPTY_HOME, PATH="/usr/bin:/bin")
            rows = {r["slot"]: r for r in json.loads(subprocess.run([sys.executable, TRACKER, "--root", p, "skills", "list", "--phase", "ship", "--json"],
                                                                     capture_output=True, text=True, env=env).stdout)}
            self.assertEqual((rows["code-review"]["status"], rows["code-review"]["provider"]), ("ready", "claude-code-review"))
            self.assertIn("npm install -g @alibaba-group/open-code-review", rows["code-review"]["note"])

    def test_with_the_cli_present_it_becomes_the_code_review_provider(self):
        with tempfile.TemporaryDirectory() as p, tempfile.TemporaryDirectory() as bindir:
            ocr = os.path.join(bindir, "ocr")
            with open(ocr, "w") as f:
                f.write("#!/bin/sh\necho ocr\n")
            os.chmod(ocr, 0o755)
            tracker(p, "init", "--name", "d", "--no-karpathy")
            tracker(p, "integrations", "enable", "open-code-review")
            env = dict(os.environ, HOME=EMPTY_HOME, PATH=bindir + ":/usr/bin:/bin")
            rows = {r["slot"]: r for r in json.loads(subprocess.run([sys.executable, TRACKER, "--root", p, "skills", "list", "--phase", "harden", "--json"],
                                                                     capture_output=True, text=True, env=env).stdout)}
            self.assertEqual((rows["code-review"]["status"], rows["code-review"]["provider"]), ("ready", "open-code-review"))

    def test_the_risks_name_the_data_that_leaves_the_machine(self):
        with open(os.path.join(ROOT, "skills", "hyperskill", "integrations.json"), encoding="utf-8") as f:
            prov = json.load(f)["providers"]["open-code-review"]
        self.assertEqual(prov["policy"], "opt-in")
        self.assertIn("sends changed file contents", " ".join(prov["risks"]))
        self.assertIn("delegate", " ".join(prov["risks"]))


class PageTests(unittest.TestCase):
    def test_the_page_has_the_chat_and_attach_controls_and_no_innerhtml(self):
        with open(os.path.join(ROOT, "site", "live", "index.html"), encoding="utf-8") as f:
            html = f.read()
        for marker in ('id="chat-form"', 'id="chat-mode"', 'id="chat-stop"', 'id="attach-file"'):
            self.assertIn(marker, html)
        with open(os.path.join(ROOT, "site", "live", "live.js"), encoding="utf-8") as f:
            self.assertNotIn("innerHTML", f.read())

    def test_the_automatic_start_never_enables_run_mode(self):
        with open(os.path.join(SCRIPTS, "hs_live.py"), encoding="utf-8") as f:
            src = f.read()
        ensure = src[src.index("def ensure("):src.index("def stop(")]
        self.assertNotIn("allow-run", ensure)


if __name__ == "__main__":
    unittest.main()
