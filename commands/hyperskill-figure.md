---
description: Explain an idea as an interactive isometric figure, built from real data and checked in a browser
argument-hint: "<the idea to explain>"
---

Build an interactive figure that explains the idea in `$ARGUMENTS`, following the `hs-figure` skill.

1. Run `python3 ${CLAUDE_PLUGIN_ROOT}/scripts/hyperskill.py integrations resolve explainer-figure` and use the provider it names. If it names `hyperskill-figure`, read `${CLAUDE_PLUGIN_ROOT}/skills/hs-figure/SKILL.md` and `references/craft.md` and continue below. If the owner has enabled `anatomy` and the figure needs WebGL or true 3D, use that skill instead. If neither is available or the idea is only a list or a flow, draw a plain diagram and say why.
2. Say the size (Figure, Hero or Epic) and the one sentence: what moves, and what that motion means. Ask before building anything bigger than a Figure.
3. Work in the project, not in the plugin folder: copy `${CLAUDE_PLUGIN_ROOT}/skills/hs-figure/kit` and `examples/canal` to `docs/figures/<name>/` and adapt the copy. Write the data model first and test it. Every number the figure shows must come from a file or a measurement.
4. Run the unit tests, `node build.mjs --audit` and, with Chrome and playwright-core available, `verify.mjs`. Look at the screenshots at 1x and zoomed, in light, dark and at 390px.
5. Report what was built, which checks passed, and anything not tested. Record the evidence in the gate that asked for the figure.
