---
description: Run the verification gate for a phase (default - the current phase)
argument-hint: "[phase]"
---

Work the gate for phase "$ARGUMENTS" (if empty, the current phase from `hyperskill.py status`).

1. `python3 ${CLAUDE_PLUGIN_ROOT}/scripts/hyperskill.py gate <phase>` to list items.
2. For each open item, actually run the check and capture the output. Do not mark anything from memory or by reading code alone when a command can prove it.
3. Record with `gate <phase> --pass <ids> --evidence "<command + result>"`. Items that cannot be done honestly stay open or are waived only with the user's agreement and a stated reason.
4. If everything is clear, run `advance`.
For security-sensitive or test-quality items, use the `hs-reviewer` agent so the check comes from a fresh context.
