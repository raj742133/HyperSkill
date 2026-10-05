# Skill slots

A slot is a capability a phase needs. HyperSkill never hard-depends on a third-party skill: check what is installed (`ListSkills`), use a match if one exists, otherwise fall back to the built-in behaviour described in the phase skill.

| Slot | Used in | Prefer if installed | Built-in fallback |
|---|---|---|---|
| `deep-research` | hs-research | `deep-research` skill | Parallel `WebSearch` passes by the `hs-researcher` agent, synthesised into `docs/research.md` |
| `frontend-design` | hs-product | design-taste skills (candidates: taste-skill, impeccable, emilkowalski/skills) | `hs-product/references/design-system.md` |
| `security-audit` | hs-harden | candidates: cloudflare/security-audit-skill; built-in `security-review` | `hs-harden/references/security-review.md` run by `hs-reviewer` |
| `code-review` | hs-ship, hs-harden | built-in `code-review`; candidate: open-code-review | `hs-reviewer` agent |
| `browser-verify` | hs-product, hs-ship | built-in `run`, Playwright, Chrome DevTools agent tooling | Playwright via the project's own e2e setup |
| `video` | hs-launch | HyperFrames skills (installed by `npx hyperframes skills`) | `hs-launch/references/video-hyperframes.md` |
| `coding-discipline` | all build phases | candidate: Karpathy-style coding guidelines skill | The non-negotiable rules in `hyperskill/SKILL.md` |
| `workflow-stack` | optional | candidate: gstack | none needed |

**Status of the candidates:** these names come from a reading list the plugin author supplied. They have **not been inspected**. Before relying on one, open its README, confirm what it does, and confirm its licence and that it asks for nothing surprising (network access, credentials). Treat it as optional and never required.

**How to use a slot:** announce it ("Using the `frontend-design` slot via <skill>") so the user knows which tool is steering, then still apply this plugin's gate items; an external skill does not replace a gate.
