import json
import os
import sys
import threading
import time
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from test_run import Base, EMPTY_HOME, ROOT, SCRIPTS, free_port, tracker  # noqa: E402

sys.path.insert(0, SCRIPTS)
import hs_live  # noqa: E402
import hs_preview  # noqa: E402
import hs_run  # noqa: E402


def flag(args, name):
    return args[args.index(name) + 1] if name in args else None


class ModelTests(unittest.TestCase):
    def test_every_phase_has_a_suggestion_with_a_reason_that_claude_code_accepts(self):
        with open(os.path.join(ROOT, "skills", "hyperskill", "models.json"), encoding="utf-8") as f:
            m = json.load(f)
        with open(os.path.join(ROOT, "skills", "hyperskill", "gates.json"), encoding="utf-8") as f:
            phases = [p["id"] for p in json.load(f)["phases"]]
        self.assertEqual(sorted(m["phases"]), sorted(phases))
        for pid, s in m["phases"].items():
            self.assertIn(s["model"], hs_run.MODEL_ALIASES, pid)
            self.assertIn(s["effort"], hs_run.EFFORTS, pid)
            self.assertGreater(len(s["why"]), 30, pid)

    def test_a_model_or_effort_that_could_be_a_flag_is_refused(self):
        for bad in ("--dangerously-skip-permissions", "opus; rm -rf /", "-x", "a b"):
            with self.assertRaises(ValueError, msg=bad):
                hs_run.check_model(bad)
        with self.assertRaises(ValueError):
            hs_run.check_effort("ludicrous")

    def test_the_chrome_server_is_pinned_headless_isolated_and_silent(self):
        cfg = json.loads(hs_run.devtools_config())["mcpServers"]["chrome-devtools"]
        args = cfg["args"]
        self.assertIn("chrome-devtools-mcp@" + hs_run.DEVTOOLS_VERSION, args)
        for a in ("--headless", "--isolated", "--usageStatistics=false", "--fileNavigations=false"):
            self.assertIn(a, args)
        self.assertNotIn("latest", " ".join(args))

    def test_the_browser_is_the_one_you_name_or_one_found_on_the_path(self):
        import tempfile
        d = tempfile.mkdtemp()
        fake = os.path.join(d, "chromium")
        with open(fake, "w") as f:
            f.write("#!/bin/sh\n")
        os.chmod(fake, 0o755)
        old = {k: os.environ.get(k) for k in ("PATH", "HYPERSKILL_CHROME")}
        self.addCleanup(lambda: [os.environ.pop(k, None) if v is None else os.environ.__setitem__(k, v) for k, v in old.items()])
        os.environ.pop("HYPERSKILL_CHROME", None)
        os.environ["PATH"] = d
        self.assertEqual(hs_run.find_chrome(), fake)
        self.assertEqual(flag(json.loads(hs_run.devtools_config())["mcpServers"]["chrome-devtools"]["args"], "--executablePath"), fake)
        os.environ["HYPERSKILL_CHROME"] = "/my/chrome"
        self.assertEqual(hs_run.find_chrome(), "/my/chrome")


class SessionIsolationTests(Base):
    def test_a_run_never_inherits_the_session_id_of_the_claude_that_started_the_dashboard(self):
        os.environ["CLAUDE_CODE_SESSION_ID"] = "parent-session"
        self.addCleanup(os.environ.pop, "CLAUDE_CODE_SESSION_ID", None)
        r = hs_run.Runner(self.p, True)
        r.start("hi", "edits")
        self.wait(r)
        self.assertNotIn("CLAUDE_CODE_SESSION_ID", self.calls()[0]["env"])


