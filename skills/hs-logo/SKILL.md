---
name: hs-logo
description: Design a logo or app icon from a brief to production files - one clear idea, built as clean SVG, tested at 16 px, in one colour and reversed, then exported as favicon, app icons and a web manifest. Use when the user needs a logo, mark, wordmark, favicon or app icon, or wants an existing one critiqued or fixed.
---

# hs-logo

A logo is an identifier, not an explanation. It is judged small, in one colour, on backgrounds nobody chose, in a crowd of other marks. The work is finding one idea and proving it survives that, not decorating a concept.

Tools (standard library Python; PNG output needs a Chrome-family browser):

```
python3 ${CLAUDE_PLUGIN_ROOT}/skills/hs-logo/scripts/logo.py audit  mark.svg              # errors and warnings
python3 ${CLAUDE_PLUGIN_ROOT}/skills/hs-logo/scripts/logo.py test   mark.svg --out brand/  # test-sheet.html and .png
python3 ${CLAUDE_PLUGIN_ROOT}/skills/hs-logo/scripts/logo.py kit    mark.svg --out public/ --name "Acme" --theme "#1b4dff" --background "#ffffff"
```

## The process

1. **Brief, in at most five questions** (or stated assumptions if the owner wants speed): what it is and does, who it is for, three words for how it should feel, the colours or fonts already fixed, where it will mostly be seen (a 16 px tab, an app icon, a shopfront). Record the answers in `docs/brand.md`.
2. **Map the words.** Write the name's meaning and ten things that belong to this product and not to its competitors. The idea comes from this list, not from the category: a leaf for an eco product is every eco product.
3. **Choose the mark type** on purpose: wordmark (distinctive name, long life), monogram (long or generic name), letterform (a single strong initial), pictorial (a real object people connect to the name), abstract (needs an idea behind it), emblem (badge; fails small), combination (symbol plus wordmark, the safe default for a product).
4. **Concepts: ten one-line ideas, build three.** Build each as SVG on a 64 x 64 `viewBox`, with simple shapes first, a grid, and as few points as possible. Colour comes last; draw in one colour first, because that is the test it must pass.
5. **Audit and look.** Run `audit`, fix every error, read every warning. Run `test` and open `test-sheet.png`. Ask of each block: at 16 px is it still *that* mark? In black, does the shape survive, or did the inner detail carry it? Blurred, is there still a silhouette? Mirrored or upside down, does it become something it should not? On the yellow and the brand blue, does it hold?
6. **Checkpoint.** Show the three concepts with one line of reasoning each and a recommendation. Stop. The kit is most of the work and only makes sense for a direction the owner has picked.
7. **Kit, after approval.** Final SVG with letters converted to outlines. Then `kit` for `favicon.svg`, `favicon.ico` (16, 32, 48), `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`, a maskable icon with a safe zone, `site.webmanifest` and the `<head>` snippet. Add a small `docs/brand.md`: the mark, clear space (at least the height of the mark's main stroke block on every side), minimum size, the colours with contrast ratios, what not to do.

## Rules

- **One idea, drawn plainly.** If it needs a caption, gradients, drop shadows or ten colours to work, the idea is missing. The audit warns on the mechanical signs; the squint test catches the rest.
- **Originality is your job.** Do not trace or imitate an existing brand. Before the owner uses a mark commercially, say that nobody has searched trademarks or similar marks yet; that is theirs to do, and it is not something this skill can certify.
- **Live text is a draft.** A font can change on any machine; the final file has outlines. Note the typeface and its licence in `docs/brand.md`; use only fonts whose licence allows it.
- **Do not claim it tested well** unless you ran `test` and looked at the sheet. Say which blocks you checked.
- **Accessibility:** icon colours on their backgrounds meet 3:1 (a graphic) and any text in the lockup 4.5:1; never rely on colour alone to tell two marks apart.
- If the project already has a mark, critique before replacing: say what works, what fails the tests, and the smallest change that fixes it.

See `references/tests.md` for what each test is looking for.
