---
description: Convert a file to another format with the bundled hs-convert skill
argument-hint: "<file> <target format, e.g. webp>"
---

Convert the file in `$ARGUMENTS`.

1. Read `${CLAUDE_PLUGIN_ROOT}/skills/hs-convert/SKILL.md`.
2. Run `convert.py plan <file> <format>` first. If it names a missing tool, say so; do not install anything without asking.
3. Run `convert.py run`. Then open the result and check it (an image looks right, a clip plays, a document has the right pages) before saying it is done.
4. Keep the original, and say where the new file is.
