# Gotchas that cost real time

## A root layout must not import values from a `'use client'` file
Symptom: React error #418 (hydration) on some routes only, only when the browser cache is warm (a second page after `/`), roughly 1 load in 2 to 10 in 10.
The error text is useless in production ("server rendered HTML didn't match"); the SSR HTML and the final DOM were identical.
Cause: `layout.tsx` imported the `THEME_SCRIPT` string from `ThemeToggle.tsx` (`'use client'`). That turns the import into a client reference and ties the layout to client chunks;
for `/admin/*` Next then listed the `/admin` page's chunks in the HTML instead of the layout chunk. Fix (already applied): shared constants live in `src/lib/theme.ts`.
How it was found: comparing `<script src>` lists in `curl` output for a failing and a passing route, after a bisect showed even an empty page under `/admin/` failed.
The dashboard this kit was modelled on had the same pattern and the same intermittent #418 on its admin pages.

## `next dev` is unreliable on Node 24 (and on Node 22.23 here)
`next dev` with PGlite crashed with `Zone Allocation failed / OOM` on Node 24.18, and on Node 22.23 every page returned 500 with `ArrayBuffer is not detachable and could not be cloned`.
Production (`next build && next start`) works on both. The verifier uses production. If the user needs dev mode, try an LTS Node release their team already uses, or point `DATABASE_URL` at a real Postgres to rule PGlite out.

## Disk space and Windows shells
- The install is ~700 MB (Next, PGlite, Tiptap). On a nearly full system drive set `TEMP`, `TMP` and `npm_config_cache` to another drive before `npm install` / `next build`.
- In Git Bash, an argument starting with `/` is rewritten to a Windows path (`/login` becomes `C:/Program Files/Git/login`). Pass URLs without a leading slash or use `MSYS_NO_PATHCONV=1`.
- Files containing backslashes (regexes) get mangled when written through a shell heredoc. Write them with a file tool.
- There is no `pkill` in Git Bash; stop servers with `taskkill //PID <pid> //F` or PowerShell `Stop-Process`.

## Testing animated pages
- Headless Chromium has no GPU, so a big blurred or constantly repainting background can drop the frame rate to a few fps. Playwright's default `waitForFunction` polls with `requestAnimationFrame`, so on such a page a wait that should take 100 ms can run out its timeout. Use `{ polling: 100 }` for waits on state (the verifier does).
- A mouse press that is released over a link becomes a click and navigates away, which then breaks every later check on that page ("Execution context was destroyed"). In a test that presses a button to see its ripple, move the mouse off the button before releasing.
- Measure "is it animating" by counting canvas frames (wrap `CanvasRenderingContext2D.prototype.clearRect` in an init script) instead of guessing; that is how the verifier proves a background stops drawing when scrolled off screen.
- The same effect can be reached from two groups (`Spotlight` is both a background and a card effect, `Glow border` both a button and a card effect), so look controls up inside their `radiogroup`.

## Things the generated code does on purpose
- Fonts are `<link>`ed in the browser instead of `next/font`, so a build never depends on reaching Google.
- The Edge middleware only checks that the session cookie is present and well-formed; handlers verify the HMAC. Do not "tighten" the middleware (no `node:crypto` on the Edge).
- `/api/admin/releases` is excluded from the middleware matcher: Next buffers and truncates request bodies at 10 MB for matched routes, which cut large uploads. The route does its own sign-in check.
- `AuthCard`, login and admin detail pages use plain `<a>` rather than `next/link`; they need no client routing.
- `ThemeToggle` stores the choice in `localStorage`; the inline script in `<head>` applies it, and `<html>` has `suppressHydrationWarning` for that one attribute.
- Plain-text config values are sanitised before they reach source files; do not paste user text into templates any other way.

## Honest limits
- The hero mark on the landing page is always the hexagon-with-lens drawing; the five logo styles apply to the header, favicon and sign-in marks.
- Not tested with very long brand names (over ~24 characters); check the header on a phone if the name is long.
- Brand colours are adjusted for contrast, so the rendered colour can differ slightly from the hex given.