class PreviewRuleTests(Base):
    def test_only_this_computers_addresses_with_a_port_are_accepted(self):
        for ok in ("http://localhost:3000", "http://127.0.0.1:5173/app", "https://localhost:8443/"):
            hs_preview.check_url(ok)
        for bad in ("http://example.com:3000", "http://localhost", "http://localhost.evil.com:3000", "http://127.0.0.1.evil.com:80/",
                    "file:///etc/passwd", "javascript:alert(1)", "http://user:pw@localhost:3000", "http://0.0.0.0:3000", ""):
            with self.assertRaises(hs_preview.PreviewError, msg=bad):
                hs_preview.check_url(bad)

    def test_project_files_must_be_inside_visible_and_a_page_type(self):
        os.makedirs(os.path.join(self.p, "web"))
        for name, data in (("web/index.html", "<p>hi</p>"), (".env", "KEY=1"), ("data.json", "{}"), ("notes.md", "# n")):
            with open(os.path.join(self.p, name), "w") as f:
                f.write(data)
        self.assertEqual(hs_preview.safe_rel(self.p, "web/index.html")[0], "web/index.html")
        self.assertEqual(hs_preview.safe_rel(self.p, "/notes.md")[0], "notes.md")
        for bad in ("../x.html", "web/../../x.html", ".env", ".hyperskill/state.json", "data.json", "nope.html", "web", "node_modules/a.js"):
            with self.assertRaises(hs_preview.PreviewError, msg=bad):
                hs_preview.safe_rel(self.p, bad)
        os.symlink("/etc/hostname", os.path.join(self.p, "link.html"))
        with self.assertRaises(hs_preview.PreviewError):
            hs_preview.safe_rel(self.p, "link.html")

    def test_a_listening_dev_server_is_found_and_the_dashboard_itself_is_skipped(self):
        import http.server
        port = free_port()
        hs_preview.PORTS = list(hs_preview.PORTS) + [port]
        srv = http.server.ThreadingHTTPServer(("127.0.0.1", port), http.server.SimpleHTTPRequestHandler)
        threading.Thread(target=srv.serve_forever, daemon=True).start()
        self.addCleanup(lambda: (srv.shutdown(), srv.server_close(), setattr(hs_preview, "PORTS", [p for p in hs_preview.PORTS if p != port])))
        hs_preview._CACHE.update(at=0)
        self.assertIn(port, [r["port"] for r in hs_preview.detect(None)])
        hs_preview._CACHE.update(at=0)
        self.assertNotIn(port, [r["port"] for r in hs_preview.detect(port)])


