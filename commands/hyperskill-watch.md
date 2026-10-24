---
description: Watch a video (file or link) and answer a question about it, with the bundled hs-watch skill
argument-hint: "<video file or link> <what you want to know>"
---

Watch the video in `$ARGUMENTS` and answer from what you saw and heard.

1. Run `python3 ${CLAUDE_PLUGIN_ROOT}/scripts/hyperskill.py integrations resolve video-analysis`; it should name `hs-watch`.
2. Read `${CLAUDE_PLUGIN_ROOT}/skills/hs-watch/SKILL.md` and follow it: run `watch.py run` on the file or link, look at the contact sheet, then the frames the question needs (and the opening frames if the opening matters), then fill every pending marker in `report.md`.
3. If the link will not download, say so and ask for the file; never ask for browser cookies or logins.
4. Answer with times. Say what you could not see or hear. If there were no captions, say the speech was not available.
