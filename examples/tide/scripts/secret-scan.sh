#!/usr/bin/env bash
# Scan for committed secrets. No dependencies.
#   scripts/secret-scan.sh FILE...        scan files (used by the pre-commit hook on staged files)
#   scripts/secret-scan.sh --history      scan every commit that touched Tide (examples/tide and its deployed copy site/tide)
# Exit 1 and print file:line when something matches. Placeholders in .env.example and the tests are allowed.
set -uo pipefail
PATTERNS='AKIA[0-9A-Z]{16}|-----BEGIN (RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----|ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|xox[baprs]-[A-Za-z0-9-]{10,}|sk_(live|test)_[A-Za-z0-9]{16,}|SESSION_SECRET=[A-Za-z0-9+/=_-]{24,}|(password|passwd|secret|api[_-]?key|token)[A-Za-z0-9_]*[[:space:]]*[:=][[:space:]]*["'"'"'][A-Za-z0-9+/=_-]{16,}["'"'"']'
# Anchored: only these exact locations of THIS project are exempt (a bare "tests/" would exempt any path containing it).
ALLOW='(^|/)examples/tide/(\.env\.example|(tests|e2e)/|scripts/(mutation-check|loadtest)\.js|scripts/secret-scan\.sh)'
if [[ "${1:-}" == "--history" ]]; then
  # Track the file each diff line belongs to (from the "+++ b/<path>" header) so the allowlist applies to paths, not to text.
  hits=$(git log --all -p --no-color -- :/examples/tide :/site/tide 2>/dev/null | awk '/^\+\+\+ b\//{f=substr($0,7);next} /^\+/{print f"\t"$0}' \
    | grep -E "$PATTERNS" | awk -F'\t' -v allow="$ALLOW" '$1 !~ allow {print}' | head -20)
  commits=$(git rev-list --all -- :/examples/tide :/site/tide | wc -l)
  if [[ "$commits" -eq 0 ]]; then echo "history scan looked at 0 commits: the path filter is wrong, so this proves nothing"; exit 2; fi
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
