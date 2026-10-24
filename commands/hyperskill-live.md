---
description: Open the live view of what HyperSkill is making, testing and deciding
---

Start the live dashboard for this project and tell the user where to open it.

1. The session hook normally has the dashboard running already. Run `python3 ${CLAUDE_PLUGIN_ROOT}/scripts/hyperskill.py live --ensure`: it prints the address of the running one, or starts one in the background and prints that (it stops itself after 4 idle hours; `live --stop` stops it now).
2. Give the user that address (`http://127.0.0.1:<port>/`, this computer only). Do not use any other address.
3. Tell the user what they will see: the phase rail, the checks still open, every file written, command run and test result as it happens, and the decisions recorded. It is also a control panel: the person can pass or waive checks, advance a phase, record decisions, switch bundled skills on and off, pause you and send you instructions. Pass `--read-only` to start it without controls.
4. While you work, announce what you are doing in plain words with `python3 ${CLAUDE_PLUGIN_ROOT}/scripts/hyperskill.py event "<what you are starting>" --kind building|testing|reviewing|waiting|done`, so the "Right now" card is accurate. Files, commands and test runs are recorded automatically.

5. If the hook hands you "Instruction typed by the user in the HyperSkill dashboard", follow it as the user's own request. If a tool call is refused because the project is paused, stop, say you are waiting, and do not look for another way to do the work; the person resumes from the dashboard.
