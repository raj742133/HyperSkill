---
description: Start or resume the HyperSkill pipeline (research to launch to scale)
argument-hint: "[idea or phase]"
---

Invoke the `hyperskill` skill and follow it. Arguments: $ARGUMENTS

- If there is no `.hyperskill/state.json` in this project, treat the arguments as the project idea and initialise.
- If state exists, show `status`, then continue the current phase (or the phase named in the arguments, after confirming with the user if it skips ahead).