class DashboardTests(Base):
    def setUp(self):
        super().setUp()
        self._home = os.environ.get("HOME")
        os.environ["HOME"] = EMPTY_HOME
        self.addCleanup(lambda: os.environ.__setitem__("HOME", self._home) if self._home is not None else os.environ.pop("HOME", None))
        with open(os.path.join(self.p, "index.html"), "w") as f:
            f.write("<h1>Built</h1>")
        self.server, self.port = hs_live.make_server(self.p, free_port(), controls=True, allow_run=True)
        threading.Thread(target=self.server.serve_forever, daemon=True).start()
        self.addCleanup(lambda: (self.server.runner.stop(), self.server.shutdown(), self.server.server_close()))

    def call(self, method, path, body=None, token=True):
        import http.client
        c = http.client.HTTPConnection("127.0.0.1", self.port, timeout=20)
        h = {"Content-Type": "application/json"}
        if token:
            h["X-HS-Token"] = self.server.token
        c.request(method, path, body=json.dumps(body) if body is not None else None, headers=h)
        r = c.getresponse()
        data = r.read()
        c.close()
        return r.status, dict(r.getheaders()), data

    def finish(self):
        end = time.time() + 15
        while time.time() < end:
            _, _, d = self.call("GET", "/live/state.json")
            if not json.loads(d)["run"]["running"] and self.calls():
                return
            time.sleep(0.1)

    def test_suggested_resolves_to_the_current_phases_model_and_effort(self):
        s, _, d = self.call("POST", "/live/api/run_start", {"text": "go", "mode": "edits", "model": "suggested", "effort": "suggested"})
        self.assertEqual(s, 200, d)
        self.finish()
        a = self.calls()[0]["args"]
        want = json.loads(self.call("GET", "/live/state.json")[2])["models"]["current"]
        self.assertEqual(flag(a, "--model"), want["model"])
        self.assertEqual(flag(a, "--effort"), want["effort"])
        self.assertNotIn("--mcp-config", a)

    def test_choosing_nothing_leaves_claude_codes_own_defaults_and_a_chosen_value_is_passed(self):
        self.call("POST", "/live/api/run_start", {"text": "one", "mode": "edits", "model": None, "effort": None})
        self.finish()
        a = self.calls()[0]["args"]
        self.assertNotIn("--model", a)
        self.assertNotIn("--effort", a)
        self.call("POST", "/live/api/run_new", {})
        os.remove(self.log)
        self.call("POST", "/live/api/run_start", {"text": "two", "mode": "edits", "model": "haiku", "effort": "low"})
        self.finish()
        a = self.calls()[0]["args"]
        self.assertEqual((flag(a, "--model"), flag(a, "--effort")), ("haiku", "low"))

    def test_a_bad_model_or_effort_is_refused_before_anything_runs(self):
        for body in ({"model": "--dangerously-skip-permissions"}, {"effort": "extreme"}, {"model": "x y"}):
            s, _, _ = self.call("POST", "/live/api/run_start", dict({"text": "go", "mode": "edits"}, **body))
            self.assertEqual(s, 400, body)
        self.assertFalse(os.path.exists(self.log))

    def test_chrome_tools_are_added_only_when_asked_and_only_for_a_local_address(self):
        s, _, _ = self.call("POST", "/live/api/run_start", {"text": "t", "mode": "edits", "chrome": True, "preview_url": "http://evil.example:3000/"})
        self.assertEqual(s, 400)
        self.assertFalse(os.path.exists(self.log))
        s, _, _ = self.call("POST", "/live/api/run_start", {"text": "t", "mode": "edits", "chrome": True, "preview_url": "http://localhost:3000/"})
        self.assertEqual(s, 200)
        self.finish()
        a = self.calls()[0]["args"]
        self.assertIn("--mcp-config", a)
        cfg = json.loads(flag(a, "--mcp-config"))["mcpServers"]
        self.assertEqual(list(cfg), ["chrome-devtools"])
        self.assertIn("mcp__chrome-devtools", a)
        self.assertIn("http://localhost:3000/", flag(a, "-p"))
        self.assertNotIn("--dangerously-skip-permissions", a)
        self.assertNotIn("bypassPermissions", a)

    def test_preview_targets_are_added_listed_and_removed_with_the_same_checks(self):
        ok = lambda b: self.call("POST", "/live/api/preview_add", b)[0]
        self.assertEqual(ok({"name": "Home", "path": "index.html"}), 200)
        self.assertEqual(ok({"name": "App", "url": "http://localhost:3000"}), 200)
        self.assertEqual(ok({"name": "Bad", "url": "http://example.com:80"}), 400)
        self.assertEqual(ok({"name": "Bad", "path": "../etc/passwd"}), 400)
        self.assertEqual(ok({"name": "Bad", "path": ".hyperskill/state.json"}), 400)
        names = [t["name"] for t in json.loads(self.call("GET", "/live/state.json")[2])["preview"]["targets"]]
        self.assertEqual(names, ["Home", "App"])
        self.assertEqual(self.call("POST", "/live/api/preview_remove", {"name": "Home"})[0], 200)
        names = [t["name"] for t in json.loads(self.call("GET", "/live/state.json")[2])["preview"]["targets"]]
        self.assertEqual(names, ["App"])
        self.assertEqual(self.call("POST", "/live/api/preview_add", {"name": "x", "path": "index.html"}, token=False)[0], 403)

    def test_project_files_are_served_sandboxed_and_secrets_are_not_served(self):
        with open(os.path.join(self.p, ".env"), "w") as f:
            f.write("SECRET=1")
        s, h, d = self.call("GET", "/live/site/index.html", token=False)
        self.assertEqual((s, d), (200, b"<h1>Built</h1>"))
        csp = h["Content-Security-Policy"]
        self.assertTrue(csp.startswith("sandbox "), csp)
        self.assertNotIn("allow-same-origin", csp)
        self.assertIn("connect-src 'none'", csp)
        for bad in ("/live/site/.env", "/live/site/../.env", "/live/site/%2e%2e/.env", "/live/site/.hyperskill/state.json", "/live/site/missing.html"):
            self.assertEqual(self.call("GET", bad, token=False)[0], 404, bad)

    def test_the_dashboard_may_frame_local_apps_but_nothing_else(self):
        _, h, _ = self.call("GET", "/live/", token=False)
        csp = h["Content-Security-Policy"]
        frame = [x for x in csp.split(";") if x.strip().startswith("frame-src")][0]
        self.assertIn("http://localhost:*", frame)
        self.assertNotIn("*.", frame)
        self.assertNotIn(" https: ", frame + " ")
        self.assertIn("frame-ancestors 'none'", csp)
        self.assertNotIn("[::1]", csp)

    def test_the_page_has_the_model_effort_chrome_and_preview_controls(self):
        base = os.path.join(ROOT, "site", "live")
        with open(os.path.join(base, "index.html"), encoding="utf-8") as f:
            html = f.read()
        with open(os.path.join(base, "live.js"), encoding="utf-8") as f:
            js = f.read()
        for ident in ("chat-model", "chat-effort", "chat-chrome", "chat-suggest", "pv-frame", "pv-tabs", "pv-debug", "pv-form", "pv-width"):
            self.assertIn('id="%s"' % ident, html)
        self.assertIn("allow-same-origin", js)
        self.assertNotIn("innerHTML", js)
        # a project's own files never get allow-same-origin: that would let them read the dashboard's key
        self.assertIn('cur.kind === "web" ? "allow-scripts allow-forms allow-same-origin allow-popups" : "allow-scripts allow-forms"', js)


if __name__ == "__main__":
    unittest.main()
