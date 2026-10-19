# Choosing a look for a promo video

Commit to one look per video and paste its block into `launch/brief.md` under "Look". If two scenes want different treatments, change the scene, not the style. Pick your own hex codes and record them in the brief.

## Match the look to the job

- **Announce:** a few seconds, one message.
- **Demonstrate:** show how the product behaves.
- **Narrate:** tell a story or make an argument.
- **Delight:** win a casual or consumer audience.
- **Brand block:** the owner already has a brand (last section).

## The four starting looks

**Announce.** Words are the picture. Very large condensed or heavy type, no containers. Two colours plus one highlight, reserved for a single word per screen. Motion is quick and decisive: words land on the beat, stay just long enough to read, then leave.

**Demonstrate.** The product UI is the hero and the frame stays out of its way. Light, low-contrast neutrals, one accent for emphasis, a single readable sans at two or three sizes. Panels are subtly raised, not decorated. Motion is slow-in, slow-out, small distances, no bounce; a gentle zoom toward the relevant region does the storytelling.

**Narrate.** A calm, printed feel. Warm off-white ground, dark ink, one muted accent. A serif for statements, a small tracked sans or mono for labels; faint texture and thin rules at most. Motion is unhurried: soft wipes, uneven staggers, long holds.

**Delight.** Flat and cheerful. Two or three saturated colours on a dark neutral, heavy outlines, hard offset shadows, simple geometric stickers. Motion has personality: overshoot, squash, wobble. Keep copy short or the energy turns to noise.

## Rules for all of them

- Ship font files, declare them with `@font-face`, and log each licence in `launch/licences.md`. HyperFrames pre-bundles a few families (for example Montserrat, Oswald, League Gothic, Archivo Black, Space Mono); avoid the most generic defaults.
- Text must pass WCAG AA contrast (`npx hyperframes check` audits it) and stay inside the 80% safe box from `video-hyperframes.md`.
- Reading time sets motion speed, never the reverse.
- A look decorates real content: no invented numbers, logos or quotes.

## Brand block

Save as `launch/style.md`, and copy it into the project's `frame.md` or `design.md`, which HyperFrames reads:

- Background, surface, text and accent hex values
- Heading and body fonts, with file names and licences
- Corner radius and border treatment
- Motion character: calm, brisk or bouncy
- Do-not-use list (colours, words, imagery)
