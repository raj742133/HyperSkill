#!/usr/bin/env bash
# Turn on the repository's git hooks (a pre-push check). Undo with: git config --unset core.hooksPath
set -eu
cd "$(dirname "$0")/.."
chmod +x .githooks/* scripts/check.sh
git config core.hooksPath .githooks
echo "pre-push check is on: every push now runs scripts/check.sh first (skip once with --no-verify)."
