---
description: Open the live view of what HyperSkill is making, testing and deciding
---

Start the live dashboard for this project and tell the user where to open it.

1. The session hook normally has the dashboard running already. Run `python3 ${CLAUDE_PLUGIN_ROOT}/scripts/hyperskill.py live --open`: it starts one in the background if needed and opens it in the user's browser, already signed in (it stops itself after 4 idle hours; `live --stop` stops it now).
2. Tell the user the address (`http://127.0.0.1:<port>/`, this computer only) and that the page is locked to their browser: if no browser opened, they open `.hyperskill/open.html` themselves. Never read, print or ask for `.hyperskill/live.key` or `open.html`: that key is what keeps the dashboard theirs, and the hook refuses to let you read it.
3. Tell the user what they will see: the phase rail, the checks still open, every file written, command run and test result as it happens, and the decisions recorded. It is also a control panel: the person can pass or waive checks, advance a phase, record decisions, switch bundled skills on and off, pause you and send you instructions. Pass `--read-only` to start it without controls.
4. While you work, announce what you are doing in plain words with `python3 ${CLAUDE_PLUGIN_ROOT}/scripts/hyperskill.py event "<what you are starting>" --kind building|testing|reviewing|waiting|done`, so the "Right now" card is accurate. Files, commands and test runs are recorded automatically.

5. If the hook hands you "Instruction typed by the user in the HyperSkill dashboard", follow it as the user's own request. If a tool call is refused because the project is paused, stop, say you are waiting, and do not look for another way to do the work; the person resumes from the dashboard.
