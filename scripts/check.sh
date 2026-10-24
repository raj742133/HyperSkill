#!/usr/bin/env bash
# One command that says whether the repository is fit to push: the whole test suite, the plugin validator, shell and JavaScript syntax.
# Used by the pre-push hook (scripts/install-git-hooks.sh) and by .github/workflows/ci.yml, so a regression is caught on your machine
# even when no hosted CI is available. Needs python3; uses `claude` and `node` when they are installed and says so when they are not.
set -u
cd "$(dirname "$0")/.."
fail=0
step() { printf '\n== %s\n' "$1"; }

step "unit tests"
out="$(mktemp)"
python3 -m unittest discover -s tests >"$out" 2>&1
tail -n 4 "$out"
grep -q '^OK' "$out" || { fail=1; grep -E '^(FAIL|ERROR):' "$out"; echo "(full output: $out)"; }

step "shell syntax"
for f in scripts/*.sh .githooks/*; do [ -f "$f" ] && bash -n "$f" || { echo "bad: $f"; fail=1; }; done

step "JavaScript syntax"
if command -v node >/dev/null; then
  for f in site/app.js site/live/live.js; do node --check "$f" || fail=1; done
else
  echo "node not installed: skipped"
fi

step "plugin manifest"
if command -v claude >/dev/null; then
  claude plugin validate . 2>&1 | tail -n 3
  claude plugin validate . >/dev/null 2>&1 || fail=1
else
  echo "claude not installed: skipped"
fi

step "generated site data is current"
python3 scripts/build_site.py >/dev/null 2>&1 && git diff --quiet -- site/data.js || { echo "site/data.js is out of date: run python3 scripts/build_site.py and commit it"; fail=1; }

if [ "$fail" -eq 0 ]; then printf '\nAll checks passed.\n'; else printf '\nSomething failed: do not push yet.\n'; fi
exit "$fail"
