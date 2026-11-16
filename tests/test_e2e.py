import http.client
import json
import os
import shutil
import socket
import subprocess
import sys
import tempfile
import threading
import time
import unittest
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPTS = os.path.join(ROOT, "scripts")
sys.path.insert(0, SCRIPTS)
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _auth  # noqa: E402,F401
import hs_e2e as E  # noqa: E402
import hs_live  # noqa: E402

TRACKER = os.path.join(SCRIPTS, "hyperskill.py")
PW = "/opt/node-tools/node_modules"
HAVE_PW = os.path.isdir(os.path.join(PW, "playwright")) and shutil.which("node") and (os.path.isdir("/opt/pw-browsers") or os.environ.get("PLAYWRIGHT_BROWSERS_PATH"))


def free_port():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def tracker(cwd, *a, env=None, check=True):
    r = subprocess.run([sys.executable, TRACKER, *a], cwd=cwd, capture_output=True, text=True, env=dict(os.environ, HYPERSKILL_NO_LIVE="1", **(env or {})))
    if check and r.returncode:
        raise AssertionError(r.stdout + r.stderr)
    return r


class Base(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.d = self.tmp.name
        tracker(self.d, "init", "--name", "p", "--no-karpathy")

    def install_playwright(self):
        nm = os.path.join(self.d, "node_modules")
        os.makedirs(os.path.join(nm, "@playwright", "test"))
        os.makedirs(os.path.join(nm, ".bin"))
        for name in ("playwright", "playwright-core"):
            os.symlink(os.path.join(PW, name), os.path.join(nm, name))
        os.symlink("../playwright/cli.js", os.path.join(nm, ".bin", "playwright"))
        with open(os.path.join(nm, "@playwright", "test", "index.js"), "w") as f:
            f.write("module.exports = require('playwright/test');\n")
        with open(os.path.join(nm, "@playwright", "test", "package.json"), "w") as f:
            f.write('{"name":"@playwright/test","main":"index.js","version":"1.0.0"}')

    def serve(self, html):
        site = os.path.join(self.d, "_site")
        os.makedirs(site)
        with open(os.path.join(site, "index.html"), "w") as f:
            f.write(html)

        class H(SimpleHTTPRequestHandler):
            def __init__(h, *a, **k):
                super().__init__(*a, directory=site, **k)

            def log_message(h, *a):
                pass
        srv = ThreadingHTTPServer(("127.0.0.1", free_port()), H)
        threading.Thread(target=srv.serve_forever, daemon=True).start()
        self.addCleanup(lambda: (srv.shutdown(), srv.server_close()))
        return "http://127.0.0.1:%d" % srv.server_address[1]


class SetupTests(Base):
    def test_init_copies_the_starter_and_never_overwrites(self):
        out = tracker(self.d, "e2e", "init").stdout
        for f in ("playwright.config.js", "e2e/critical-flows.spec.js", "e2e/README.md"):
            self.assertTrue(os.path.isfile(os.path.join(self.d, f)), f)
        self.assertIn("npm install -D @playwright/test", out)
        self.assertIn("HyperSkill installs nothing", out)
        with open(os.path.join(self.d, "playwright.config.js"), "a") as f:
            f.write("// mine\n")
        again = tracker(self.d, "e2e", "init").stdout
        self.assertIn("kept playwright.config.js", again)
        self.assertIn("// mine", open(os.path.join(self.d, "playwright.config.js")).read())

    def test_the_starter_covers_the_five_flows_the_ship_gate_names(self):
        spec = open(os.path.join(self.d, "x"), "w") if False else None
        text = open(os.path.join(ROOT, "skills", "hs-e2e", "template", "e2e", "critical-flows.spec.js"), encoding="utf-8").read()
        for flow in ("sign up", "log in", "core workflow", "billing", "invited"):
            self.assertIn(flow, text)
        self.assertEqual(len(__import__("re").findall(r"test\.fixme\(", text)), 5)

    def test_run_says_what_is_missing_instead_of_downloading_anything(self):
        rec = E.run(self.d)
        self.assertIn("no playwright.config", rec["error"])
        tracker(self.d, "e2e", "init")
        rec = E.run(self.d)
        self.assertIn("npm install -D @playwright/test", rec["error"])
        self.assertEqual(rec["verdict"], "could not run")
        r = tracker(self.d, "e2e", "run", check=False)
        self.assertNotEqual(r.returncode, 0)

    def test_the_verdicts(self):
        base = {"passed": 3, "failed": 0, "flaky": 0, "skipped": 0, "fixme": 0}
        self.assertEqual(E.verdict(None), "never run")
        self.assertEqual(E.verdict(dict(base)), "green")
        self.assertEqual(E.verdict(dict(base, failed=1)), "failing")
        self.assertEqual(E.verdict(dict(base, flaky=1)), "failing")
        self.assertEqual(E.verdict(dict(base, fixme=2, skipped=2)), "incomplete")
        self.assertEqual(E.verdict(dict(base, passed=0)), "nothing ran")
        self.assertEqual(E.verdict({"error": "x"}), "could not run")

    def test_the_report_is_summarised_from_playwrights_json(self):
        report = {"stats": {"duration": 1234}, "suites": [{"title": "a.spec.js", "suites": [{"title": "smoke", "specs": [
            {"title": "ok", "file": "a.spec.js", "tests": [{"status": "expected", "results": [{"status": "passed"}], "annotations": []}]},
            {"title": "bad", "file": "a.spec.js", "tests": [{"status": "unexpected", "results": [{"status": "failed", "error": {"message": "\x1b[31mExpected: 1\nReceived: 2"}}], "annotations": []}]},
            {"title": "slow", "file": "a.spec.js", "tests": [{"status": "flaky", "results": [{"status": "failed"}, {"status": "passed"}], "annotations": []}]},
            {"title": "todo", "file": "a.spec.js", "tests": [{"status": "skipped", "results": [], "annotations": [{"type": "fixme"}]}]}]}]}]}
        s = E.summarise(report)
        self.assertEqual((s["passed"], s["failed"], s["flaky"], s["skipped"], s["fixme"]), (1, 1, 1, 1, 1))
        self.assertEqual(s["failing"][0]["title"], "smoke > bad")
        self.assertEqual(s["failing"][0]["error"], "Expected: 1")
        self.assertEqual(s["duration_ms"], 1234)


@unittest.skipUnless(HAVE_PW, "needs Node, Playwright and a browser on this machine")
class RealRunTests(Base):
    def test_a_real_playwright_run_is_green_incomplete_or_failing_as_it_should_be(self):
        self.install_playwright()
        tracker(self.d, "e2e", "init")
        url = self.serve('<!doctype html><title>Demo</title><a href="#x">go</a><p>hi</p>')
        env = {"E2E_BASE_URL": url}
        r = tracker(self.d, "e2e", "run", env=env, check=False)
        self.assertEqual(r.returncode, 1, r.stdout)
        self.assertIn("incomplete", r.stdout)
        rec = E.last(self.d)
        self.assertEqual((rec["passed"], rec["failed"], rec["fixme"]), (6, 0, 10))
        self.assertIsNone(E.evidence(rec), "an incomplete run cannot be cited")
        spec = os.path.join(self.d, "e2e", "critical-flows.spec.js")
        body = open(spec).read().replace("test.fixme(", "test.skip(")
        open(spec, "w").write(body)
        env2 = dict(os.environ, E2E_BASE_URL=url)
        os.environ.update(env)
        self.addCleanup(lambda: os.environ.pop("E2E_BASE_URL", None))
        rec = E.run(self.d)
        self.assertEqual(rec["verdict"], "green", rec)
        self.assertIn("docs/e2e-last.json: 6 passed, 0 failed, 0 flaky, 10 skipped (green", E.evidence(rec))
        open(spec, "a").write("\ntest('a broken promise', async ({ page }) => { await page.goto('/'); await expect(page.locator('h1')).toBeVisible({ timeout: 500 }); });\n")
        rec = E.run(self.d)
        self.assertEqual(rec["verdict"], "failing")
        self.assertTrue(any("a broken promise" in f["title"] for f in rec["failing"]))
        self.assertIsNone(E.evidence(rec))


class DashboardTests(Base):
    def setUp(self):
        super().setUp()
        self.server, self.port = hs_live.make_server(self.d, free_port(), controls=True)
        threading.Thread(target=self.server.serve_forever, daemon=True).start()
        self.addCleanup(lambda: (self.server.shutdown(), self.server.server_close()))

    def call(self, method, path, body=None, anonymous=False):
        c = http.client.HTTPConnection("127.0.0.1", self.port, timeout=10)
        h = {"Host": "127.0.0.1:%d" % self.port}
        if anonymous:
            h["X-Anonymous"] = "1"
        data = None
        if body is not None:
            data = json.dumps(body)
            h.update({"Content-Type": "application/json", "X-HS-Token": self.server.token, "Origin": "http://127.0.0.1:%d" % self.port})
        c.request(method, path, body=data, headers=h)
        r = c.getresponse()
        out = r.read()
        c.close()
        return r.status, out

    def test_the_state_route_needs_the_session_and_reports_whether_it_is_set_up(self):
        self.assertEqual(self.call("GET", "/live/e2e.json", anonymous=True)[0], 401)
        s, body = self.call("GET", "/live/e2e.json")
        st = json.loads(body)
        self.assertEqual((s, st["configured"], st["installed"], st["verdict"]), (200, False, False, "never run"))

    def test_the_run_button_refuses_until_playwright_is_set_up_and_says_how(self):
        s, body = self.call("POST", "/live/api/e2e_run", {})
        self.assertEqual(s, 400)
        self.assertIn("hyperskill.py e2e init", json.loads(body)["output"])

    def test_recording_needs_a_green_run(self):
        s, body = self.call("POST", "/live/api/e2e_record", {})
        self.assertEqual(s, 400)
        self.assertIn("not green", json.loads(body)["output"])

    def test_the_page_has_the_section_and_the_script(self):
        html = self.call("GET", "/live/")[1].decode()
        self.assertIn('id="e2e"', html)
        self.assertIn("/live/e2e.js", html)
        self.assertEqual(self.call("GET", "/live/e2e.js")[0], 200)
        self.assertEqual(self.call("GET", "/live/e2e.js", anonymous=True)[0], 401)

    @unittest.skipUnless(HAVE_PW, "needs Node, Playwright and a browser on this machine")
    def test_the_button_runs_the_suite_in_the_background_and_a_green_run_can_be_recorded(self):
        self.install_playwright()
        tracker(self.d, "e2e", "init")
        url = self.serve('<!doctype html><title>Demo</title><a href="#x">go</a>')
        spec = os.path.join(self.d, "e2e", "critical-flows.spec.js")
        body = open(spec).read().replace("test.fixme(", "test.skip(")
        open(spec, "w").write(body)
        os.environ["E2E_BASE_URL"] = url
        self.addCleanup(lambda: os.environ.pop("E2E_BASE_URL", None))
        s, body = self.call("POST", "/live/api/e2e_run", {})
        self.assertEqual((s, json.loads(body)["output"]), (200, "started"))
        for _ in range(120):
            st = json.loads(self.call("GET", "/live/e2e.json")[1])
            if not st["running"] and st["last"]:
                break
            time.sleep(0.5)
        self.assertEqual(st["verdict"], "green", st)
        self.assertIn("docs/e2e-last.json", st["evidence"])


if __name__ == "__main__":
    unittest.main()
