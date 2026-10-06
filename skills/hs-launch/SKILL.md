---
name: hs-launch
description: HyperSkill phase 7 - go-live audit plus promo content - produces product, promo, text-only and screenshot-driven videos with HyperFrames, publishes legal pages, and runs the pre-launch checklist. Use when preparing a launch, making a product/promo/demo video or motion graphics, adding graphics to a recorded clip, or doing a final pre-launch audit.
---

# Phase 7 - Launch (promo and go-live audit)

Goal: tell the truth about the product, beautifully, and confirm nothing was forgotten. Two tracks; do both.


**Slots:** run `hyperskill.py integrations phase launch` and follow `hyperskill/references/integrations.md` for the providers it names.

## Track A - Go-live audit
Work through `references/prelaunch.md`. Every unticked item is either fixed or waived with a reason. Publish terms of service and a privacy policy (have the owner or counsel review; do not present generated legal text as legal advice).

## Track B - Promo content
Details and prompt patterns: `references/video-hyperframes.md`. Style presets: `references/styles.md`.

### Owner decisions
- Which deliverable(s): hero/promo video (16:9), vertical social cut (9:16), text-only explainer, demo of a feature, motion graphics layered on a recorded clip.
- Style preset (or brand colours/fonts), target length, call to action, platform(s).
- Real material: screenshots of the real product, real numbers, real quotes. **Never** invent metrics, testimonials, customers or features.

### Steps
1. **Check the tooling** (`video` slot). Preferred provider: **HyperFrames** (Apache-2.0), installed as a plugin (`claude plugin marketplace add heygen-com/hyperframes`) or via `npx skills add heygen-com/hyperframes` - offer, do not install unasked. It ships ~21 skills; when installed, **use its own skills for the build** (`/product-launch-video` for launch films, `/faceless-explainer` for explainers, `/embedded-captions`, `/talking-head-recut` for overlays on footage, `/motion-graphics` for short pieces) and keep this phase's brief, honesty rules and verification around them. Needs Node 22+ and FFmpeg (and whisper for speech-timed work); `npx hyperframes doctor` reports what is missing. Do not clone the whole repo (Git LFS test videos). Anything needing admin rights: give the user the command.
   Not installed and declined? Produce the storyboard only and stop at step 3.
2. **Capture truth first.** Collect screenshots (real product, via the `browser-verify` slot), the three things the product does best, the real numbers, the CTA. Save under `launch/screenshots/`.
3. **Script and storyboard** in `launch/storyboard.md`: hook in the first 2 seconds, one idea per screen, show the result before explaining it, end on CTA. Get the user's approval before rendering.
4. **Build** with HyperFrames' skills, following the brief pattern in `references/video-hyperframes.md` (fonts local, one style, safe margins, nothing important outside the safe area).
5. **Render and inspect.** Render to `renders/`, then actually check the output (`ffprobe`, extracted frames at key timestamps, viewed) before reporting done. If the `video-analysis` slot resolves (`/watch`, opt-in), use it to watch your own render and compare what it sees and hears with the storyboard. Ask the user to watch it end to end.
6. **Sound (optional).** Quiet ticks/chimes only; keep effects under any voice; check licences of any music/sfx used. For voiceover use the `voiceover` slot (Qwen3-TTS, opt-in) or the owner's own recording: get written consent before cloning any voice, and say in the video description that the voice is synthetic.
7. **Variants.** Re-render other aspect ratios/frame rates/transparent overlays only as requested.

## Pitfalls
- Claims the product can't back up. Every on-screen claim maps to a real feature or number.
- Text outside phone-safe margins; screens that flash by faster than they can be read (aim >= ~0.3 s per word, a short line per screen minimum 1.5 s).
- Mixed styles in one video. Pick one preset.
- Using AI-generated people or voices without disclosure, or footage/music without licence.
- Using noncommercial-licence tools (e.g. `onetake`) for a commercial product: the resolver blocks it; do not route around it.
- Reporting "rendered" without having looked at frames.

## Gate
`hyperskill.py gate launch`. Evidence: the render path + ffprobe output + frames inspected, the legal page URLs, the licence list, the completed prelaunch checklist.
