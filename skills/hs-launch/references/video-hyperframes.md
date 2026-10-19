# Promo video with HyperFrames

HyperFrames turns an HTML composition into a rendered video. This file is the HyperSkill wrapper: what to prepare, what to hand over, what to check. HyperFrames' own skills do the building. Where they disagree with this file on mechanics, they win; where they disagree on honesty or evidence, the launch gate wins.

**Verification status.** Every command below was checked by reading the HyperFrames skill documentation installed locally (`hyperframes`, `hyperframes-cli`, `hyperframes-core`, `media-use`, `motion-graphics`, `hyperframes-studio`). None were executed. Items the documentation does not confirm carry `(unverified)` and are collected at the end. Run `npx hyperframes --help` on the installed version before trusting any flag.

## 1. Pick the workflow

| Deliverable | HyperFrames skill |
|---|---|
| Promo, feature reveal or tour from a URL or product brief | `/product-launch-video` |
| Explainer from text, no product capture | `/faceless-explainer` |
| Short unnarrated animation (title, stat, chart, lower-third), roughly under 10 s | `/motion-graphics` |
| Designed graphics over your own talking-head clip | `/talking-head-recut` |
| Captions only, on existing footage | `/embedded-captions` |
| Anything else, or longer multi-scene pieces | `/general-video` |

Start from `/hyperframes`: it interviews the owner, writes its own `BRIEF.md` at the project root, and routes. Our `launch/brief.md` (section 3) is input to that interview, not a replacement for it.

## 2. Machine and project setup

- Needs Node.js 22+ and FFmpeg/FFprobe. `npx hyperframes doctor` reports what is missing (`--json` for scripts; it always exits 0, so read its `ok` field). Docker matters only for `render --docker`; ignore other optional warnings.
- Chrome missing: `npx hyperframes browser ensure`. FFmpeg installed off `PATH`: set `HYPERFRAMES_FFMPEG_PATH` and `HYPERFRAMES_FFPROBE_PATH`.
- `npx hyperframes skills` installs the HyperFrames skill pack. Anything needing admin rights is the owner's to run; give the exact command.
- New project: `npx hyperframes init <name> --resolution landscape` (or `portrait`, `square`; 4K variants exist). `init` also accepts `--video` and `--audio`. From a live site: `npx hyperframes capture <url>`; treat a non-zero exit, `ok: false` or a `BLOCKED.md` as a stop.
- Expect this layout: `index.html`, `compositions/`, `assets/`, `renders/`, `hyperframes.json`, plus `BRIEF.md`, `STORYBOARD.md` and a design spec (`frame.md`, else `design.md`).
- Fonts: ship the file and declare it with `@font-face`. A handful of families are pre-bundled; others are fetched at build time, which can fail in cloud renders.

## 3. Brief pattern

Write `launch/brief.md` before any build, in five parts:

1. **Output:** length, canvas, fps, destination file.
2. **Verbatim material:** script text, screenshot files, numbers. State that none of it may be reworded or invented.
3. **Beats:** a time-coded outline, one idea per screen, a hook at the start, an end card with the call to action.
4. **Look:** one style from `styles.md`, or the owner's brand values. One only.
5. **Limits:** safe areas, minimum reading time, anything banned.

Safe areas follow Studio's own guides: keep everything visible inside the central 90% of the frame, and captions and key text inside the central 80%.

## 4. Recipes by deliverable

