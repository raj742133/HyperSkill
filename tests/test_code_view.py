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
import _auth  # noqa: E402,F401
import hs_live  # noqa: E402
import hs_code as C  # noqa: E402
import hs_activity as activity  # noqa: E402

TRACKER = os.path.join(SCRIPTS, "hyperskill.py")
FAKE_KEY = "AKIA" + "ABCDEFGHIJKLMNOP"


def free_port():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def sh(cwd, *a):
    subprocess.run(list(a), cwd=cwd, check=True, capture_output=True)


def write(root, rel, body, mode="w"):
    p = os.path.join(root, rel)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, mode) as f:
        f.write(body)


class Project(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.d = self.tmp.name
        sh(self.d, sys.executable, TRACKER, "--root", self.d, "init", "--name", "p", "--tenancy", "none", "--no-karpathy")
        write(self.d, "src/app.js", "const a = 1;\nconst b = 2;\n")
        write(self.d, "README.md", "# p\n")
        write(self.d, ".env", "SECRET=1\n")
        write(self.d, "server.pem", "-----BEGIN PRIVATE KEY-----\n")
        write(self.d, "bin.dat", b"\x00\x01\x02\x03", "wb")
        sh(self.d, "git", "init", "-q")
        sh(self.d, "git", "add", "-A")
        sh(self.d, "git", "-c", "user.email=a@b.c", "-c", "user.name=t", "commit", "-qm", "one")


class ModuleTests(Project):
    def test_the_tree_lists_files_marks_changes_and_hides_secrets_state_and_keys(self):
        write(self.d, "src/app.js", "const a = 1;\nconst b = 3;\n")
        write(self.d, "src/new.js", "x\n")
        os.remove(os.path.join(self.d, "README.md"))
        t = C.tree(self.d)
        by = {f["path"]: f["status"] for f in t["files"]}
        self.assertEqual(by["src/app.js"], "M")
        self.assertEqual(by["src/new.js"], "A")
        self.assertEqual(by["README.md"], "D")
        for hidden in (".env", "server.pem"):
            self.assertNotIn(hidden, by)
        self.assertFalse([p for p in by if p.startswith((".hyperskill", ".git/"))])
        self.assertTrue(t["git"])
        self.assertEqual(t["changed"], 3)

    def test_what_claude_touched_is_listed_newest_first(self):
        activity.append(self.d, "file", "wrote", path=os.path.join(self.d, "src", "app.js"), action="edit")
        activity.append(self.d, "file", "wrote", path="src/new.js", action="write")
        t = C.tree(self.d)
        self.assertEqual([r["path"] for r in t["recent"]][:2], ["src/new.js", "src/app.js"])

    def test_a_modified_file_has_a_unified_diff_and_a_new_file_is_all_additions(self):
        write(self.d, "src/app.js", "const a = 1;\nconst b = 3;\n")
        d = C.diff(self.d, "src/app.js")
        self.assertIn("-const b = 2;", d["diff"])
        self.assertIn("+const b = 3;", d["diff"])
        write(self.d, "src/new.js", "hello\nworld\n")
        n = C.diff(self.d, "src/new.js")
        self.assertEqual(n["status"], "A")
        self.assertIn("+hello", n["diff"])

    def test_a_deleted_file_still_has_a_diff(self):
        os.remove(os.path.join(self.d, "README.md"))
        self.assertIn("-# p", C.diff(self.d, "README.md")["diff"])

    def test_paths_that_leave_the_project_or_name_protected_files_are_refused(self):
        outside = tempfile.mkdtemp(prefix="hs-out-")
        self.addCleanup(lambda: __import__("shutil").rmtree(outside, ignore_errors=True))
        write(outside, "secret.txt", "outside\n")
        os.symlink(os.path.join(outside, "secret.txt"), os.path.join(self.d, "link.txt"))
        os.symlink(outside, os.path.join(self.d, "linkdir"))
        for bad in ("../etc/passwd", "/etc/passwd", "src/../../x", ".env", "server.pem", ".hyperskill/state.json", ".hyperskill/secret.key", ".git/config",
                    "link.txt", "linkdir/secret.txt", "C:\\Windows\\win.ini", "src\\..\\..\\x", "", "src/app.js\x00.png", "nope.txt", "src"):
            for fn in (C.read, C.diff):
                with self.assertRaises(C.CodeError, msg=bad):
                    fn(self.d, bad)

    def test_binary_and_huge_files_are_not_shown(self):
        self.assertIsNone(C.read(self.d, "bin.dat")["text"])
        write(self.d, "big.txt", "x" * (C.MAX_FILE + 10))
        self.assertIsNone(C.read(self.d, "big.txt")["text"])

    def test_lines_that_look_like_secrets_are_hidden_in_files_and_diffs(self):
        write(self.d, "src/conf.js", "const ok = 1;\nconst k = '%s';\n" % FAKE_KEY)
        f = C.read(self.d, "src/conf.js")
        self.assertNotIn(FAKE_KEY, f["text"])
        self.assertIn(C.HIDDEN, f["text"])
        self.assertIn("const ok = 1;", f["text"])
        self.assertNotIn(FAKE_KEY, C.diff(self.d, "src/conf.js")["diff"])

    def test_a_folder_that_is_not_a_repository_still_lists_files(self):
        plain = tempfile.mkdtemp(prefix="hs-plain-")
        self.addCleanup(lambda: __import__("shutil").rmtree(plain, ignore_errors=True))
        write(plain, "a.py", "print(1)\n")
        t = C.tree(plain)
        self.assertFalse(t["git"])
        self.assertEqual([f["path"] for f in t["files"]], ["a.py"])
        self.assertEqual(C.diff(plain, "a.py")["diff"], "")


class RouteTests(Project):
    def setUp(self):
        super().setUp()
        self.server, self.port = hs_live.make_server(self.d, free_port(), controls=True)
        threading.Thread(target=self.server.serve_forever, daemon=True).start()
        self.addCleanup(lambda: (self.server.shutdown(), self.server.server_close()))

    def get(self, path, anonymous=False):
        c = http.client.HTTPConnection("127.0.0.1", self.port, timeout=5)
        c.request("GET", path, headers={"X-Anonymous": "1"} if anonymous else {})
        r = c.getresponse()
        body = r.read()
        c.close()
        return r.status, body

    def test_the_routes_need_the_session_and_return_the_tree_a_file_and_a_diff(self):
        for p in ("/live/code/tree.json", "/live/code/file.json?path=src/app.js", "/live/code/diff.json?path=src/app.js", "/live/code.js"):
            self.assertEqual(self.get(p, anonymous=True)[0], 401, p)
        write(self.d, "src/app.js", "const a = 9;\n")
        s, body = self.get("/live/code/tree.json")
        self.assertEqual(s, 200)
        self.assertIn("src/app.js", [f["path"] for f in json.loads(body)["files"]])
        s, body = self.get("/live/code/file.json?path=src%2Fapp.js")
        self.assertEqual((s, json.loads(body)["text"]), (200, "const a = 9;\n"))
        s, body = self.get("/live/code/diff.json?path=src/app.js")
        self.assertIn("+const a = 9;", json.loads(body)["diff"])
        self.assertEqual(self.get("/live/code.js")[0], 200)

    def test_the_routes_refuse_protected_and_escaping_paths_over_http_too(self):
        for p in ("/live/code/file.json?path=.env", "/live/code/file.json?path=..%2F..%2Fetc%2Fpasswd", "/live/code/file.json?path=.hyperskill%2Fsecret.key",
                  "/live/code/diff.json?path=%2Fetc%2Fpasswd", "/live/code/file.json"):
            s, body = self.get(p)
            self.assertEqual(s, 404, p)
            self.assertNotIn(b"root:", body)
        self.assertEqual(self.get("/live/code/other.json")[0], 404)

    def test_the_page_has_the_section_and_the_script_without_inline_code(self):
        s, body = self.get("/live/")
        html = body.decode()
        self.assertIn('id="code"', html)
        self.assertIn('/live/code.js', html)
        self.assertNotIn("<script>", html)
        with open(os.path.join(ROOT, "site", "live", "code.js"), encoding="utf-8") as f:
            js = f.read()
        self.assertNotIn("innerHTML", js, "file text must only ever be set as text")


if __name__ == "__main__":
    unittest.main()
