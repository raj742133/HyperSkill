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
import hs_control  # noqa: E402
import hs_live  # noqa: E402

TRACKER = os.path.join(SCRIPTS, "hyperskill.py")
HOOK = os.path.join(SCRIPTS, "hs_hook.py")
PACKS = os.path.join(ROOT, "packs")


def free_port():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def tracker(root, *args, check=True):
    return subprocess.run([sys.executable, TRACKER, "--root", root, *args], capture_output=True, text=True, check=check)


def hook(root, when, payload):
    payload = dict(payload, cwd=root)
    r = subprocess.run([sys.executable, HOOK, when], input=json.dumps(payload), capture_output=True, text=True)
    return r.returncode, (json.loads(r.stdout) if r.stdout.strip() else None)


class PackTests(unittest.TestCase):
    def packs(self):
        with open(os.path.join(PACKS, "manifest.json"), encoding="utf-8") as f:
            return json.load(f)["packs"]

    def test_every_pack_carries_its_notice_a_licence_or_an_explanation_and_real_skills(self):
        for pid, spec in self.packs().items():
            base = os.path.join(PACKS, pid)
            with open(os.path.join(base, "NOTICE.md"), encoding="utf-8") as f:
                notice = f.read()
            self.assertIn(spec["repo"], notice, pid)
            self.assertRegex(notice, r"commit `[0-9a-f]{40}`", pid)
            if not os.path.exists(os.path.join(base, "LICENSE")):
                self.assertIn("no LICENSE file", spec["license"], "%s has no licence text and does not say why" % pid)
            names = [n for n in os.listdir(os.path.join(base, "skills"))]
            self.assertTrue(names, pid)
            for n in names:
                self.assertTrue(os.path.isfile(os.path.join(base, "skills", n, "SKILL.md")), "%s/%s" % (pid, n))

    def test_no_pack_contains_a_symlink_or_an_unreviewed_licence(self):
        for dirpath, dirs, files in os.walk(PACKS):
            for n in dirs + files:
                self.assertFalse(os.path.islink(os.path.join(dirpath, n)), os.path.join(dirpath, n))
        with open(os.path.join(ROOT, "skills", "hyperskill", "integrations.json"), encoding="utf-8") as f:
            reg = json.load(f)["providers"]
        for pid in self.packs():
            self.assertIn(pid, reg, pid)
            self.assertIn(reg[pid]["policy"], ("recommended", "opt-in"), "%s is bundled but not approved for use" % pid)
            self.assertFalse(reg[pid].get("noncommercial"), pid)
            lic = reg[pid]["license"]
            self.assertTrue(lic.startswith(("MIT", "Apache-2.0")), "%s: %s" % (pid, lic))

    def test_sitewright_keeps_the_notice_of_the_third_party_code_it_embeds(self):
        with open(os.path.join(PACKS, "sitewright", "THIRD_PARTY_NOTICES.md"), encoding="utf-8") as f:
            text = f.read()
        self.assertIn("Hairline", text)
        self.assertIn("Copyright (c) 2026 Lucas Marques", text)

    def test_licences_that_forbid_redistribution_are_not_bundled(self):
        for banned in ("onetake", "hypit", "mirofish", "gstack"):
            self.assertNotIn(banned, self.packs())
            self.assertFalse(os.path.exists(os.path.join(PACKS, banned)))


class EnableInstallsTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.p = self.tmp.name
        tracker(self.p, "init", "--name", "demo", "--no-karpathy")

    def tearDown(self):
        self.tmp.cleanup()

    def skills(self):
        d = os.path.join(self.p, ".claude", "skills")
        return sorted(os.listdir(d)) if os.path.isdir(d) else []

    def test_enable_copies_the_skills_and_disable_removes_only_those(self):
        os.makedirs(os.path.join(self.p, ".claude", "skills", "mine"))
        open(os.path.join(self.p, ".claude", "skills", "mine", "SKILL.md"), "w").write("x")
        tracker(self.p, "integrations", "enable", "ponytail")
        self.assertIn("ponytail-review", self.skills())
        self.assertIn("mine", self.skills())
        tracker(self.p, "integrations", "disable", "ponytail")
        self.assertEqual(self.skills(), ["mine"])

    def test_enable_never_overwrites_a_skill_folder_the_user_already_has(self):
        d = os.path.join(self.p, ".claude", "skills", "ponytail")
        os.makedirs(d)
        open(os.path.join(d, "SKILL.md"), "w").write("my own version")
        out = tracker(self.p, "integrations", "enable", "ponytail").stdout
        self.assertIn("left your own ponytail alone", out)
        self.assertEqual(open(os.path.join(d, "SKILL.md")).read(), "my own version")
        tracker(self.p, "integrations", "disable", "ponytail")
        self.assertEqual(open(os.path.join(d, "SKILL.md")).read(), "my own version", "disable must not delete what it did not install")

    def test_all_installs_every_bundled_recommended_provider_and_leaves_opt_in_ones(self):
        tracker(self.p, "integrations", "enable", "--all")
        names = self.skills()
        self.assertIn("impeccable", names)
        self.assertIn("security-audit", names)
        self.assertNotIn("ponytail", names, "ponytail is opt-in")
        tracker(self.p, "integrations", "enable", "--all", "--include-opt-in")
        self.assertIn("ponytail", self.skills())

    def test_a_resolved_slot_names_the_enabled_provider_as_installed(self):
        tracker(self.p, "integrations", "enable", "karpathy-skills")
        out = json.loads(tracker(self.p, "integrations", "resolve", "coding-discipline", "--json").stdout)
        self.assertEqual(out["use"], "karpathy-skills")


class SteeringTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.p = self.tmp.name
        tracker(self.p, "init", "--name", "demo")

    def tearDown(self):
        self.tmp.cleanup()

    def test_while_paused_writes_and_commands_are_refused_but_the_way_out_is_not(self):
        tracker(self.p, "pause")
        code, out = hook(self.p, "gate", {"tool_name": "Write", "tool_input": {"file_path": "a.txt", "content": "x"}})
        self.assertEqual(code, 0)
        self.assertEqual(out["hookSpecificOutput"]["permissionDecision"], "deny")
        code, out = hook(self.p, "gate", {"tool_name": "Bash", "tool_input": {"command": "rm -rf build"}})
        self.assertEqual(out["hookSpecificOutput"]["permissionDecision"], "deny")
        for ok_cmd in ("python3 x/scripts/hyperskill.py status", "python3 x/scripts/hyperskill.py resume", "python3 x/hyperskill.py event 'waiting'"):
            self.assertIsNone(hook(self.p, "gate", {"tool_name": "Bash", "tool_input": {"command": ok_cmd}})[1], ok_cmd)
        self.assertEqual(hook(self.p, "gate", {"tool_name": "Bash", "tool_input": {"command": "echo x; hyperskill.py status; rm -rf /"}})[1] is None, True,
                         "documented limit: a pause is a request to the agent, enforced for plain commands")
        tracker(self.p, "resume")
        self.assertIsNone(hook(self.p, "gate", {"tool_name": "Write", "tool_input": {"file_path": "a.txt"}})[1])

    def test_a_queued_instruction_reaches_claude_once(self):
        tracker(self.p, "say", "use", "Postgres,", "not", "SQLite")
        code, out = hook(self.p, "post", {"tool_name": "Write", "tool_input": {"file_path": os.path.join(self.p, "a.js"), "content": "x"}})
        self.assertEqual(code, 0)
        ctx = out["hookSpecificOutput"]["additionalContext"]
        self.assertIn("use Postgres, not SQLite", ctx)
        self.assertEqual(out["hookSpecificOutput"]["hookEventName"], "PostToolUse")
        self.assertIsNone(hook(self.p, "post", {"tool_name": "Write", "tool_input": {"file_path": os.path.join(self.p, "b.js")}})[1])
        tracker(self.p, "say", "second")
        self.assertIn("second", hook(self.p, "prompt", {"prompt": "hi"})[1]["hookSpecificOutput"]["additionalContext"])

    def test_the_hook_does_nothing_outside_a_project(self):
        with tempfile.TemporaryDirectory() as d:
            self.assertEqual(hook(d, "gate", {"tool_name": "Write", "tool_input": {}}), (0, None))
            self.assertEqual(hook(d, "prompt", {}), (0, None))

    def test_the_inbox_is_capped_and_ignores_empty_text(self):
        self.assertIsNone(hs_control.push(self.p, "   "))
        for i in range(hs_control.MAX_PENDING):
            self.assertTrue(hs_control.push(self.p, "n%d" % i))
        self.assertIsNone(hs_control.push(self.p, "one too many"))


class AutoStartTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.p = self.tmp.name
        tracker(self.p, "init", "--name", "demo")

    def tearDown(self):
        tracker(self.p, "live", "--stop", check=False)
        self.tmp.cleanup()

    def start(self, env=None):
        payload = json.dumps({"cwd": self.p, "source": "startup"})
        r = subprocess.run([sys.executable, HOOK, "start"], input=payload, capture_output=True, text=True, env=dict(os.environ, **(env or {})))
        return r.returncode, (json.loads(r.stdout) if r.stdout.strip() else None)

    def up(self, url):
        c = http.client.HTTPConnection(url.split("//")[1].rstrip("/"), timeout=5)
        try:
            c.request("GET", "/live/state.json", headers={"X-Anonymous": "1"})
            return c.getresponse().status == 401  # up, and locked to anyone without the key
        except OSError:
            return False
        finally:
            c.close()

    def test_a_session_start_starts_the_dashboard_once_and_tells_claude_the_address(self):
        code, out = self.start()
        self.assertEqual(code, 0)
        ctx = out["hookSpecificOutput"]["additionalContext"]
        url = ctx.split("running at ")[1].split(" ")[0]
        self.assertRegex(url, r"^http://127\.0\.0\.1:\d+/$")
        self.assertTrue(self.up(url))
        code, again = self.start()
        self.assertIn(url, again["hookSpecificOutput"]["additionalContext"], "a second session reuses the running dashboard")

    def test_stop_ends_it_and_removes_the_pointer_file(self):
        url = self.start()[1]["hookSpecificOutput"]["additionalContext"].split("running at ")[1].split(" ")[0]
        self.assertIn("stopped", tracker(self.p, "live", "--stop").stdout)
        for _ in range(30):
            if not self.up(url):
                break
            import time
            time.sleep(0.2)
        self.assertFalse(self.up(url))
        pointer = os.path.join(self.p, ".hyperskill", "live.json")
        for _ in range(30):  # the server closes its port first and removes the file a moment later; on a busy machine that gap is visible
            if not os.path.exists(pointer):
                break
            import time
            time.sleep(0.2)
        self.assertFalse(os.path.exists(pointer))
        self.assertIn("no live view", tracker(self.p, "live", "--stop").stdout)

    def test_it_can_be_turned_off_per_project_or_per_shell(self):
        tracker(self.p, "config", "--autolive", "off")
        self.assertNotIn("running at", json.dumps(self.start()[1]))
        tracker(self.p, "config", "--autolive", "on")
        self.assertNotIn("running at", json.dumps(self.start({"HYPERSKILL_NO_LIVE": "1"})[1]))
        self.assertFalse(os.path.exists(os.path.join(self.p, ".hyperskill", "live.json")))

    def test_it_does_nothing_outside_a_project(self):
        with tempfile.TemporaryDirectory() as d:
            r = subprocess.run([sys.executable, HOOK, "start"], input=json.dumps({"cwd": d}), capture_output=True, text=True)
            self.assertEqual((r.returncode, r.stdout.strip()), (0, ""))
            self.assertFalse(os.path.exists(os.path.join(d, ".hyperskill")))

    def test_a_stale_pointer_file_is_ignored(self):
        with open(os.path.join(self.p, ".hyperskill", "live.json"), "w") as f:
            json.dump({"pid": 999999, "port": 4777}, f)
        self.assertIsNone(hs_live.read_live(self.p))
        self.assertFalse(os.path.exists(os.path.join(self.p, ".hyperskill", "live.json")))


