import os
import re
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPTS = os.path.join(ROOT, "scripts")
# Calls that exist only on POSIX systems: each must be guarded (hasattr, os.name, a try/except around an import) on the same line or just above it.
POSIX_ONLY = re.compile(r"\b(os\.killpg|os\.geteuid|os\.getuid|os\.getgid|os\.fork|os\.setsid|os\.getpgid|signal\.SIGKILL|signal\.SIGSTOP|signal\.SIGUSR1|fcntl\.|preexec_fn|start_new_session)")
GUARD = re.compile(r"(hasattr\(|os\.name|sys\.platform|try:|except|fcntl is None|if fcntl|def _signal_group|import fcntl|fcntl = None)")


class PortabilityTests(unittest.TestCase):
    def test_posix_only_calls_are_guarded(self):
        problems = []
        for fn in sorted(os.listdir(SCRIPTS)):
            if not fn.endswith(".py") or fn.startswith(("build_", "capture", "vendor", "make_", "preview_", "render", "sync", "audit_", "fetch_")):
                continue
            lines = open(os.path.join(SCRIPTS, fn), encoding="utf-8").read().split("\n")
            for i, line in enumerate(lines):
                if line.lstrip().startswith("#") or not POSIX_ONLY.search(line):
                    continue
                window = "\n".join(lines[max(0, i - 4):i + 1])
                if not GUARD.search(window):
                    problems.append("%s:%d %s" % (fn, i + 1, line.strip()[:90]))
        self.assertEqual(problems, [], "POSIX-only call without a guard (Windows has no such call): " + "; ".join(problems))

    def test_hook_commands_find_python_by_either_name(self):
        text = open(os.path.join(ROOT, "hooks", "hooks.json"), encoding="utf-8").read()
        self.assertNotIn('"python3 ', text, "Windows usually has `python`, not `python3`")
        self.assertIn("command -v python3 || command -v python", text)

    def test_text_files_are_written_and_read_as_utf8(self):
        bad = []
        for fn in sorted(os.listdir(SCRIPTS)):
            if not fn.endswith(".py"):
                continue
            for i, line in enumerate(open(os.path.join(SCRIPTS, fn), encoding="utf-8").read().split("\n"), 1):
                if re.search(r"\bopen\([^)]*['\"][wa]['\"][^)]*\)", line) and "encoding" not in line and "'wb'" not in line and '"wb"' not in line and "newline" not in line:
                    bad.append("%s:%d" % (fn, i))
        # Windows opens text files in the system code page unless told otherwise; the tracker's own files must say UTF-8
        core = [b for b in bad if b.startswith(("hyperskill.py", "hs_activity.py", "hs_live.py", "hs_code.py", "hs_e2e.py", "hs_adopt.py", "hs_control.py"))]
        self.assertEqual(core, [], "open() for writing without encoding= in the core files: " + ", ".join(core))


if __name__ == "__main__":
    unittest.main()
