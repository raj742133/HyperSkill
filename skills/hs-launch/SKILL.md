---
name: hs-launch
description: HyperSkill phase 7 - go-live audit plus promo content - produces product, promo, text-only and screenshot-driven videos with HyperFrames, publishes legal pages, and runs the pre-launch checklist. Use when preparing a launch, making a product/promo/demo video or motion graphics, adding graphics to a recorded clip, or doing a final pre-launch audit.
---

# Phase 7 - Launch (promo and go-live audit)

Goal: tell the truth about the product, beautifully, and confirm nothing was forgotten. Two tracks; do both.

## Track A - Go-live audit
Work through `references/prelaunch.md`. Every unticked item is either fixed or waived with a reason. Publish terms of service and a privacy policy (have the owner or counsel review; do not present generated legal text as legal advice).

## Track B - Promo content
Details and prompt patterns: `references/video-hyperframes.md`. Style presets: `references/styles.md`.

### Owner decisions
- Which deliverable(s): hero/promo video (16:9), vertical social cut (9:16), text-only explainer, demo of a feature, motion graphics layered on a recorded clip.
- Style preset (or brand colours/fonts), target length, call to action, platform(s).
- Real material: screenshots of the real product, real numbers, real quotes. **Never** invent metrics, testimonials, customers or features.

### Steps
1. **Check the tooling** (use the `video` slot). HyperFrames needs Node 22+, FFmpeg, and for speech-timed work whisper-cpp. Verify with `npx hyperframes doctor`; install the HyperFrames skills with `npx hyperframes skills` (restart the session afterwards). Anything needing admin rights: give the user the exact command instead of running it.
2. **Capture truth first.** Collect screenshots (real product, via the `browser-verify` slot), the three things the product does best, the real numbers, the CTA. Save under `launch/screenshots/`.
3. **Script and storyboard** in `launch/storyboard.md`: hook in the first 2 seconds, one idea per screen, show the result before explaining it, end on CTA. Get the user's approval before rendering.
4. **Build** with HyperFrames following `references/video-hyperframes.md` (fonts local, one style, safe margins, nothing important outside the safe area).
5. **Render and inspect.** Render to `renders/`, then actually check the output (frame count/duration with `ffprobe`, extract frames at key timestamps, view them) before reporting done. Ask the user to watch it end to end.
6. **Sound (optional).** Quiet ticks/chimes only; keep effects under any voice; check licences of any music/sfx used.
7. **Variants.** Re-render other aspect ratios/frame rates/transparent overlays only as requested.

## Pitfalls
- Claims the product can't back up. Every on-screen claim maps to a real feature or number.
- Text outside phone-safe margins; screens that flash by faster than they can be read (aim >= ~0.3 s per word, a short line per screen minimum 1.5 s).
- Mixed styles in one video. Pick one preset.
- Using AI-generated people or voices without disclosure, or footage/music without licence.
- Reporting "rendered" without having looked at frames.

## Gate
`hyperskill.py gate launch`. Evidence: the render path + ffprobe output + frames inspected, the legal page URLs, the licence list, the completed prelaunch checklist.
