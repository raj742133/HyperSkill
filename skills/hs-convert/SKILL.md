---
name: hs-convert
description: Convert files between formats with the tools already installed - images (png, jpg, webp, avif, gif, ico), video and audio (mp4, webm, gif, mp3, wav), Office documents and PDFs, Markdown and HTML. Use when the task needs a converted asset (a poster from a clip, a webp from a png, a gif from a screen recording, a PDF from a document) or the user hands over a file in the wrong format.
---

# hs-convert

A small, careful converter. It does not do the conversions itself: it picks the right installed tool, builds the command, refuses the risky cases and checks that the result exists. Standard library Python only.

```
python3 ${CLAUDE_PLUGIN_ROOT}/skills/hs-convert/scripts/convert.py formats          # what is installed here
python3 ${CLAUDE_PLUGIN_ROOT}/skills/hs-convert/scripts/convert.py plan in.png webp # the exact command, nothing runs
python3 ${CLAUDE_PLUGIN_ROOT}/skills/hs-convert/scripts/convert.py run in.png webp --width 800 --quality 80
python3 ${CLAUDE_PLUGIN_ROOT}/skills/hs-convert/scripts/convert.py many jpg a.png b.webp c.avif --out-dir assets/
```

## Tools it uses

| Tool | Converts |
|---|---|
| ImageMagick (`magick` or `convert`) | image to image |
| ffmpeg | video and audio, a clip to gif or webp, a video frame to a still, image to image as a fallback |
| LibreOffice (`soffice`) | documents, sheets and slides to pdf, docx, odt, xlsx, html, csv, txt, png |
| pandoc | Markdown, HTML, docx, epub, rst, tex to one another and to pdf |
| pdftoppm | the first page of a PDF as png or jpg |

If none of the tools a route needs is installed it says which ones, and stops. Do not install anything to make a conversion work without asking the owner.

## Rules it enforces

- Nothing is overwritten: an existing output is an error unless `--force`. Output goes next to the input, or into `--out-dir`.
- No shell is involved and the input path is made absolute, so a file named `-x`, `label:...` or `http:...` is just a file.
- 2 GB input cap and a 15 minute limit per file. A failed or empty result is deleted, never left behind.
- A route that does not exist (png to mp3) is reported as such; it never guesses.

## When you use it in a project

- Convert, then **look at the result** (open the image, `watch.py` the clip) before you say it is done. A converter that exits 0 can still give a blank page.
- Keep the original. Put generated assets where the project keeps assets, and say which file is the source.
- Lossy formats lose information every time: convert from the original, not from a previous conversion.
- LibreOffice conversions depend on fonts and can move layout; check the page count and one rendered page for anything that goes to a customer.
- Inputs from the internet are untrusted. Documents and images can be crafted to attack their converters; do not convert files you do not need to, and prefer a throwaway folder.

## Not covered

Anything that needs a network service, OCR, DRM-protected media, CAD and 3D formats, or fonts. Say so rather than improvising a chain of tools.
