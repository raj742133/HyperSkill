import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts"))
import hs_adopt as A  # noqa: E402

TRACKER = os.path.join(ROOT, "scripts", "hyperskill.py")
FAKE_KEY = "AKIA" + "ABCDEFGHIJKLMNOP"          # built in two pieces so this file does not itself look like a leaked key


def sh(cwd, *args, check=True):
    r = subprocess.run(list(args), cwd=cwd, capture_output=True, text=True)
    if check and r.returncode:
        raise AssertionError(r.stderr)
    return r


def tracker(cwd, *args, check=True):
    env = dict(os.environ, HYPERSKILL_NO_LIVE="1")
    r = subprocess.run([sys.executable, TRACKER, *args], cwd=cwd, capture_output=True, text=True, env=env)
    if check and r.returncode:
        raise AssertionError(r.stdout + r.stderr)
    return r


def write(root, rel, body):
    p = os.path.join(root, rel)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, "w", encoding="utf-8") as f:
        f.write(body)


class Repo(unittest.TestCase):
    def setUp(self):
        self.d = tempfile.mkdtemp(prefix="hs-adopt-")
        self.addCleanup(shutil.rmtree, self.d, ignore_errors=True)
        write(self.d, "package.json", json.dumps({"name": "shop", "scripts": {"build": "vite build", "test": "vitest"},
                                                  "dependencies": {"react": "18", "express": "4"}, "devDependencies": {"vite": "5"}}))
        write(self.d, "src/server.js", "const key = process.env.KEY;\n// TODO fix\nmodule.exports = {};\n")
        write(self.d, "src/config.js", "const aws = '%s';\nmodule.exports = aws;\n" % FAKE_KEY)
        write(self.d, "src/big.js", "\n".join("const a%d = %d;" % (i, i) for i in range(900)))
        write(self.d, "README.md", "# Shop\n")
        write(self.d, ".env", "DB_PASSWORD=hunter2hunter2hunter2\n")
        write(self.d, "node_modules/dep/index.js", "module.exports = 1;\n")
        sh(self.d, "git", "init", "-q")
        sh(self.d, "git", "-c", "user.email=a@b.c", "-c", "user.name=t", "add", "-A")
        sh(self.d, "git", "-c", "user.email=a@b.c", "-c", "user.name=t", "commit", "-qm", "first")


class ScanTests(Repo):
    def test_it_reads_the_stack_and_skips_dependencies(self):
        r = A.scan(self.d)
        self.assertEqual(r["languages"][0]["name"], "JavaScript")
        self.assertIn("React", r["frameworks"])
        self.assertIn("Express", r["frameworks"])
        self.assertIn("Vite", r["frameworks"])
        self.assertTrue(all("node_modules" not in f["path"] for f in r["structure"]))
        self.assertIn("build", r["scripts"])
        self.assertEqual(r["git"]["commits"], 1)

    def test_the_risks_that_were_planted_are_found(self):
        ids = {k["id"] for k in A.scan(self.d)["risks"]}
        for want in ("no-tests", "no-ci", "no-lockfile", "secrets", "env-committed", "big-files", "no-licence"):
            self.assertIn(want, ids)

    def test_secret_values_are_never_stored_or_printed(self):
        r = A.scan(self.d)
        blob = json.dumps(r, default=str) + A.render(r)
        self.assertNotIn(FAKE_KEY, blob)
        self.assertNotIn("hunter2", blob)
        s = [x for x in r["secrets"] if x["file"].endswith("config.js")][0]
        self.assertEqual((s["line"], s["kind"]), (1, "AWS access key id"))

    def test_symlinks_are_not_followed(self):
        outside = tempfile.mkdtemp(prefix="hs-outside-")
        self.addCleanup(shutil.rmtree, outside, ignore_errors=True)
        write(outside, "leak.js", "const k = '%s';\n" % FAKE_KEY)
        os.symlink(outside, os.path.join(self.d, "linked"))
        os.symlink(os.path.join(outside, "leak.js"), os.path.join(self.d, "leak-link.js"))
        r = A.scan(self.d)
        self.assertFalse([x for x in r["secrets"] if "leak" in x["file"] or x["file"].startswith("linked")])

    def test_tests_and_ci_are_recognised_and_become_evidence_candidates(self):
        write(self.d, "tests/cart.test.js", "test('x', () => {})\n")
        write(self.d, ".github/workflows/ci.yml", "name: ci\n")
        write(self.d, "package-lock.json", "{}")
        write(self.d, "CLAUDE.md", "# memory\n")
        r = A.scan(self.d)
        self.assertEqual(r["tests"]["files"], 1)
        self.assertIn("ci-blocks", r["evidence_candidates"])
        self.assertIn("memory-updated", r["evidence_candidates"])
        self.assertIn("dependency-audit", r["evidence_candidates"])
        ids = {k["id"] for k in r["risks"]}
        self.assertNotIn("no-ci", ids)
        self.assertNotIn("no-lockfile", ids)

    def test_a_folder_that_is_not_a_repo_is_a_high_risk(self):
        plain = tempfile.mkdtemp(prefix="hs-plain-")
        self.addCleanup(shutil.rmtree, plain, ignore_errors=True)
        write(plain, "main.py", "print('hi')\n")
        risks = {k["id"]: k["severity"] for k in A.scan(plain)["risks"]}
        self.assertEqual(risks["no-git"], "high")

    def test_an_empty_folder_does_not_crash(self):
        empty = tempfile.mkdtemp(prefix="hs-empty-")
        self.addCleanup(shutil.rmtree, empty, ignore_errors=True)
        r = A.scan(empty)
        self.assertEqual(r["files"], 0)
        self.assertIn("# Inventory", A.render(r))


