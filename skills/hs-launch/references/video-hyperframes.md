# Making videos with HyperFrames

HyperFrames renders HTML/CSS/JS compositions to video. The CLI commands below are the ones documented in the starter kit the plugin author supplied; run `npx hyperframes --help` and `npx hyperframes doctor` to confirm what your installed version supports before relying on any flag.

## Setup (once per machine)
1. Node.js 22+, FFmpeg, and (only for speech-timed work) whisper-cpp.
2. `npx hyperframes skills` installs the HyperFrames skills for Claude Code; restart the session afterwards.
3. `npx hyperframes doctor`; ignore items it marks optional (Docker, TTS, music generation).
Mac: Homebrew. Windows: winget, and the whisper.cpp release from its GitHub page added to PATH. Anything needing a password or admin rights is the user's to run - give the exact command.

## Per project
- New empty folder per video. Copy fonts into `fonts/` (local files, never rely on a CDN at render time). Put real screenshots in `screenshots/`, and optionally a sound folder `sfx/`.
- State size and fps explicitly in the brief: 1920x1080 @30 (landscape), 1080x1920 @30 (vertical).
- Render into `renders/<name>.mp4`.

## Brief pattern (works for every deliverable)
Write the brief to `launch/brief.md` first, then give HyperFrames' skill:
1. **Format:** duration, size, fps, output path.
2. **Material:** exact script text (do not let it rewrite your words), exact screenshots, exact numbers.
3. **Structure:** timecoded beats (0-2s hook, then one idea per screen, end card with CTA).
4. **Style:** one preset from `styles.md` (or brand colours/fonts) - never mix.
5. **Constraints:** safe margins, minimum time on screen, things to avoid.

## Deliverable recipes

**Text-only explainer (vertical, ~15 s).** One sentence per screen, big enough for a phone, all text inside the middle ~80% of the width, long sentences wrapped over 2-3 lines on the same screen, each screen held long enough to read. Use the user's exact script.

**Product launch (landscape, ~12 s).** 0-2 s name/logo reveal; 2-9 s three feature moments, each *showing* the product doing the thing (real screenshot or HTML rebuild), not a sentence; 9-12 s end card: name, one line, CTA. Use `product.png` if provided, else build the product UI in HTML/CSS.

**SaaS promo (landscape, up to ~60 s).** Look at every screenshot first and write down what each shows. Open with a short hook; for each screen zoom into the part that matters (the number, the chart, the button) with a one-line customer benefit; use screenshots **as they are** (don't redraw); steady-beat cuts; end on logo + line + CTA.

**Motion graphics over your own footage.** Keep the clip untouched (size, fps, audio, cut). Transcribe with `npx hyperframes transcribe` and check word timings against the audio; decide which moments matter; at each, add an animation fitted to what is being said (a number -> counter, a list -> checklist, before/after -> comparison) that starts on the exact word. One style throughout. Nothing in the first 3 seconds. Keep graphics off the face, out of the bottom third (captions), and away from the left/right 10%. Stop and ask the user to install whisper if it's missing.

**Targeted fix.** "At the words '...', show these 5 screenshots one after another in order, synced to the voice. Keep everything else identical and re-render."

**Sound effects.** Use the `sfx/` files: tick for list items/checks, a counter sound while numbers roll, a chime on the last card; none for slides/exits; quiet under voice; confirm licence of each file.

**Transparent overlay.** Make the background transparent, then export a ProRes 4444 `.mov` and a PNG sequence for Premiere/After Effects. MOV/PNG are only transparent if the composition background is.

## Export cheat sheet (from the kit; verify flags)
```
npx hyperframes render . -o renders/video.mp4
npx hyperframes render . --fps 60 -o renders/video-60fps.mp4
npx hyperframes render . --resolution 4k -o renders/video-4k.mp4
npx hyperframes render . --format mov -o renders/video.mov
npx hyperframes render . --format png-sequence -o renders/frames
npx hyperframes render . --crf 23 -o renders/smaller.mp4
```

## Verify every render (do not skip)
```
ffprobe -v error -show_entries stream=width,height,r_frame_rate,duration -of default=nw=1 renders/<name>.mp4
ffmpeg -v error -ss <t> -i renders/<name>.mp4 -frames:v 1 frames/<t>.png     # grab frames at key beats
```
Look at the frames: text readable and inside safe margins, nothing overlapping a face, correct fonts, CTA visible on the last frame. Fix and re-render before reporting.
