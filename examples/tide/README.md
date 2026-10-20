# Tide

A focus timer shaped like a glass of water. The liquid drains as time passes; the digits roll like an odometer; each mode is its own colour world.

| Focus | Short break | Long break | Phone |
|---|---|---|---|
| ![focus](docs/focus.png) | ![short break](docs/break.png) | ![long break](docs/long-break.png) | ![phone](docs/phone.png) |

Built as a test of HyperSkill's "make something with crazy UI and test it" flow. Static page, no runtime dependencies, no build step.

## Run it
```
npm start        # http://127.0.0.1:4173/ (set PORT to change)
```

## Use it
`Space` start or pause, `R` reset, `1` `2` `3` switch mode, `S` lengths, `M` sound (off by default). While a session is running or paused, R and 1 2 3 are ignored so a stray key cannot throw it away: use the Reset or mode buttons. Touch the glass to stir it. Lengths and sound are saved in your browser if it allows storage; without storage it still works.

## How it works
- `timer.js`: pure state machine. It stores a deadline timestamp, not a counter, so a sleeping tab never loses time. The clock is injected, so it is unit tested without waiting.
- `liquid.js`: canvas 2D renderer (waves, bubbles, ripples, splash). With reduced motion it never starts an animation loop; it redraws the glass once a second instead.
- `styles.css`: colours are registered `@property` values, so a mode change cross-fades the whole page. Contrast is checked by a test.

## Tests
```
npm test              # 22 unit tests (timer, palette contrast, dev server)
npm run test:e2e      # 28 real-browser tests (Playwright + axe-core)
npm run mutation      # breaks the timer logic 10 ways; every one must be caught
npm run secret-scan   # looks for committed secrets
```
The browser tests drive a fake clock, so a 25-minute session runs in seconds. They cover: timing, sleeping tabs, keyboard use, settings and validation, blocked storage and tampered storage, odometer digits, liquid animation, touch, reduced motion, offline use, privacy (no request after load, no cookie) and accessibility in every mode. They need a Chromium (`CHROME_PATH=/path/to/chrome`).

Measured in headless software rendering: about 14 frames per second (it was about 7 before an optimisation; see `docs/scale.md`). Not measured on a real GPU or phone.

## More
`docs/research.md`, `docs/system-design.md`, `docs/design-review.md`, `docs/security/threat-model.md`, `docs/operations.md`, `docs/scale.md`, `docs/runbooks/incident.md`, `docs/launch/`. Privacy and terms: the page's own `privacy.html`.
