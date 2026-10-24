---
name: sitewright
description: Generate a complete, working Next.js website (landing page, sign-in, authenticator MFA, dashboard, release publishing, connect-a-phone, ingest API) from a modular kit modelled on a production field-capture dashboard, restyled and re-worded for the user's own brand. Use when the user wants to create a landing page, publishing/downloads page, records dashboard, shared-password or MFA sign-in, or a "connect your phone" page for their own site, one module or several, with colours, copy and vocabulary of their choice. Optional animated effects layer (hero backgrounds, headline text animations, button and card micro-interactions) icons from 200,000+ open ones, and 22 interactive line figures placed where they mean something (sign-in card, connect page, empty states, 404...), chosen from a menu or by name, changeable later in place, with a live /effects gallery. Includes a Playwright verifier that builds the site and drives it at desktop and phone widths.
---

# Sitewright

Recreates the design and backend of a production field-capture dashboard as independent **modules**, filled with the user's brand and data.
The output is a normal Next.js 15 / React 19 / TypeScript project the user owns - there is no runtime dependency on this skill.

## Modules

| id | What the user gets | Needs |
| --- | --- | --- |
| `landing` | Public home page: hero with animated mark, scroll story with phone mock-ups, proof numbers and bars, features, timeline, FAQ, download card with QR code and team code, release list | - (shows downloads if `publishing` is chosen) |
| `signin` | Shared-password gate (signed cookie + edge middleware), themed login page | - |
| `mfa` | Named accounts: password + authenticator app (TOTP, replay-protected), invites, lockout, activity log, optional access-code lock | - |
| `publishing` | Upload a version (APK parsed for real, or any file types), notes editor, stable/testing channels, testers with codes, update-check endpoint, public download | `mfa` (added automatically) |
| `dashboard` | Records list with stats, search, status chips, facets, detail page with status actions and delete | `signin`, `api` |
| `connect` | "Connect a phone" page: link with key, copy button, curl example | `signin`, `api` |
| `fxgallery` | A public `/effects` page that runs every animated background, headline, button and card effect live, with a colour picker and the exact `effects` config to copy. Use it to let the user choose by looking | - |

`base` (design system, database, storage) and `api` (ingest, signed uploads, health) are internal; they are added when needed.
Dependencies are resolved automatically - choosing `publishing` brings `mfa`; `dashboard`/`connect` bring `signin` + `api`.

**Effects** are not a module but a style layer on top of any of them (`effects` block in `site.json`): 10 hero backgrounds, 8 headline animations, 4 button and 4 card effects, 5 scroll-reveal styles and 4 extras, all original dependency-free code. Every site has the effect slots wired in; with nothing chosen they show the default look, and `--apply-effects` changes them later in place.