- **Text-led vertical explainer (about 15 s).** One sentence per screen, large enough for a phone, held long enough to read twice. Wrap long sentences rather than shrinking them.
- **Product reveal (landscape, about 12 s).** Name first, then three moments where the real product does something, then an end card. Use real screenshots or a faithful HTML rebuild of the real UI.
- **Longer SaaS promo (up to about a minute).** Describe each screenshot in writing first. Zoom to the one region that matters, pair it with one customer-benefit line, leave screenshots unaltered.
- **Graphics on your own footage.** Leave the clip as it is. Transcribe with `npx hyperframes transcribe clip.mp4 --model small.en`; always pass `--model`, and for non-English audio use `--model small --language <code>`, because the `.en` models translate. Add a graphic only where it earns its place, anchored to a spoken word, clear of faces and the caption band.
- **Single-moment fix.** Name the words ("when I say ..."), say what to show, say "everything else unchanged", re-check, re-render.
- **Transparent overlay.** Make the composition background transparent, then render `--format webm` or `--format mov`; `--format png-sequence` writes RGBA frames. Use solid cards: a blurred-glass card has nothing to blur on a transparent canvas (our reasoning, `(unverified)`).

## 5. Sound

Use `/media-use` rather than hand-collected files: `npx hyperframes media-use resolve --type sfx --intent "<what>" --project <dir>`. SFX search returns only CC0 or CC BY sounds; CC BY ones are credited in a `CREDITS.md` beside the files, and those credits travel with the video wherever it is published. Music search (`--type bgm`) needs the `heygen` CLI. Keep effects well under any voice. Voice: `--type voice` or `npx hyperframes tts`, with the consent and disclosure rules in `SKILL.md`.

## 6. Check, review, render

```
npx hyperframes lint                       # quick feedback while editing
npx hyperframes check --snapshots          # final gate: lint, runtime, layout, contrast; writes frames
npx hyperframes snapshot --at 1,5,9        # stills at chosen seconds
npx hyperframes preview --background       # Studio URL for the owner to review
npx hyperframes render --quality draft -o renders/draft.mp4
npx hyperframes render --quality delivery -o renders/final.mp4
```

Render only after the owner has reviewed the preview. Other documented flags: `--fps 24|30|60`, `--resolution` (for example `landscape-4k`), `--format mp4|webm|mov|gif|png-sequence|hls`, `--crf 0-51`, `--video-bitrate`, `--docker` for reproducible output. The render prints a summary; read its second line (capture path, GPU mode). If your tooling kills long commands, start the render detached with `HYPERFRAMES_RENDER_DETACHED=1`.

## 7. Prove the output

1. `test -s renders/final.mp4`, then `ffprobe -v error -show_format -show_streams renders/final.mp4`; compare duration and fps with the brief.
2. Pull stills at the opening, each key beat and the last second with plain FFmpeg: `ffmpeg -v error -ss <seconds> -i renders/final.mp4 -frames:v 1 frames/<name>.png` `(unverified)`.
3. Look at them: text readable and inside the 80% box, correct fonts, nothing over a face, CTA visible at the end, every claim backed by the real product.
4. Record each font, track, sound and footage item in `launch/licences.md` with source, licence and whether credit is required. Then the owner plays the whole film.

## 8. When it looks wrong

| Symptom | Move |
|---|---|
| Fallback font | Add the `@font-face` for a shipped file, rerun `check`. |
| Text clipped or crowded | Move it inside the 80% box; wrap rather than shrink. |
| Graphic late or early | Re-anchor to the spoken word; compare transcript timing with the audio. |
| Contrast or overlap findings | Read the `check` output and its crops before tuning by eye. |
| Render slow or heavy | `--quality draft` while iterating; lower fps or resolution; `--crf` for file size. |
| Render fails | `npx hyperframes doctor`, then `browser ensure`. |

`npx hyperframes feedback` posts to a public channel: keep product names and absolute paths out, or disable reporting with `npx hyperframes telemetry disable`.

## Unverified in this file

- The blurred-card-on-transparent explanation.
- The exact ProRes profile of `--format mov` (docs say ProRes for render, naming no profile).
- The `ffmpeg -ss ... -frames:v 1` frame grab (standard FFmpeg, absent from the HyperFrames docs; section 7).
- No timings, file sizes or render speeds are claimed; figures from the earlier source were dropped.
