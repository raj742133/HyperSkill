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