class CodingRulesTests(unittest.TestCase):
    def start(self, root):
        r = subprocess.run([sys.executable, HOOK, "start"], input=json.dumps({"cwd": root}), capture_output=True, text=True,
                           env=dict(os.environ, HYPERSKILL_NO_LIVE="1"))
        return json.loads(r.stdout)["hookSpecificOutput"]["additionalContext"] if r.stdout.strip() else ""

    def test_init_switches_the_karpathy_rules_on_and_every_session_start_reads_them(self):
        with tempfile.TemporaryDirectory() as p:
            out = tracker(p, "init", "--name", "demo").stdout
            self.assertIn("coding rules on", out)
            self.assertTrue(os.path.isfile(os.path.join(p, ".claude", "skills", "karpathy-guidelines", "SKILL.md")))
            ctx = self.start(p)
            for rule in ("Think Before Coding", "Simplicity First", "Surgical Changes", "Goal-Driven Execution"):
                self.assertIn(rule, ctx)
            self.assertNotIn("name: karpathy-guidelines", ctx, "the skill's front matter is not part of the reminder")

    def test_it_can_be_declined_at_init_or_switched_off_later(self):
        with tempfile.TemporaryDirectory() as p:
            tracker(p, "init", "--name", "demo", "--no-karpathy")
            self.assertNotIn("Think Before Coding", self.start(p))
            self.assertFalse(os.path.exists(os.path.join(p, ".claude", "skills", "karpathy-guidelines")))
        with tempfile.TemporaryDirectory() as p:
            tracker(p, "init", "--name", "demo")
            tracker(p, "integrations", "disable", "karpathy-skills")
            self.assertNotIn("Think Before Coding", self.start(p))
            self.assertFalse(os.path.exists(os.path.join(p, ".claude", "skills", "karpathy-guidelines")))

    def test_the_reviewer_agent_checks_diff_discipline(self):
        with open(os.path.join(ROOT, "agents", "hs-reviewer.md"), encoding="utf-8") as f:
            self.assertIn("Diff discipline", f.read())


class ControlApiTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.p = self.tmp.name
        tracker(self.p, "init", "--name", "demo", "--tenancy", "user")
        self.server, self.port = hs_live.make_server(self.p, free_port(), controls=True)
        self.token = self.server.token
        threading.Thread(target=self.server.serve_forever, daemon=True).start()

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.tmp.cleanup()

    def post(self, action, body=None, token="auto", host=None, origin=None, ctype="application/json"):
        c = http.client.HTTPConnection("127.0.0.1", self.port, timeout=15)
        h = {"Content-Type": ctype}
        if token == "auto":
            token = self.token
        if token is not None:
            h["X-HS-Token"] = token
        if host:
            h["Host"] = host
        if origin:
            h["Origin"] = origin
        c.request("POST", "/live/api/" + action, body=json.dumps(body or {}), headers=h)
        r = c.getresponse()
        data = r.read()
        c.close()
        return r.status, (json.loads(data) if data else None)

    def get(self, path):
        c = http.client.HTTPConnection("127.0.0.1", self.port, timeout=5)
        c.request("GET", path)
        r = c.getresponse()
        data = r.read()
        c.close()
        return r.status, data

    def test_the_token_is_inside_the_served_page_and_nowhere_else(self):
        status, page = self.get("/")
        self.assertIn(self.token.encode(), page)
        self.assertNotIn(self.token.encode(), self.get("/live/state.json")[1])
        self.assertNotIn(self.token.encode(), self.get("/live/live.js")[1])
        with open(os.path.join(ROOT, "site", "live", "index.html"), "rb") as f:
            self.assertIn(b'name="hs-token" content=""', f.read(), "the file on disk, and so the public site, carries no token")

    def test_requests_without_the_key_the_right_origin_or_json_are_refused(self):
        self.assertEqual(self.post("pause", token=None)[0], 403)
        self.assertEqual(self.post("pause", token="wrong")[0], 403)
        self.assertEqual(self.post("pause", host="evil.example:%d" % self.port)[0], 403)
        self.assertEqual(self.post("pause", origin="http://evil.example")[0], 403)
        self.assertEqual(self.post("pause", ctype="text/plain")[0], 415)
        self.assertFalse(hs_control.is_paused(self.p))

    def test_it_has_no_way_to_run_an_arbitrary_command(self):
        self.assertEqual(self.post("run", {"cmd": "touch pwned"})[0], 400)
        self.assertEqual(self.post("pass", {"phase": "research", "item": "x; touch pwned", "evidence": "e"})[0], 400)
        self.assertEqual(self.post("enable", {"id": "../../etc"})[0], 400)
        self.assertFalse(os.path.exists(os.path.join(self.p, "pwned")))

    def test_pass_follows_the_trackers_rules_and_shows_in_state(self):
        _, state = self.get("/live/state.json")
        state = json.loads(state)
        self.assertTrue(state["control"]["enabled"])
        cur = state["current"]
        item = next(i for i in next(p for p in state["phases"] if p["id"] == cur)["items"] if i["state"] == "open")
        status, res = self.post("pass", {"phase": cur, "item": item["id"], "evidence": "looks fine"})
        self.assertEqual(status, 200)
        self.assertFalse(res["ok"], "vague evidence is refused exactly as on the command line")
        status, res = self.post("pass", {"phase": cur, "item": item["id"], "evidence": "ran `npm test` -> 12 passed, saw output in /tmp/x.log"})
        if res["ok"]:
            after = json.loads(self.get("/live/state.json")[1])
            row = next(i for i in next(p for p in after["phases"] if p["id"] == cur)["items"] if i["id"] == item["id"])
            self.assertEqual(row["state"], "passed")
        status, res = self.post("waive", {"phase": cur, "item": item["id"], "reason": ""})
        self.assertEqual(status, 400)

    def test_advance_is_refused_while_checks_are_open(self):
        status, res = self.post("advance")
        self.assertEqual(status, 200)
        self.assertFalse(res["ok"])

    def test_pause_say_and_integrations_work_from_the_page(self):
        self.assertTrue(self.post("pause")[1]["ok"])
        self.assertTrue(hs_control.is_paused(self.p))
        self.assertTrue(json.loads(self.get("/live/state.json")[1])["control"]["paused"])
        self.assertTrue(self.post("resume")[1]["ok"])
        self.assertTrue(self.post("say", {"text": "prefer small commits"})[1]["ok"])
        self.assertEqual([r["text"] for r in hs_control.pending(self.p)], ["prefer small commits"])
        self.assertTrue(self.post("enable", {"id": "impeccable"})[1]["ok"])
        self.assertTrue(os.path.isfile(os.path.join(self.p, ".claude", "skills", "impeccable", "SKILL.md")))
        rows = {r["id"]: r for r in json.loads(self.get("/live/state.json")[1])["integrations"]}
        self.assertTrue(rows["impeccable"]["enabled"] and rows["impeccable"]["installed"] and rows["impeccable"]["bundled"] == 1)
        self.assertTrue(self.post("disable", {"id": "impeccable"})[1]["ok"])
        self.assertFalse(os.path.exists(os.path.join(self.p, ".claude", "skills", "impeccable")))


class ReadOnlyTests(unittest.TestCase):
    def test_without_controls_there_is_no_post_route_and_no_token(self):
        with tempfile.TemporaryDirectory() as p:
            tracker(p, "init", "--name", "demo")
            server, port = hs_live.make_server(p, free_port())
            threading.Thread(target=server.serve_forever, daemon=True).start()
            try:
                c = http.client.HTTPConnection("127.0.0.1", port, timeout=5)
                c.request("POST", "/live/api/pause", body="{}", headers={"Content-Type": "application/json"})
                self.assertEqual(c.getresponse().status, 405)
                c.close()
                self.assertIsNone(server.token)
                c = http.client.HTTPConnection("127.0.0.1", port, timeout=5)
                c.request("GET", "/live/state.json")
                state = json.loads(c.getresponse().read())
                self.assertFalse(state["control"]["enabled"])
            finally:
                server.shutdown()
                server.server_close()


if __name__ == "__main__":
    unittest.main()