class CommandTests(Repo):
    def test_init_adopt_writes_the_documents_and_turns_on_the_adopt_only_checks(self):
        out = tracker(self.d, "init", "--adopt", "--no-karpathy").stdout
        self.assertIn("adopt mode:", out)
        for f in ("inventory.md", "inventory.json", "restructure-plan.md"):
            self.assertTrue(os.path.isfile(os.path.join(self.d, "docs", "adopt", f)), f)
        gate = tracker(self.d, "gate", "plan").stdout
        for gid in ("inventory-read", "behaviour-pinned", "restructure-plan"):
            self.assertIn("[ ] " + gid, gate)
        self.assertNotIn("[n/a] behaviour-pinned", gate)

    def test_the_adopt_only_checks_do_not_exist_for_a_project_started_from_an_idea(self):
        tracker(self.d, "init", "--no-karpathy")
        gate = tracker(self.d, "gate", "plan").stdout
        self.assertIn("[n/a] behaviour-pinned", gate)
        status = tracker(self.d, "status").stdout
        self.assertIn("gate 0/9", status.split("plan")[1].split("\n")[0], "plan still has its 9 checks")

    def test_running_adopt_later_switches_the_checks_on_and_never_overwrites_the_plan(self):
        tracker(self.d, "init", "--no-karpathy")
        tracker(self.d, "adopt")
        plan = os.path.join(self.d, "docs", "adopt", "restructure-plan.md")
        with open(plan, "a", encoding="utf-8") as f:
            f.write("\nMY OWN NOTE\n")
        tracker(self.d, "adopt")
        self.assertIn("MY OWN NOTE", open(plan, encoding="utf-8").read())
        self.assertIn("[ ] behaviour-pinned", tracker(self.d, "gate", "plan").stdout)

    def test_evidence_for_an_adopt_check_must_still_name_a_real_file(self):
        tracker(self.d, "init", "--adopt", "--no-karpathy")
        bad = tracker(self.d, "gate", "plan", "--pass", "behaviour-pinned", "--evidence", "tests/pinning.test.js: 12 passed", check=False)
        self.assertNotEqual(bad.returncode, 0, "a missing file is refused as evidence")
        write(self.d, "tests/pinning.test.js", "test('pins', () => {})\n")
        ok = tracker(self.d, "gate", "plan", "--pass", "behaviour-pinned", "--evidence", "tests/pinning.test.js: 12 passed")
        self.assertIn("[x] behaviour-pinned", ok.stdout)

    def test_status_lists_the_four_checks(self):
        tracker(self.d, "init", "--adopt", "--no-karpathy")
        out = tracker(self.d, "adopt", "status").stdout
        for gid in ("inventory-read", "behaviour-pinned", "restructure-plan", "restructure-steps-proven"):
            self.assertIn(gid, out)

    def test_status_before_adopt_says_so(self):
        tracker(self.d, "init", "--no-karpathy")
        self.assertIn("not in adopt mode", tracker(self.d, "adopt", "status").stdout)

    def test_the_plan_template_asks_for_the_things_that_make_a_restructure_safe(self):
        t = A.plan_template()
        for need in ("Behaviour that must not change", "Proof behaviour is unchanged", "Undo", "never both"):
            self.assertIn(need, t)


if __name__ == "__main__":
    unittest.main()
