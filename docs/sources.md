# Sources and licensing

## Inputs used to design HyperSkill

1. **"Vibe Coding a Real SaaS: The 15-Layer Playbook"** (PDF, supplied by the repo owner). Basis for phases 1-6 and 8: the layer structure, the "what agents get wrong / decisions you own / verify" framing, and the golden rules. The prompts and checklists in `skills/hs-*/references/` are condensed and reworded from it and adapted to be stack-agnostic.
2. **"Motion Graphics with Claude Code" starter kit** by Damiano Caudullo (zip, supplied by the repo owner). Basis for `skills/hs-launch/references/`: the HyperFrames setup steps, deliverable recipes, the four style presets and the export commands. Written in our own words; the kit's fonts, sound effects, screenshots and clip are **not** copied into this repository.
3. **A reading list of links** (`skills.pdf`). Informed the skill-slot table in `skills/hyperskill/references/slots.md`. **None of the linked repositories has been inspected**; they are listed as candidates only.

## Open licensing items (action needed before making this repo public)

- Neither the playbook PDF nor the starter kit states a licence in the files reviewed (the kit's `fonts/` folder carries an OFL text; the rest does not). Because HyperSkill's reference material is derived from them, get the authors' permission or replace derived passages with original text before publishing.
- If you want to bundle the kit's fonts or sound effects, check each file's licence first (open fonts under the SIL OFL can be redistributed with the licence text).
- Third-party skills named in the slot table must be reviewed (purpose, licence, permissions) before being recommended or vendored.

## Not verified

- The `npx hyperframes ...` flags are taken from the starter kit's cheat sheet and have not been run in this environment.
