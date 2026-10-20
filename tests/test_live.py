import http.client
import json
import os
import socket
import subprocess
import sys
import tempfile
import threading
import time
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPTS = os.path.join(ROOT, "scripts")
sys.path.insert(0, SCRIPTS)
import hs_activity as activity  # noqa: E402
import hs_live  # noqa: E402

TRACKER = os.path.join(SCRIPTS, "hyperskill.py")


def free_port():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


class LiveServerTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.p = self.tmp.name
        subprocess.run([sys.executable, TRACKER, "--root", self.p, "init", "--name", "demo", "--tenancy", "user"], check=True, capture_output=True)
        self.server, self.port = hs_live.make_server(self.p, free_port())
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.tmp.cleanup()

    def get(self, path, host=None, headers=None):
        c = http.client.HTTPConnection("127.0.0.1", self.port, timeout=5)
        h = dict(headers or {})
        if host:
            h["Host"] = host
        c.request("GET", path, headers=h)
        r = c.getresponse()
        body = r.read()
        c.close()
        return r.status, dict(r.getheaders()), body

    def test_it_listens_on_this_computer_only(self):
        self.assertEqual(self.server.server_address[0], "127.0.0.1")

    def test_the_page_and_its_two_assets_are_served_with_a_strict_policy(self):
        for path, ctype in (("/", "text/html"), ("/live", "text/html"), ("/live/", "text/html"), ("/live/live.js", "text/javascript"), ("/live/live.css", "text/css"), ("/favicon.svg", "image/svg+xml")):
            status, headers, body = self.get(path)
            self.assertEqual(status, 200, path)
            self.assertTrue(headers["Content-Type"].startswith(ctype), path)
            self.assertIn("connect-src 'self'", headers["Content-Security-Policy"])
            self.assertEqual(headers["X-Content-Type-Options"], "nosniff")
            self.assertTrue(body)

    def test_the_live_server_marks_the_page_live_and_the_static_file_stays_replay(self):
        body = self.get("/live")[2].decode()
        self.assertIn('name="hs-mode" content="live"', body)
        with open(os.path.join(ROOT, "site", "live", "index.html"), encoding="utf-8") as f:
            self.assertIn('name="hs-mode" content="replay"', f.read())

    def test_only_the_whitelisted_files_can_be_read(self):
        for path in ("/../README.md", "/..%2fREADME.md", "/.hyperskill/state.json", "/live/state.json/../x", "/live/replay.json", "/replay.json", "/hyperskill.py", "/live/../scripts/hyperskill.py", "/live/live.js/../../scripts/hyperskill.py", "/state.json", "/events", "/live.js"):
            status, _, body = self.get(path)
            self.assertEqual(status, 404, path)
            self.assertNotIn(b"HyperSkill state and gate tracker", body)

    def test_a_foreign_host_header_is_refused_so_other_websites_cannot_read_it(self):
        for host in ("evil.example", "evil.example:%d" % self.port, "127.0.0.1.evil.example", "localhost"):
            status, _, _ = self.get("/live/state.json", host=host)
            self.assertEqual(status, 403, host)
        self.assertEqual(self.get("/live/state.json", host="localhost:%d" % self.port)[0], 200)

    def test_state_merges_the_gates_with_the_project_state(self):
        status, _, body = self.get("/live/state.json")
        st = json.loads(body)
        self.assertEqual((status, st["name"], st["current"], st["tenancy"]), (200, "demo", "research", "user"))
        self.assertEqual([p["id"] for p in st["phases"]][:3], ["research", "plan", "foundation"])
        research = st["phases"][0]
        self.assertEqual((research["done"], research["total"], research["status"]), (0, 5, "active"))
        self.assertTrue(all(i["state"] == "open" for i in research["items"]))
        harden = next(p for p in st["phases"] if p["id"] == "harden")
        self.assertEqual(harden["total"], 9, "an organisation-only check does not count for a user-tenancy project")
        self.assertIn("na", [i["state"] for i in harden["items"]])

    def test_state_changes_after_a_check_is_passed(self):
        subprocess.run([sys.executable, TRACKER, "--root", self.p, "gate", "research", "--pass", "risks-listed", "--evidence", "docs/research.md section 6: 5 risks"], check=True, capture_output=True)
        st = json.loads(self.get("/live/state.json")[2])
        self.assertEqual(st["phases"][0]["done"], 1)
        item = next(i for i in st["phases"][0]["items"] if i["id"] == "risks-listed")
        self.assertEqual(item["state"], "passed")
        self.assertIn("5 risks", item["note"])

    def _stream(self, last_id=None):
        c = http.client.HTTPConnection("127.0.0.1", self.port, timeout=8)
        headers = {"Last-Event-ID": str(last_id)} if last_id is not None else {}
        c.request("GET", "/live/events", headers=headers)
        return c, c.getresponse()

    def _read_messages(self, resp, want, seconds=6):
        """Read server-sent messages until `want` activity events arrive or time runs out."""
        deadline = time.time() + seconds
        got, msg = [], {}
        while time.time() < deadline and len(got) < want:
            line = resp.fp.readline().decode("utf-8")
            if not line:
                break
            line = line.rstrip("\n")
            if line == "":
                if msg.get("event") == "activity":
                    got.append((msg.get("id"), json.loads(msg["data"])))
                msg = {}
            elif not line.startswith(":") and ":" in line:
                k, v = line.split(":", 1)
                msg[k] = v.strip()
        return got

    def test_the_stream_sends_recent_events_then_every_new_one(self):
        activity.append(self.p, "note", "before connecting")
        c, resp = self._stream()
        try:
            self.assertEqual(resp.status, 200)
            self.assertEqual(resp.getheader("Content-Type"), "text/event-stream")
            first = self._read_messages(resp, 2)  # the project's own start event, then ours
            self.assertEqual([e["text"] for _, e in first][-1], "before connecting")
            activity.append(self.p, "file", "Wrote a.js", action="write", path="a.js", lines=3)
            activity.append(self.p, "test", "node:test: 3 passed, 0 failed", passed=3, failed=0)
            more = self._read_messages(resp, 2)
            self.assertEqual([e["type"] for _, e in more], ["file", "test"])
        finally:
            c.close()

    def test_a_reconnect_resumes_after_the_last_event_it_saw(self):
        activity.append(self.p, "note", "one")
        c, resp = self._stream()
        first = self._read_messages(resp, 2)  # start event + "one"; the resume id rides on the last event of a batch
        c.close()
        last_id = first[-1][0]
        self.assertTrue(last_id and last_id.isdigit())
        activity.append(self.p, "note", "two")
        c2, resp2 = self._stream(last_id)
        try:
            again = self._read_messages(resp2, 1)
            self.assertEqual([e["text"] for _, e in again], ["two"], "no repeat of 'one'")
        finally:
            c2.close()

    def test_a_state_message_follows_a_change_to_the_state_file(self):
        c, resp = self._stream()
        try:
            deadline = time.time() + 6
            kinds = []
            subprocess.run([sys.executable, TRACKER, "--root", self.p, "log", "poke the state file"], check=True, capture_output=True)
            while time.time() < deadline and kinds.count("state") < 2:
                line = resp.fp.readline().decode().strip()
                if line.startswith("event:"):
                    kinds.append(line.split(":", 1)[1].strip())
            self.assertGreaterEqual(kinds.count("state"), 2, kinds)  # one on connect, one after the change
        finally:
            c.close()

    def test_a_directory_that_is_not_a_project_fails_with_the_usual_message(self):
        with tempfile.TemporaryDirectory() as empty:
            r = subprocess.run([sys.executable, TRACKER, "--root", empty, "live", "--no-open", "--port", str(free_port())], capture_output=True, text=True, timeout=10)
            self.assertNotEqual(r.returncode, 0)
            self.assertIn("no HyperSkill state", r.stderr)

    def test_the_port_moves_on_when_it_is_taken(self):
        busy = free_port()
        with socket.socket() as s:
            s.bind(("127.0.0.1", busy))
            s.listen(1)
            server, port = hs_live.make_server(self.p, busy)
            try:
                self.assertNotEqual(port, busy)
                self.assertGreater(port, busy)
            finally:
                server.server_close()


class DashboardFilesTests(unittest.TestCase):
    def test_the_page_draws_activity_text_without_innerhtml(self):
        with open(os.path.join(ROOT, "site", "live", "live.js"), encoding="utf-8") as f:
            js = f.read()
        for bad in ("innerHTML", "outerHTML", "insertAdjacentHTML", "document.write", "eval(", "new Function"):
            self.assertNotIn(bad, js)

    def test_the_page_has_no_inline_script_or_style_and_no_external_origin(self):
        with open(os.path.join(ROOT, "site", "live", "index.html"), encoding="utf-8") as f:
            html = f.read()
        self.assertNotIn("style=", html)
        self.assertNotIn("http://", html)
        self.assertNotIn("https://", html)
        self.assertIn('href="/live/live.css"', html)
        self.assertIn('<script src="/live/live.js">', html)
        self.assertEqual(html.count("<script"), 1)


if __name__ == "__main__":
    unittest.main()
