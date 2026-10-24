---
name: hs-watch
description: Watch a video file or link so you can answer questions about what is on screen and what is said - cuts, the first ten seconds, a contact sheet, captions with timestamps. Use when the user shares a video, a screen recording of a bug, a competitor's ad or an Instagram, YouTube or TikTok link and wants it analysed, summarised or reproduced.
---

# hs-watch

HyperSkill's own video reader. It does one job: get a video into a form you can actually look at, then make you look at it before you answer. Standard library Python plus `ffmpeg` and `ffprobe`; `yt-dlp` is only needed for links.

## Run it

```
python3 ${CLAUDE_PLUGIN_ROOT}/skills/hs-watch/scripts/watch.py run <file-or-link> --question "<what the user asked>"
```

Optional: `--start 0:30 --end 1:10` to zoom into a stretch, `--captions file.vtt` when you already have them, `--max-frames N`, `--out DIR` (default `.hyperskill/watch/<name>/`).

It writes, and prints the paths of:

- `frames/t<seconds>.jpg` - one frame per detected cut, capped by length (24 for a short clip, 90 for a long one). Videos with few cuts (screen recordings, one long shot) are sampled evenly instead.
- `hook/h<seconds>.jpg` - the first ten seconds, two frames a second. The opening is where a video earns or loses attention; look at it when the question is about a hook, an ad or a launch.
- `sheet.jpg` - every frame on one page, for the overview.
- `report.md` - metadata, the frame list, the captions with times, and `<!-- pending -->` markers for the parts only you can write.

## Then look, in this order

1. Read `sheet.jpg` for the shape of the video.
2. Read the frames that matter to the question (all of them for a short clip, at least every frame around each change for a bug recording) and the `hook/` frames if the opening matters.
3. Fill every `pending` marker in `report.md`, citing times (`[01:12]`).
4. Answer from what you saw and heard. Say which parts you did not see.

## Rules

- **No captions and no audio reading means no claims about speech.** The tool does not transcribe; if `report.md` says no captions, say the speech was not available. Never invent what was said.
- **Links are fetched with yt-dlp, one video, no cookies, 500 MB cap, and never to a private address.** Do not pass browser cookies or a login to get a gated video: ask the owner to download it. Social platforms often block downloads; when a link fails, ask for the file.
- **Respect the source.** Analysing a public video for the user is fine; do not redistribute it, and do not copy its footage, music or text into the product.
- Frames are 512 px wide. For small on-screen text, rerun a short range with `frames --start --end --every 0.5` and read the frames at that size.
- Delete the work folder when the answer is done unless the user wants it kept (`.hyperskill/watch/` is git-ignored).

## Other commands

`probe VIDEO`, `frames VIDEO --out DIR [--every S]`, `hook VIDEO --out DIR`, `sheet DIR --out FILE`, `fetch URL --out DIR`, `captions FILE`.
