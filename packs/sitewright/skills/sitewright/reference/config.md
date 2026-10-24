# site.json - every key

Everything is optional except `brand.name`. `{"brand":{"name":"Acme Co"}}` generates a complete, working site (see `examples/minimal.json`).
Unspecified keys fall back to `scripts/defaults.mjs`, which is the source of truth - read it for the exact default strings.

Strings may contain `{brand} {record} {records} {device} {artifact} {area}`; they are filled in after merging. `{accent}` in
`landing.headline` stays literal and marks where the accent word goes. Plain-text fields are sanitised on the way in (quotes become typographic,
backticks, backslashes, braces, `<`, `>` and `$` are removed) so user copy can never break the generated source.

```jsonc
{
  "modules": ["landing", "signin", "dashboard", "connect", "mfa", "publishing"],   // or --modules on the CLI
  "brand": {
    "name": "Bean & Barrel",                    // required
    "tagline": "Small-batch coffee.",           // page title
    "description": "...",                       // meta description
    "lang": "en",
    "logo": { "style": "hex|circle|square|drop|monogram", "letter": "" },  // letter: for monogram, default = first letter. Default: monogram (studio theme), hex (classic)
    "colors": { "primary": "#7a4a21", "signal": "#e8a33d" },               // the whole light + dark palette comes from these two
    "font": { "body": "Inter", "display": "Bricolage Grotesque", "mono": "JetBrains Mono" },  // any Google Font family; leave out to take the theme's fonts (display falls back to body)
    "footerNote": "Roasted in Leeds."
  },
  "design": { "theme": "studio" },              // "studio" (default: flat, warm neutrals, display headlines) or "classic" (the original pale surface with soft brand-tinted shadows)
  "vocab": { "device": "tablet", "artifact": "catalogue", "record": "order", "records": "orders", "area": "Publishing" },
  "storage": { "provider": "s3|azure" },       // optional: includes that storage driver, its packages and env vars (local is always there)
  "nav": { "dashboard": "Dashboard", "connect": "Connect a {device}", "publishing": "Publishing", "team": "Team", "home": "Home page", "suffix": "dashboard" },

  "landing": {
    "kicker": null, "navLabels": { "proof": "Why {brand}", "releases": "What's new", "help": "Help" },
    "badge": { "tag": "New", "text": null },
    "headline": "Every cup, {accent} to order.", "accent": "roasted", "sub": "...",
    "primaryAction": { "label": "Browse", "href": "#story" },
    "downloadLabel": "Download for {device}",
    "howToInstall": ["step 1", "step 2", "step 3"],
    "story": { "kicker": "", "title": "", "lead": "", "end": "",
      "steps": [{ "time": "Mon 07:00", "title": "", "text": "", "tags": [""],
        "screen": { "kind": "list|grid|result|progress", "title": "", "sub": "",
                    "cards": [{ "title": "", "sub": "", "pill": "", "tone": "dark|green" }], "cta": "", "guide": "", "bar": 62,
                    "big": { "label": "", "value": "" } } }] },
    "proof": null | { "kicker": "", "title": "", "lead": "", "figure": "2 days", "bigTitle": "", "bigText": "",
                      "numbers": [{ "value": "", "label": "" }], "bars": [{ "label": "", "value": 96, "them": true }],
                      "cards": [{ "icon": "leaf|bolt|heart|...", "title": "", "text": "" }] },
    "features": null | { "kicker": "", "title": "", "ready": [["Title", "Text"]], "next": [["Title", "Text", true]] },
    "compat": null | { "kicker": "", "title": "", "lead": "", "okText": "", "items": [{ "n": "1", "name": "", "year": "", "first": "" }],
                       "facts": [{ "title": "", "text": "", "mono": false }] },
    "cta": { "title": "", "text": "" },
    "faq": [["Question", "Answer"]], "faqTitle": "", "faqLead": "", "releasesTitle": ""
  },

  "signin":     { "eyebrow": "", "title": "", "text": "" },
  "mfa":        { "eyebrow": "{brand} · {area}" },
  "publishing": { "artifact": "app", "extensions": [".apk"], "parseApk": false, "packageName": "", "testers": true,
                  "title": "", "sub": "", "kinds": ["new", "improved", "fixed"] },
  "dashboard":  { "eyebrow": "", "title": "", "sub": "", "empty": "",
                  "statuses": [{ "id": "new", "label": "New", "tone": "accent|ok|corrected|unsure" }],
                  "labels": { "title": "Name", "subtitle": "Place", "category": "Type", "owner": "Owner", "source": "Source" },
                  "facets": ["category", "owner", "source", "status"],
                  "metrics": [{ "key": "total", "label": "total", "unit": "£" }],
                  "stats": [{ "label": "orders", "kind": "count|sum|distinct|status", "metric": "total", "field": "title", "status": "issue", "prefix": "£", "tone": "accent" }],
                  "itemsLabel": "Items", "filesLabel": "Photos", "search": "" },
  "connect":    { "title": "", "sub": "", "where": "Settings → Dashboard", "curl": true },

  // optional animated style layer; omit it for the default look. Full list, presets and rules: reference/effects.md
  "effects": {
    "preset": "aurora-glass",            // minimal | calm | aurora-glass | tech-grid | playful | cosmic | editorial
    "heroBackground": "aurora",          // territory (default) | none | aurora | mesh | dots | particles | stars | beams | waves | grid | grain | spotlight
    "loginBackground": "none",           // same list except territory
    "headline": "split-words",           // none | split-chars | split-words | blur-in | typewriter | gradient | shimmer | scramble | rotate
    "rotateWords": [],                   // for headline "rotate": 2-8 words
    "buttons": "glow-border",            // none | magnetic | shine | ripple | glow-border
    "cards": "spotlight",                // none | tilt | spotlight | glow-border | lift
    "reveal": "blur",                    // rise (default) | fade | scale | blur | slide
    "extras": ["cursor-glow"],           // cursor-glow | scroll-progress | click-spark | count-up
    "figures": "auto",                   // "auto", or { "hero": "terrain", "signin": "padlock", ... }: line figures in named places (reference/figures.md)
    "figureIntensity": 0.5               // 0 subtle ... 1 strong, for every figure
  },

  // optional icons (reference/icons.md): "auto", or an object. Icon ids are "lucide:coffee" or just "coffee" (the default set).
  "icons": { "auto": true, "set": "lucide", "custom": {}, "extra": [] }
  // also: nav.icons { dashboard, connect, publishing, home }, dashboard.stats[].icon, dashboard.statuses[].icon,
  //       landing.features.ready[n][2] / next[n][3], landing.story.steps[].icon
}
```

## Rules of thumb

- `proof`, `features`, `compat` default to **off**: they need facts, and the kit never makes any up. Include them only with the user's real content.
- `publishing.extensions` is both the allow-list on upload and the file picker's `accept`. `parseApk: true` reads `AndroidManifest.xml` for version name/code, package
  name and min SDK, and rejects a file whose package name differs from `packageName` (when set). Without it the user types the version name and build number.
- Build numbers must strictly increase; the publisher refuses an equal or lower one.
- Statuses: the first is what a new record gets; `tone` picks a colour token.
- `story.steps[].screen.kind` picks the phone mock-up layout. 3-4 steps look best.
- Copy in `examples/*.json` is fictional demo content, as the files say.
- `effects` keys override the preset, and the generator flags (`--preset`, `--hero-bg`, `--headline`, ... see `reference/effects.md`) override the file; an unknown id stops the generator with the list of valid ones. `headline: "rotate"` needs `rotateWords`. `examples/coffee-effects.json` is `coffee.json` plus an effects block.
