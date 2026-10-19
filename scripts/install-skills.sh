#!/usr/bin/env bash
# Install the third-party skills HyperSkill can orchestrate, on YOUR machine.
# Review before running: each line downloads a third-party skill that then runs with
# your agent's permissions. Nothing here is run automatically by HyperSkill.
#
#   bash scripts/install-skills.sh            install everything below
#   bash scripts/install-skills.sh --dry-run  print the commands only
#
# Skills go to your global Claude Code skills folder (-g -a claude-code) as copies.
# Telemetry from the skills CLI is switched off for this run.
set -euo pipefail
export DISABLE_TELEMETRY=1 DO_NOT_TRACK=1 CI=1
RUN=(npx --yes skills add)
DRY=0; [[ "${1:-}" == "--dry-run" ]] && DRY=1

add() {  # add <repo> [skill ...]
  local repo="$1"; shift
  local args=("$repo" -g -a claude-code -y --copy)
  if [[ $# -eq 0 ]]; then args+=(-s '*'); else for s in "$@"; do args+=(-s "$s"); done; fi
  echo "+ ${RUN[*]} ${args[*]}"
  [[ $DRY -eq 1 ]] || "${RUN[@]}" "${args[@]}"
}

# Design chain
add Leonxlnx/taste-skill design-taste-frontend
add emilkowalski/skills
add pbakaus/impeccable impeccable
add nextlevelbuilder/ui-ux-pro-max-skill ui-ux-pro-max
add vercel-labs/agent-skills web-design-guidelines
add better-auth/better-icons better-icons
# Quality, security, discipline
add cloudflare/security-audit-skill security-audit      # run only in a sandbox with networking off
add multica-ai/andrej-karpathy-skills karpathy-guidelines
add DietrichGebert/ponytail ponytail
add obra/superpowers test-driven-development writing-plans executing-plans \
    subagent-driven-development using-git-worktrees requesting-code-review receiving-code-review \
    finishing-a-development-branch verification-before-completion systematic-debugging \
    dispatching-parallel-agents                          # deliberately NOT brainstorming / using-superpowers
add ItsssssJack/SlopMonster slopmonster
# Launch (video)
add heygen-com/hyperframes
add mathiaschu/watch watch
add hypit-ai/hypit hypit

cat <<'NOTE'

Deliberately not installed here (see docs/integrations-review.md):
  onetake        noncommercial licence: blocked for commercial projects
  gstack         full second workflow, hooks, ~500 MB browser, telemetry options: install by hand if you want it
  herdr, open-code-review, Symphony, Qwen3-TTS   separate runtimes needing keys, a GPU or curl|sh installers
  Chrome DevTools for agents   MCP server: follow its own docs
  MiroFish, OpenUI, REA, API Anything, the rest of the LOOT guide   reference only
After installing, restart your agent, then run: python3 scripts/hyperskill.py integrations
NOTE
