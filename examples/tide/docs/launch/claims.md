# Claims check: Tide

Every claim made about Tide in public copy, and what shows it is true today (2026-10-20). Copy checked: the page's description, `privacy.html`, `README.md`, and the line on the HyperSkill site footer.

| Claim | Where | Evidence |
|---|---|---|
| "A focus timer shaped like a glass that drains as time passes" | page description, README, site footer ("glass of water") | Browser test "the glass drains in step with the clock: full, about half, empty" |
| "Pomodoro lengths you can change" | page description | Browser test "lengths: saved, validated, applied at once, kept after reload"; limits 1-120 and 1-60 minutes |
| "Keyboard first" | page description | Browser tests for shortcuts, the radio group and keyboard-only flow |
| "No accounts, no tracking" | page description, privacy page | No login code exists; browser test "no request after the page loads, no cookie, and the strict policy is in force" |
| "The digits roll like an odometer", "each mode is its own colour world" | README | Browser tests "the digits roll", "each mode is its own world" |
| "A sleeping tab never loses time" | README | Browser test "a tab that sleeps does not lose time"; time comes from a deadline. **Limit:** a frozen tab gives no alert until it wakes (stated in system-design.md) |
| "Stores only your lengths, sound setting and today's finished count, in your browser" | privacy page | `app.js` save() calls; `clean()` drops anything else; browser test with tampered storage |
| "After the page has loaded it makes no requests at all" | privacy page | The same privacy browser test |
| "It sends no notifications" | privacy page | No Notification API call exists (`grep -n Notification app.js` is empty) |
| "Sound is off by default" | README | Browser test: the sound button starts `aria-pressed=false` |
| "About 14 frames per second in headless software rendering" | README | `docs/scale.md`, measured three times |

**Claims deliberately not made:** that the Pomodoro method works (no evidence was found), that it works well on phones (not measured on a device), that it is accessible to screen-reader users (automated checks only), any user count, testimonial or comparison with other timers.
