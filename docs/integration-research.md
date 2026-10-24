# Integration research: the tools from the trending posts

Checked on 2026-10-24. The posts were screenshots: a list of ten UI styles, a "10 best GitHub repos for Claude" card, and a carousel of self-hosted developer tools. This note says what each thing is, how it was checked, and where it went in the pipeline (or why it did not).

## How I checked

- **Licences and activity** come from the repositories themselves: each was cloned shallowly and its `LICENSE` file and last commit date read (the six skills and Gotify, Vikunja, celld, GlitchTip). Windmill's licence terms come from its README's licence section, which I did not cross-check against the files.
- **Star counts** are not used. GitHub's API and several project sites (`glitchtip.com`, `celld.dev`, `vikunja.io`, `gotify.net`) were not reachable from the sandbox, and the figures shown on fetched pages were inconsistent with each other (one README quoted a different star count from its sidebar).
- **I read the code of what I bundled; I could not run it.** The sandbox's permission check refused to execute scripts from a freshly cloned third-party repository (I tried Hallmark's linter), and I did not work around that. So the new packs were reviewed by reading (network calls, process spawning, files written, settings touched) and their effect on HyperSkill is tested through HyperSkill's own tests, not by running their scripts. Enabling one in a real project and running its linter is the first thing to try.

## The skills

| Tool | What it is | Licence | Decision |
|---|---|---|---|
| **Hallmark** (nutlope/hallmark) | Anti-AI-slop design skill: 16 hard rules, 48 themes dealt so builds do not converge, `sloplint.mjs` (zero-dependency linter of built HTML/CSS/JSX) | MIT | **Bundled, opt-in.** Slot `design-direction` (alternative to taste-skill: one voice only) and a new slot `design-lint` that turns the rules into a recorded mechanical check in the product phase. Risks written down: do not run its `install-hook.mjs`; image generation sends prompts to Together AI only if a key is set. |
| **Humanizer** (blader/humanizer) | Rewrites AI-sounding prose from Wikipedia's "Signs of AI writing" | MIT | **Bundled, opt-in.** Second provider in `copy-review` (launch and product copy) after SlopMonster. One pass, not both. |
| **Diagram Design** (cathrynlavery/diagram-design) | 45 diagram types as one HTML+SVG file; can redraw Mermaid, draw.io and Excalidraw | MIT | **Bundled, recommended.** New slot `architecture-diagram`, a core step of the plan phase: the `system-design-read` and `architecture-explained` checks both need a diagram the user can follow. The 4.4 MB of worked examples were left out of the bundle. |
| **last30days** (mvanhorn/last30days-skill) | Cited brief of what people said about a topic across Reddit, HN, YouTube, GitHub and more | MIT | **Registered, not bundled** (the skill folder is 18 MB; some sources use cookies or third-party scrapers; a reasoning-provider key sends your topic out). New slot `community-research`, situational in research, feeding `user-evidence`. |
| **Scrapling** (D4Vinci/Scrapling) | Python scraping framework with an MCP server and an official skill | BSD-3-Clause | **Registered, not bundled, opt-in with warnings.** New slot `web-extraction`, optional in research. Its stealth fetchers are built to defeat bot protection: the registry says not to use that where a site's terms forbid scraping. |
| **REA** (morluto/rea) | Reverse-engineering toolkit for agents (MCP server, skill, CLI) | MIT | **Registered, not bundled, opt-in.** New slot `artifact-analysis`, optional in harden, for inspecting a bundle or binary you ship. Only on software you own or are authorised to examine. |
| **Ponytail, Impeccable, UI/UX Pro Max** | Already bundled | MIT / Apache-2.0 / MIT | Nothing to add. |
| **Onyx** | The card's text and its link do not agree (the link points at a taste-skill repository, the text describes a self-hosted AI chat system). | not checked | **Not integrated.** If you meant the self-hosted chat product, it is a product to deploy, not a pipeline skill; tell me which repository you meant. |

## The ten styles

All ten (Skeuomorphism, Neumorphism, Glassmorphism, Claymorphism, Brutalism, Minimalism, Maximalism, Liquid Glass, Bento Grid, Spatial UI) were **already selectable** in the "UI UX Pro Max: visual styles" group, with previews. What was missing was a way to find them in one click and, more important, guidance on building each one without its usual failure (neumorphism's low contrast, glass over a busy backdrop, brutalism's lost focus states, bento grids with wrong reading order). So:

- a new group **Popular visual styles (with build rules)** holds the ten, reusing the existing previews, and replaces a pick in the big list (one style per product);
- `skills/hs-product/references/style-recipes.md` gives each style a recipe, its traps and the checks it must pass;
- the catalogue's list of vibe-coded tells already warns against "Liquid glass" and "Bento grids by default". Both stay: the tell is using them by reflex, the recipe is using them on purpose.

## The self-hosted tools

These are services to run, not skills, so they became a **Self-hosted building blocks** group of tracked checks, each with its licence caveat and what "done" means.

| Tool | Licence (checked) | Phase and check |
|---|---|---|
| **GlitchTip** | MIT | operate: Sentry-compatible error tracking; done when a deliberate error appears with a stack trace and an alert reaches a person |
| **Gotify** | MIT | operate: alert delivery to phones; done when a failing health check notifies the phones that must get it |
| **Windmill** | AGPL-3.0 and Apache-2.0 source; the prebuilt Community Edition has proprietary parts | operate: back-office jobs and tools; licence question recorded if shown to customers |
| **Vikunja** | AGPL-3.0 | launch: where the waived checks and open questions become a to-do list with owners |
| **celld** | Apache-2.0, alpha | scale: an exit plan for Cloudflare-based products; not the only production path while it is young; peer port kept private |

Weak fits, said plainly: Vikunja is only a convenient home for the launch to-do list, and Windmill only matters if the product has back-office work. They are options, not recommendations, and nothing is installed for you.
