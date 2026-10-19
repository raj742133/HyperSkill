# Sources and licensing

## Inputs used to design HyperSkill

1. **"Vibe Coding a Real SaaS: The 15-Layer Playbook"** (PDF, supplied by the repo owner). Basis for phases 1-6 and 8: the layer structure, the "what agents get wrong / decisions you own / verify" framing, and the golden rules. The prompts and checklists in `skills/hs-*/references/` are condensed and reworded from it and adapted to be stack-agnostic.
2. **"Motion Graphics with Claude Code" starter kit** by Damiano Caudullo (zip, supplied by the repo owner; both `prompts.md` and the 20-page PDF guide inside it were read; the practice clip, practice screenshots, fonts and sound effects were not used). Original basis for `skills/hs-launch/references/` (since rewritten, see Licensing status); the kit's fonts, sound effects, screenshots and clip are **not** copied into this repository.
3. **A reading list of links** (`skills.pdf`). Each link was read on 2026-10-05 via fetch-and-summarise (README level, not a source audit) and recorded in `skills/hyperskill/integrations.json` and `docs/integrations-review.md`. Three links (`whatships.com`, the shared Google Doc, and initially Chrome DevTools) were blocked by the network proxy; the first two remain unread.

4. **Further links supplied later** (`LOOT_Guide.pdf`, vercel-labs/skills, MiroFish, better-icons, ui-ux-pro-max-skill, Superpowers, Uizze, Vercel design guidelines). Read on 2026-10-05/06 at README level; Uizze and the Vercel guidelines page were blocked, so their entries rest on third-party listings and are marked unverified. See `docs/integrations-review.md`.

5. **"Vibe Coding: A Complete Beginner-to-Production Guide"** (text pasted by the owner; it appeared to be the shared Google Doc from the reading list, but the paste was cut off at step 40 and the link itself could not be opened). Source of `skills/hyperskill/references/working-loop.md` (TASKS/MEMORY/decisions split, vertical slices, structured task and debug prompts, lite profile). Reworded; authorship and licence unknown.

6. **Instagram carousel of four design-pass prompts** (@web_pros, screenshots supplied by the owner). Source of the designer pass in `skills/hs-product/references/design-system.md`. Reworded; not copied.

7. **Six more repositories** (hypit, openui, ponytail, SlopMonster, rea, api-anything), read at README level on 2026-10-19. See `docs/integrations-review.md`.

## Licensing status (updated 2026-10-19)

HyperSkill's own code and text are under the MIT licence (`LICENSE`, copyright line names the GitHub owner; change it to your legal name if you prefer).

**Derived reference text was rewritten.** Inputs 1, 2, 5 and 6 above (the playbook PDF, the starter kit, the pasted guide and the carousel screenshots) state no licence. On 2026-10-19 the files that were condensed from them were rewritten with new structure, headings, examples and wording: the plan, foundation, ship, harden and operate playbooks, `security-review.md`, `prelaunch.md`, `claude-md-template.md`, `working-loop.md`, `design-system.md` (designer pass), `styles.md` and `video-hyperframes.md`. Numbered-layer schemes, prompt templates and the kit's style-preset names were dropped. The video file's commands were re-sourced from the locally installed HyperFrames skill documentation.

**What this is not.** The rewrites were done by a model that had already read the originals, so it is not a clean-room reimplementation, and nobody has compared the old and new text for similarity. The gate items themselves (`gates.json`) are short practice checklists. If you want certainty, ask the authors for permission or have a person review the diff of those files against the sources before you publish. Facts, command names and flags are not copyrightable but may still be wrong; see below.

**Still true:**
- Third-party skills are referenced, never vendored. Re-vet and pin a version before enabling any; `onetake` is PolyForm Noncommercial and must not be used on a commercial project; `claude-opus5.5-video` states no licence.
- The kit's fonts and sound effects are not in this repository; check each file's licence before bundling any.
- Installing the plugin from a local folder copies untracked files too (for example `examples/duesoon/node_modules`); installing from the GitHub source copies tracked files only.

## Not verified

- The `npx hyperframes ...` commands in `video-hyperframes.md` were checked by reading the locally installed HyperFrames skill documentation and have not been run; the file lists what stays unverified.