**Icons** are the third: inline SVG from the open sets behind Iconify (200,000+; found with the help of [better-icons](https://github.com/better-auth/better-icons)) in the navigation, stat cards, status chips, features list and story steps (`icons: "auto"`, or name them). Catalogue, places, licences and how to change them later: `reference/icons.md`.

**Figures** are the other half of the layer: 22 small interactive isometric line drawings (19 from Hairline, MIT, plus `bars`, `scanner`, `parcel` written for this kit) placed in named *places* of the site, `effects.figures`: `hero`, `releases`, `signin`, `mfa`, `connect`, `empty`, `notfound`. `figures: "auto"` puts the fitting figure in every place the chosen modules have; `{ "signin": "vault" }` chooses one by one. Catalogue, places, how to use them well and how to add your own: `reference/figures.md`. Catalogue, presets and rules: `reference/effects.md`.

**Components** are the third part: 58 small interactive pieces (hold-to-confirm and tactile buttons, a command input, wheel picker, dials and gauges, stagger and line-draw reveals, spring-physics helpers, and 16 SVG charts) imported from `@/components/fx/ui`, chosen with `effects.components` (`"all"` or a list) or `--components`. Catalogue, what each is for and how to choose: `reference/components.md`.

## Workflow

1. **Ask which modules.** Use AskUserQuestion with a multi-select over: Landing page, Publishing page, Dashboard, Connect to phone, Sign in (shared password), MFA accounts. Say what each adds in one line. If the user already named them, skip the question.
2. **Gather the brand** (ask only what is missing; everything has a default - see `reference/config.md`):
   - name, one-line tagline, what the product does in a sentence;
   - two brand colours (primary + accent/signal) - the whole light and dark palette, with contrast-checked text colours, is derived from them;
   - logo style (`hex`, `circle`, `square`, `drop`, `monogram`);
   - vocabulary: what they call a *record* (order, case, scan, ticket...), the *device* (phone, tablet), the *artifact* (app, catalogue, brochure) and the admin *area*;
   - for `publishing`: file types allowed (`.apk` + `parseApk` for Android apps, or `.pdf`, `.zip`, ...);
   - for `dashboard`: statuses, field labels, any numeric metric to total up;
   - for `landing`: headline + accent word, 3-4 story steps, optional proof/features/FAQ.
   **Never invent facts** (customer counts, benchmarks, testimonials). Leave `proof`, `features`, `compat` out unless the user supplies the content. Mark placeholder copy as such.
3. **Choose the look: theme, effects, figures and icons.** The generated UI has a design language (`design.theme`: `studio`, the default - flat, warm, display headlines - or `classic`, the original pale surface with soft shadows). Keep the default unless the user wants the classic look. On top of that the kit has optional layers (effects, figures, icons, components). Claude chooses and wires them; the user steers. Say in one line what you picked and offer to change it. Never switch on a heavy choice the user did not want on a dense page.
   - **Components** (`reference/components.md`): when the site has a destructive action, a dashboard, an invite flow or a landing section that wants motion, use the fitting component instead of hand-rolling it (`hold-to-confirm`, `dynamic-button`, the charts, `invite-code`, `stagger-grid`, `line-draw`). Switch them on with `effects.components`; changing the set later is `--apply-effects --components ...`.
   - **Effects** (backgrounds, headline animations, button and card styles, reveals, extras; `reference/effects.md`).
     - The user named one ("use aurora", "typewriter headline", "the playful preset"): apply exactly that, without asking. Map it to the ids in `node ~/.claude/skills/sitewright/scripts/scaffold.mjs --list-effects` and write it to `effects` (or pass `--hero-bg aurora` etc.). Everything they did not mention stays as the preset or default gives it.
     - The user said nothing about effects: pick one fitting preset (calm/serious brands: `calm` or `editorial`; playful: `playful`; technical: `tech-grid`; plain data tools: keep the default look).
     - The user wants to see the options: print `--list-effects`, or add `fxgallery`, build, and point them at `/effects` (Copy, then paste the config back).
     - `rotate` needs `rotateWords`; set `loginBackground` to animate the sign-in page too.
   - **Figures** (22 interactive line drawings; `reference/figures.md`). Use them when the user mentions drawings, illustrations, a padlock on the login, a chart in the empty dashboard, or wants the site to feel alive: `figures: "auto"` puts the fitting one in every place the chosen modules have, or name them per place. No figure twice on a page, and no `auto` on a site the user called plain or serious without asking.
   - **Icons** (`reference/icons.md`). `icons: "auto"` is a good default for any site with a dashboard or a features list; it only fills what a title clearly names, so look at what it chose. To find a name: the better-icons tools if they are in the session (`search_icons`, `recommend_icons`; `npx better-icons setup` installs them), otherwise `node ~/.claude/skills/sitewright/scripts/scaffold.mjs --list-icons <word>`. One icon set per site. If a CC BY set is used, tell the user (the generator prints a note and writes the credit line to `src/components/icons/NOTICE.md`).
   - **Later, in the user's own pages, nothing needs registering.** Write `<Icon name="rocket" />` (or `<Icon for="Shipped orders" />` to let the words choose) and `<Figure name="padlock" />` straight into the code; the project brings them in by itself on `npm run dev`, `npm run build` or `npm run icons` / `npm run figures`. Never ask the user to register them or run commands for them, and do not edit `Slots.tsx` or `icons.data.json` by hand. For the user's own vocabulary set `icons.map` once instead of naming icons one by one; names built at run time go in a `// icons: a, b` comment.
   - **Changing the generated places later takes a second and never touches the user's edits:** `scaffold.mjs --apply-effects ./my-site --hero-bg stars --headline typewriter` (`--preset` replaces the whole set; single flags change only their slot; `--figures hero=bars` changes one place, `--figures hero=none` removes it, `--figures none` removes all) and `scaffold.mjs --apply-icons ./my-site --icon stats.0=package`. Never regenerate a project just to change a look.
4. **Write the config** to `site.json` (see `reference/config.md`; `examples/*.json` are complete worked configs - `examples/minimal.json` is just a brand name).
5. **Scaffold:**
   ```bash
   node ~/.claude/skills/sitewright/scripts/scaffold.mjs --config site.json --out ./my-site --modules landing,signin,dashboard,connect,mfa,publishing
   ```
   `--modules` may be omitted if the config has a `modules` array. Other flags: `--force` (write into a non-empty folder), `--password <p>` (dev password), `--check` (validate and list the modules and resolved effects, writes nothing), `--list`, `--list-effects`.
   The user's effect choices can also be passed directly, overriding the config file: `--preset <id> --hero-bg <id> --login-bg <id> --headline <id> --rotate-words "a,b" --buttons <id> --cards <id> --reveal <id> --extras id,id --figures auto|place=figure,place=figure --figure-intensity 0..1 --icons auto|none --icon place=icon,... --icon-set lucide --offline-icons`.
   Quote Windows paths with forward slashes in Bash.
6. **Install and build** in the new folder. If the system drive is short on space (the install is ~700 MB with PGlite and Tiptap), put the project, `TEMP`/`TMP` and the npm cache on a roomy drive.
   ```bash
   npm install && npx tsc --noEmit && npm run build
   ```
7. **Verify** (do not skip - report what actually ran):
   ```bash
   node ~/.claude/skills/sitewright/scripts/verify.mjs --site ./my-site --port 4010 --out ./verify-shots
   ```
   It needs Playwright (`npm i playwright` somewhere resolvable from the cwd, and a Chromium - `npx playwright install chromium`). It starts the built site on a throwaway database and storage, then drives every chosen module at 1280, 390 and 360 px: renders, forms, sign-in, the full MFA enrolment with its own TOTP, publishing (fake files, or real APKs with `--apk <file> --apk-name <v> --apk-code <n> [--apk2 ...]`), API auth and idempotency, no horizontal scroll on phones, repeated warm-cache loads for hydration errors, and no console errors. Screenshots and `report.json` land in `--out`; read a couple of the screenshots before telling the user it looks right.
8. **Hand over:** the folder, the dev password and `.env.local` location (generated with random secrets - never print secrets into committed files), how to run (`npm run build && npm start`), the list of checks that passed, and the caveats below. Offer a Playwright screenshot of the landing page at desktop and phone width.

## Rules the generated code keeps - do not edit them away

- Private pages and `/api` are behind the middleware gate; API callers get 401, not a redirect. The cookie check in middleware is presence-only (Edge has no `node:crypto`); every page and route re-verifies the HMAC.
- Ingest uses a bearer `INGEST_TOKEN`, separate from the password, and is idempotent per record id.
- Storage returns **keys**, never URLs; files are served through signed, short-lived routes.
- TOTP accepts +/-1 step, refuses a reused step, locks after 5 failures for 15 minutes; invites are single-use and expire after 48 h.
- The root layout must not import values from a `'use client'` file (see `reference/gotchas.md` - it breaks hydration on some routes).
- Icons keep their set's licence notice (`src/components/icons/NOTICE.md`); a CC BY set also needs the credit line shown to people. Icon markup is sanitised on the way in: never paste raw SVG into `icons.data.json` by hand (use `icons.custom`).
- Figures keep the Hairline licence notice (`src/components/fx/figures/LICENSE-hairline.txt`) in every project that uses them. Never remove it.
- Effects respect `prefers-reduced-motion`, switch off pointer-follow behaviour on touch screens, pause canvases when off screen, and never hide the real headline text from screen readers.
- Mobile first: every page has `width=device-width`, tap targets >= 44 px, tables scroll inside their card, no horizontal page scroll at 360 px. `prefers-reduced-motion` switches animations off.

## Extending

New module = a folder under `templates/modules/<id>/` mirroring the output tree, plus an entry in `scripts/modules.mjs` (requires, deps, env vars, SQL, open paths, nav). Conditional code uses `//#if flag` ... `//#else` ... `//#endif` lines (or `{/*#if flag*/}` in JSX). See `reference/modules.md`.

## Reference

- `reference/config.md` - every config key, its default, and a minimal vs full example
- `reference/effects.md` - the effects catalogue, presets, wiring and rules
- `reference/components.md` - the component library (58 pieces): ids, what each does, where to use it
- `reference/icons.md` - icons: places, `auto`, finding names, licences, changing them later
- `reference/figures.md` - the 22 line figures, the places they go, which fits where, and how to add one
- `reference/design-system.md` - tokens, palette derivation, components, animations, responsive rules
- `reference/modules.md` - routes, tables, env vars and flags per module
- `reference/testing.md` - what the verifier checks, how to run it, how to read failures
- `reference/gotchas.md` - things that cost real time: hydration, Node versions, disk, Windows shells
