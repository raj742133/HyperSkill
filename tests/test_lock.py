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

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPTS = os.path.join(ROOT, "scripts")
sys.path.insert(0, SCRIPTS)
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _auth  # noqa: E402,F401
import hs_live  # noqa: E402

TRACKER = os.path.join(SCRIPTS, "hyperskill.py")


def free_port():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


class LockTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        subprocess.run([sys.executable, TRACKER, "--root", self.tmp.name, "init", "--name", "p", "--tenancy", "none", "--no-karpathy"], check=True, capture_output=True)
        self.server, self.port = hs_live.make_server(self.tmp.name, free_port(), controls=True)
        threading.Thread(target=self.server.serve_forever, daemon=True).start()
        self.addCleanup(lambda: (self.server.shutdown(), self.server.server_close()))

    def get(self, path, headers=None):
        c = http.client.HTTPConnection("127.0.0.1", self.port, timeout=5)
        c.request("GET", path, headers=dict({"X-Anonymous": "1"}, **(headers or {})))
        r = c.getresponse()
        body = r.read()
        c.close()
        return r.status, dict(r.getheaders()), body

    def test_another_process_gets_nothing_without_the_key(self):
        for path in ("/live/state.json", "/live/events", "/", "/live/", "/live/live.js", "/live/site/index.html", "/live/previews/tells/harsh-gradients.svg"):
            status, _, body = self.get(path)
            self.assertEqual(status, 401, path)
            self.assertNotIn(self.server.token.encode(), body, path)
            self.assertNotIn(b"hs-token", body, path)
        status, _, body = self.get("/")
        self.assertIn(b"locked", body.lower())

    def test_a_wrong_key_does_not_sign_in_and_the_right_one_sets_a_httponly_samesite_cookie_and_hides_the_key(self):
        self.assertEqual(self.get("/?k=wrong")[0], 403)
        self.assertEqual(self.get("/?k=" + "A" * len(self.server.key))[0], 403)
        status, headers, _ = self.get("/?k=" + self.server.key)
        self.assertEqual(status, 302)
        self.assertEqual(headers["Location"], "/", "the key is dropped from the address bar")
        cookie = headers["Set-Cookie"]
        self.assertIn("HttpOnly", cookie)
        self.assertIn("SameSite=Lax", cookie)
        self.assertIn(hs_live.COOKIE % self.port, cookie)
        jar = cookie.split(";")[0]
        status, _, body = self.get("/", {"Cookie": jar})
        self.assertEqual(status, 200)
        self.assertIn(self.server.token.encode(), body, "the page carries the controls' token only for a signed-in browser")
        self.assertEqual(self.get("/live/state.json", {"Cookie": jar})[0], 200)

    def test_a_cookie_for_another_dashboard_or_a_guess_does_not_work(self):
        self.assertEqual(self.get("/live/state.json", {"Cookie": "%s=%s" % (hs_live.COOKIE % self.port, "x" * 43)})[0], 401)
        self.assertEqual(self.get("/live/state.json", {"Cookie": "%s=%s" % (hs_live.COOKIE % (self.port + 1), self.server.session)})[0], 401)
        self.assertEqual(self.get("/live/state.json", {"Cookie": "garbage; ;;="})[0], 401)

    def test_the_token_alone_is_not_enough_to_act_and_neither_is_the_cookie_alone(self):
        def post(headers):
            c = http.client.HTTPConnection("127.0.0.1", self.port, timeout=5)
            c.request("POST", "/live/api/pause", body="{}", headers=dict({"Content-Type": "application/json", "X-Anonymous": "1"}, **headers))
            r = c.getresponse()
            r.read()
            c.close()
            return r.status
        cookie = "%s=%s" % (hs_live.COOKIE % self.port, self.server.session)
        self.assertEqual(post({"X-HS-Token": self.server.token}), 401)
        self.assertEqual(post({"Cookie": cookie}), 403)
        self.assertEqual(post({"Cookie": cookie, "X-HS-Token": self.server.token}), 200)

    def test_the_key_file_is_private_and_the_printed_address_is_not_given_to_claude(self):
        env = dict(os.environ, HYPERSKILL_NO_LIVE="")
        port = free_port()
        proc = subprocess.Popen([sys.executable, TRACKER, "--root", self.tmp.name, "live", "--no-open", "--port", str(port)], stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, env=env)
        self.addCleanup(lambda: (proc.terminate(), proc.wait(5), proc.stdout.close()))
        keyfile = os.path.join(self.tmp.name, ".hyperskill", "live.key")
        end = time.time() + 10
        while time.time() < end and not os.path.exists(os.path.join(self.tmp.name, ".hyperskill", "live.json")):
            time.sleep(0.1)
        self.assertEqual(stat.S_IMODE(os.stat(keyfile).st_mode), 0o600)
        opener = os.path.join(self.tmp.name, ".hyperskill", "open.html")
        self.assertEqual(stat.S_IMODE(os.stat(opener).st_mode), 0o600)
        with open(keyfile, encoding="utf-8") as f:
            key = f.read().strip()
        proc.terminate()
        out = proc.stdout.read()
        self.assertNotIn(key, out, "output that a pipe (and so Claude) can read never holds the key")
        self.assertIn("locked", out)
        self.assertIn("live --open", out)

    def test_ensure_returns_the_plain_address_so_the_key_never_reaches_a_claude_session(self):
        env_old = os.environ.get("HYPERSKILL_NO_LIVE")
        os.environ.pop("HYPERSKILL_NO_LIVE", None)
        self.addCleanup(lambda: os.environ.__setitem__("HYPERSKILL_NO_LIVE", env_old) if env_old is not None else None)
        url = hs_live.ensure(self.tmp.name, port=free_port(), wait=6.0)
        self.addCleanup(lambda: hs_live.stop(self.tmp.name))
        self.assertTrue(url and "?k=" not in url, url)
        info = hs_live.read_live(self.tmp.name)
        self.assertIn("?k=", info["launch"])
        self.assertNotEqual(info["launch"], info["url"])

    def test_the_hook_context_and_the_command_never_contain_the_key(self):
        with open(os.path.join(ROOT, "commands", "hyperskill-live.md"), encoding="utf-8") as f:
            text = f.read()
        self.assertIn("live --open", text)
        self.assertIn("Never read, print or ask for", text)


if __name__ == "__main__":
    unittest.main()
