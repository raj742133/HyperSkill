#!/usr/bin/env bash
# Scan for committed secrets. No dependencies.
#   scripts/secret-scan.sh FILE...        scan files (used by the pre-commit hook on staged files)
#   scripts/secret-scan.sh --history      scan every commit of the repository this is in
# Exit 1 and print file:line when something matches. Placeholders in .env.example and the tests are allowed.
set -uo pipefail
PATTERNS='AKIA[0-9A-Z]{16}|-----BEGIN (RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----|ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|xox[baprs]-[A-Za-z0-9-]{10,}|sk_(live|test)_[A-Za-z0-9]{16,}|SESSION_SECRET=[A-Za-z0-9+/=_-]{24,}|(password|passwd|secret|api[_-]?key|token)[A-Za-z0-9_]*[[:space:]]*[:=][[:space:]]*["'"'"'][A-Za-z0-9+/=_-]{16,}["'"'"']'
ALLOW='\.env\.example|/tests/|/e2e/|tests/|scripts/preview\.js|scripts/seed-demo\.js|scripts/loadtest\.js|scripts/two-instances\.js|scripts/secret-scan\.sh|scripts/mutation-check\.js'
if [[ "${1:-}" == "--history" ]]; then
  hits=$(git log --all -p --no-color 2>/dev/null | grep -nE "$PATTERNS" | grep -vE "$ALLOW" | head -20)
  commits=$(git rev-list --all | wc -l)
  if [[ -n "$hits" ]]; then echo "possible secrets in history:"; echo "$hits"; exit 1; fi
  echo "scanned $commits commits: no secret patterns found"; exit 0
fi
bad=0
for f in "$@"; do
  [[ -f "$f" ]] || continue
  [[ "$f" =~ $ALLOW ]] && continue
  if out=$(grep -nE "$PATTERNS" "$f" 2>/dev/null); then echo "$f:"; echo "$out"; bad=1; fi
done
exit $bad
