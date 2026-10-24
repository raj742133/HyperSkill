# Icons

Sites made with Sitewright have icons where they help: in the navigation, on stat cards, on status chips and badges, in the features list and in the story steps. The drawings come from the open icon sets behind [Iconify](https://iconify.design) (200,000+ icons in 150+ sets), found with the help of **[better-icons](https://github.com/better-auth/better-icons)** (MIT, Better Auth Inc.), a search tool for agents and the command line over the same data.

A generated site carries **only the icons it uses**, as plain inline SVG in the colour of the text around it. No icon font, no icon library, no request at run time. Nothing is added unless chosen: a place with no icon looks exactly as it did.

## Just use them in your code

Every generated project has an `Icon` component. Write the icon where you want it; nothing to register, no command to run:

```tsx
import { Icon } from '@/components/icons/Icon';

<Icon name="rocket" />                      // the site's icon set (Lucide unless icons.set says otherwise)
<Icon name="tabler:home" />                 // any other set: prefix:name
<Icon name={ok ? 'circle-check' : 'circle-x'} />
<Icon for="Shipped orders" />               // describe it: the icon that fits these words is chosen for you
<Icon for={order.status} />                 // (a fixed text only; see below for names built at run time)
```

The project finds every icon its code asks for and brings in the ones that are missing: while `npm run dev` runs (a few seconds after you save), before every `npm run build` (the build stops, naming the file, if an icon cannot be found), or on demand with `npm run icons`. It looks in `<Icon name>` and `<Icon for>`, in any `icon="..."` / `icon: "..."` prop or JSON value, and in a comment such as `// icons: gift, wine` (the way to list names that are built at run time, like ``name={`status-${s}`}``). A typo is reported with the file and a suggestion (`rockt` → `did you mean lucide:rocket`).

It never removes an icon on its own (a name built at run time can't be seen); `npm run icons -- --prune` drops the ones the code no longer uses. Nothing is fetched when everything is already there, so a build on a server with no internet works as long as the icons were brought in during development, which is how it normally goes.

### Your words, once

The built-in words cover common titles (orders, delivery, payment, team, schedule, ...). For your own vocabulary, say it once and it applies everywhere: `<Icon for>`, `icons: auto` and everything else that reads titles.

```jsonc
"icons": { "auto": true, "map": { "roast": "coffee", "grinder": "settings", "shipped": "tabler:truck-delivery" } }
```

Your words win over the built-in ones; a word matches whole words in any case, so `roast` also fits "Roasting" but not "toast". If nothing fits a text, `sync-icons` says so and the place keeps no icon, never a guess.

## Where the generator puts icons by itself

```jsonc
"icons": "auto"                       // fill the places a title clearly names, leave the rest alone
// or
"icons": { "auto": true, "set": "lucide", "custom": { "bean": "<svg viewBox='0 0 24 24'>...</svg>" }, "extra": ["mdi:home"] }
```

Name an icon anywhere a place takes one, as `"prefix:name"` (`lucide:coffee`, `tabler:home`, `mdi:account`) or just `"coffee"` for the site's default set (`set`, default `lucide`). `custom:bean` is one of your own.

| Place | Where it goes in the config | Where it shows |
| --- | --- | --- |
| `nav.<id>` | `nav.icons: { "dashboard": "layout-dashboard", "connect": ..., "publishing" or "team": ..., "home": ... }` | the header links (`dashboard`, `connect`, `publishing`, `team`, `home`) |
| `stats.<n>` | `dashboard.stats[n].icon` | a corner of the stat card, in its tone colour |
| `statuses.<id>` | `dashboard.statuses[].icon` | the filter chip and the badge on every record card |
| `features.ready.<n>` | the optional third item of a ready feature: `["Roast to order", "Every bag is roasted after you order it.", "coffee"]` | in place of the dot |
| `features.next.<n>` | the optional fourth item of an upcoming feature: `[name, text, beingBuilt, "gift"]` | in place of the dot |
| `story.<n>` | `landing.story.steps[n].icon` | beside the step's time label |

`extra` lists icons to include without a place. You rarely need it now: an `<Icon name="mdi:home" />` in code is found by itself.

### `auto`

Reads each title for whole words and only fills what it is sure of: nav links, the three default statuses, and titles with a clear keyword (orders, delivery, payment, revenue, customers, attention, done, sync, scan, schedule, a dozen trades such as coffee, law, fitness, clinic). A title that names nothing gets no icon, and one list never shows the same icon twice. Review what it chose in `site.json`; it writes the full ids there.

## Finding the right icon

- With the **better-icons** tools available in the session (the `search_icons`, `get_icon`, `recommend_icons` MCP tools, or `npx better-icons search <word> --prefix lucide`), use them: that is what they are for. Set it up once with `npx better-icons setup`.
- Without them: `node scripts/scaffold.mjs --list-icons coffee` lists matching names in the kit's pack and any installed set, and searches Iconify too when the network allows (`--offline-icons` skips that; `--icon-prefix tabler` picks a set).

Style: keep one set per site (the default, Lucide, is a clean 24 px outline set that suits the rest of the design). Mixing sets looks accidental.

## Command line (optional), and changing the generated places later

You never need these to use an icon in code. They are for the places the generator fills (navigation, stat cards, chips, features, story) and for Claude to drive.

```bash
node scripts/scaffold.mjs --config site.json --out ./my-site --icons auto
node scripts/scaffold.mjs --config site.json --out ./my-site --icon nav.dashboard=layout-dashboard,stats.0=package --icon-set lucide
node scripts/scaffold.mjs --apply-icons ./my-site --icon stats.1=chart-line          # change one, in a second
node scripts/scaffold.mjs --apply-icons ./my-site --icon story.0=none                # remove one
node scripts/scaffold.mjs --apply-icons ./my-site --icons none                       # remove them all
node scripts/scaffold.mjs --apply-icons ./my-site --icons auto                       # fill any empty places
```

`--apply-icons` rewrites only the icon entries in `src/content/site.json` and `nav.json`, then runs the same sync as the project's own `npm run icons` (so it also brings in what the code asks for). Pages and styles, and everything you edited, are untouched. A project generated before icons followed the code needs one regeneration first (the command says so).

## Where an icon comes from

In order: (1) the pack shipped with the kit, 200+ common Lucide icons (`templates/icons/lucide.json`, ISC; each project carries its own copy in `scripts/lib/pack`), so a site gets icons with no network; (2) a locally installed `@iconify-json/<set>` (`npm i -D @iconify-json/tabler`); (3) the cache from an earlier run (`~/.cache/sitewright/icons`); (4) the Iconify API, unless `--offline-icons`. A name that is nowhere is an error that tells you how to find the right one, and nothing is generated.

## Licences

Every set has its own licence, read from Iconify (or the set's own info) and written into the project's `src/components/icons/NOTICE.md` (the facts in `icons.sets.json`) with the author, the icons used and, for the kit's pack, the full licence text.

- MIT, ISC, Apache-2.0, CC0, BSD, OFL and similar: used freely; the notice file is all that is needed.
- **CC BY** (for example Font Awesome Free): allowed, with a warning and a ready-made credit line in `NOTICE.md`: credit has to be visible to people, so add it to the footer or a credits page.
- Anything else (non-commercial, GPL, unknown, or a licence that could not be read): refused. Allow a set knowingly with `--allow-icon-license <prefix>`.
- Brand logos (`simple-icons`, `logos`) are CC0 or MIT as drawings but the marks are trademarks: use them only to point to the real company, and never to suggest endorsement.

## Safety

Icon data comes from the network and ends up inlined in your pages, so every icon is rebuilt from an allow-list of drawing elements (`path`, `circle`, `rect`, `line`, `polyline`, `polygon`, `ellipse`, `g`, gradients, clip paths and masks) and attributes before it is written. Scripts, event handlers, links, `style`, `<use>`, `<image>`, text and anything else make the icon fail, and gradient and clip ids are made unique so two icons on one page never collide. The same applies to `icons.custom`. The verifier checks the rendered icons for the same.

## Adding to the kit

New places: add the slot in `iconSlots()` (`scripts/lib/icons.mjs`), render `<Icon name={...} />` in the template, add its style next to `.stat-ic` in `globals.css`, and give `verify.mjs` a check. New keywords for `auto`: the `KEYWORDS` table in the same file (whole-word stems; specific rules first). A bigger offline pack: edit the list in `tools/make-icon-pack.mjs` and run it against `npm pack @iconify-json/lucide`.
