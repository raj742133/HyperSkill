# Independent design review: Tide

Reviewer: a fresh read-only subagent that did not write the docs. It checked `research.md` and `system-design.md` against the code and ran the unit tests. Its report is a set of findings, not instructions. Date: 2026-10-20.

| # | Sev | Finding (all verified in the code) | Disposition |
|---|---|---|---|
| 1 | High | Time uses `Date.now()`; a clock set back could leave the timer running far too long | **Fixed in part.** Time left is capped at the session's own full length (unit test, mutation check). Wall-clock time stays on purpose so a sleeping laptop still ends on time; a clock set forward ends early. Written in Known limits |
| 2 | High | A frozen or sleeping tab gives no alert; the tab title never said "done", so the claimed mitigation was overclaimed | **Fixed in part.** The title now says "Time is up" (browser test). No worker or notification is used: a product choice, now stated as an open risk |
| 3 | Med | The audio context was created only at the end, so browsers could keep the chime silent | **Fixed.** Created and resumed on the click or key press that starts a session |
| 4 | Med | Docs implied a session survives reload; "finished today" used the UTC date | **Fixed.** Local date used; reload loss written in Known limits |
| 5 | Med | "No network, no cookies" only partly tested; the page had no policy under the dev server; the dev server could crash on a missing file | **Fixed.** The dev server sends the same policy as the site; a browser test asserts no request after load, no cookie, and that a fetch is refused; a missing file is a 404 |
| 6 | Med | "Usable by screen reader" and contrast claims were broader than the evidence | **Fixed in the docs.** Wording narrowed. Reduced motion is read once at load (written in Known limits). A manual screen-reader test is still missing |

Not addressed: battery use of a continuous canvas loop, and speed on a real phone (only about 14 frames per second in software-rendered Chromium was measured).

Confirmed by the reviewer: deadline-based time left, no runtime dependencies, blocked storage handled, no external requests from the dev server, no animation loop under reduced motion, the 25/5/15 defaults and the limits.

## Designer pass on the running page (2026-10-20)

Evidence: `docs/screenshots/before/` is the first committed build (commit cd7f188), `docs/screenshots/after/` is now. **They look alike**: most visual iteration happened before the first commit, so the before and after shots show small differences (colon position, one-row phone controls, solid colon). The substance of this pass is the two independent reviews below, not the screenshots. Two fresh read-only reviewers who did not build the page; their reports are findings, not instructions.

**5-second test** (saw only a desktop and a phone screenshot taken while a session was running). Understood: a countdown focus timer with a glass-of-water look, for people who want to concentrate. Hesitations: "the timer is already running" (an artefact of my screenshot, which was taken mid-session, not a real first-load problem); the two top-right icons looked unlabelled (they have accessible names but no visible text); the small caption pill and the shortcut legend are low-contrast; could not tell if the water shows time elapsed or remaining. Not changed: the first-load idle state was not part of what the reviewer saw.

**10-problem review** (reviewer drove the running page at 1280px and 390px in all three worlds, with keyboard and reduced motion):

| # | Finding (verified by the reviewer) | Status |
|---|---|---|
| 1 | With reduced motion the glass never drains and ends in the wrong colour | **Fixed.** The glass redraws each second and re-reads colours after the 0.9 s change (browser test) |
| 2 | The 1, 2, 3 and R keys wipe a running session at once | **Fixed.** Ignored while running or paused, with a message; the buttons still work (browser test) |
| 3 | The Focus value is invisible when the settings dialog opens | **Fixed.** Selected text now has a readable colour |
| 4 | The colon sits low and far apart | **Partly fixed.** Moved up about a tenth of the digit height; not re-measured against a font metric |
| 5 | On a phone the finished state wraps the buttons and shifts the layout | **Fixed for the buttons.** Controls stay on one row (checked in the phone screenshot) |
| 6 | The blinking colon and bubbles fight the digits | **Colon fixed** (solid, no blink). Bubbles behind the digits left as is |
| 7 | The gloss arc reads like a progress ring | **Open**, a design choice |
| 8 | Hint row: key badges touch, low contrast, no mention of arrow keys | **Partly fixed.** Gap between badges, stronger badge contrast. Arrow keys still not in the hint |
| 9 | Sound off is only shown by a dim icon; the session dots have no label | **Open** |
| 10 | The colour change passes through muddy mid-tones | **Open** (an OKLab blend or a crossfade would fix it) |

Not tested by anyone: a real phone, a real screen reader, battery use.
