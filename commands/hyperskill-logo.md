---
description: Design or fix a logo and its icon set with the bundled hs-logo skill
argument-hint: "<what the logo is for, or the SVG to fix>"
---

Do the logo work in `$ARGUMENTS`.

1. Run `python3 ${CLAUDE_PLUGIN_ROOT}/scripts/hyperskill.py integrations resolve logo-design`; it should name `hs-logo`.
2. Read `${CLAUDE_PLUGIN_ROOT}/skills/hs-logo/SKILL.md` and follow its process: brief, word map, three concepts in SVG, `logo.py audit` and `logo.py test`, then look at `test-sheet.png`.
3. Stop at the concept checkpoint. Build the kit (`logo.py kit`) only after the owner has chosen a direction.
4. Record the idea, fonts and licence in `docs/brand.md`, and say plainly that no trademark search was done.
