---
description: Explain an idea as an interactive, crafted isometric figure with the bundled Anatomy skill
argument-hint: "<the idea to explain>"
---

Build a figure that explains the idea in `$ARGUMENTS`, using the Anatomy skill that is bundled with this plugin.

1. Run `python3 ${CLAUDE_PLUGIN_ROOT}/scripts/hyperskill.py integrations resolve explainer-figure`. It should name `anatomy`. If the idea is only a list or a flow, say so and draw a plain diagram instead.
2. Read `${CLAUDE_PLUGIN_ROOT}/skills/anatomy/SKILL.md` and follow it exactly: size the figure first (Figure, Hero or Epic) and say the size; do not start an Epic without the owner's go-ahead; collect the true numbers before any geometry; invent the object; write the parts list; build; check.
3. Work in the project, not in the plugin folder. Copy the example closest to the idea from `${CLAUDE_PLUGIN_ROOT}/skills/anatomy/examples/` and the kit from `${CLAUDE_PLUGIN_ROOT}/skills/anatomy/kit/` into `docs/figures/<name>/`, and run the skill's scripts from the plugin folder against that copy. Node 20.10 or later is needed, and Chrome or Chromium for the checks.
4. Every number the figure shows must come from a file or a measurement, as everywhere in HyperSkill. Run the skill's checks and look at the screenshots at 1x and zoomed.
5. Report what was built, which checks passed and anything not tested, and record the evidence in the gate that asked for the figure.
