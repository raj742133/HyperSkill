# Integration review (2026-10-05)

Method: each link from the supplied reading list was fetched and summarised from its README/docs. This is **README-level vetting, not a source audit**: before enabling anything, open it yourself, read any install/setup script, and pin a version.

| Entry | What it is | Licence | Skill? | Policy in HyperSkill | Why |
|---|---|---|---|---|---|
| heygen-com/hyperframes | HTML/CSS -> deterministic MP4; ~21 agent skills (product-launch-video, faceless-explainer, embedded-captions, talking-head-recut, motion-graphics) | Apache-2.0 | plugin | recommended (`video`) | Core of the launch phase; local rendering, no network needed |
| mathiaschu/watch (`/watch`) | Lets Claude "watch" a video: frames + local transcription | MIT | plugin | opt-in (`video-analysis`) | Downloads media, can read browser cookies, 1.5 GB model |
| feitangyuan/onetake | Seamless no-cut launch videos | **PolyForm Noncommercial** | skill | **blocked on commercial projects** | Licence forbids commercial use |
| SuhaasNv/claude-opus5.5-video | A code-generated 15 s showreel project | none stated | **not a skill** | reference only | No licence; inspiration, not a dependency |
| herdrdev/herdr | Terminal multiplexer/runtime for agents (persistent panes, socket API) | Apache-2.0 | **not a skill** (CLI) | opt-in (`parallel-terminals`) | Separate runtime; curl-pipe installer; useful for parallel sessions |
| cloudflare/security-audit-skill | 6-phase audit with independent verification, JSON findings | MIT | skill | recommended (`security-audit`) | Must run in an OS sandbox, networking off; needs sub-agents |
| Leonxlnx/taste-skill | Design-direction skills with variance/motion/density dials | MIT | skills | recommended (`design-direction`) | Image-gen variants unused |
| pbakaus/impeccable | `/impeccable` ~24 commands + 61 local detector rules | Apache-2.0 | plugin | recommended (`design-critique`) | Installs a design hook on file edits |
| emilkowalski/skills | Animation craft, prototype, pick-ui-library, mobile feel | MIT | skills | recommended (`animation`, `ui-library-choice`) | - |
| alibaba/open-code-review | `ocr` CLI: LLM review of git diffs | Apache-2.0 | **CLI** | opt-in (`code-review`) | Normal mode sends changed files to an LLM provider with your key; use delegation mode |
| multica-ai/andrej-karpathy-skills | Four coding-discipline principles (CLAUDE.md) | MIT | guidelines | recommended (`coding-discipline`) | The page's install id names a different owner (forrestchang/...) - confirm canonical repo; mostly duplicates our own rules |
| garrytan/gstack | 23-role workflow: Think -> Plan -> Build -> Review -> Test -> Ship -> Reflect | MIT | skill suite | opt-in, à la carte | A competing conductor; hooks, optional telemetry, ~500 MB Chromium, API key for some features |
| Chrome DevTools for agents (developer.chrome.com) | MCP server + CLI + skills to drive a live browser, traces, a11y/perf debugging | see docs | MCP+skills | recommended (`browser-verify`, `performance-audit`, `a11y-audit`) | Acts with the browser session's privileges: clean profile only |
| whatships.com | - | - | - | unreviewed | Blocked by the network proxy |
| Shared Google Doc | - | - | - | unreviewed | Blocked by the network proxy |

## What changed in the design because of this

1. **Policy lives in data, not prose.** `integrations.json` carries licence, risk and policy; `hyperskill.py integrations` enforces it (opt-in, commercial block, never-use classes). Tested in `tests/test_hyperskill.py`.
2. **Four kinds of entry**, because the list is not all skills: skills/plugins (used through slots), CLIs (herdr, ocr; detected on PATH), guidelines (karpathy), and references (the showreel). Treating them all as "skills" would have been wrong.
3. **gstack overlaps HyperSkill's whole job.** HyperSkill stays the conductor; gstack is only used per slot, and only if the owner enables it.
4. **Install is always the owner's decision.** Several of these register hooks, build browsers, read cookies or run target code.
