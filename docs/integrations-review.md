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
| vercel-labs/skills (`npx skills`) | Open installer for SKILL.md directories into 75+ agents | MIT | CLI | recommended (`skill-installer`) | Anonymous telemetry unless `DISABLE_TELEMETRY` / `DO_NOT_TRACK`; installs third-party instructions |
| better-auth/better-icons | MCP + CLI + skill: 200k+ icons, 150+ collections | MIT (tool); each collection has its own licence | MCP/CLI/skill | opt-in (`icons`) | Network + writes files; icon-set licence gate added |
| nextlevelbuilder/ui-ux-pro-max-skill | Local design data + design-system generator (styles, palettes, fonts, rules) | MIT | skill + npm CLI | recommended (`design-system-generation`) | Local, no network per README; overlaps taste-skill: one voice only |
| obra/superpowers | Methodology skills: brainstorm, plans, subagent dev, TDD, review | MIT | skill suite | opt-in (`implementation-discipline`) | SessionStart hook + auto-triggering = a second conductor; optional telemetry |
| Uizze (uizze.com) | 800k+ real screen references; hosted MCP + `anti-ui-slop` skill | unknown | hosted MCP + skill | opt-in (`design-reference`) | Site blocked; known only from third-party listings; hosted, data leaves machine |
| Vercel Web Interface Guidelines | UI guidelines; `web-design-guidelines` skill audits code against them | unknown | skill | opt-in (`design-critique`) | Page blocked; skill reportedly fetches rules remotely at run time |
| openai/symphony | Linear-driven agent-per-task manager with proof of work | Apache-2.0 | spec + Elixir ref | opt-in (`task-agents`) | Engineering preview, trusted environments only; Linear/GitHub credentials |
| QwenLM/Qwen3-TTS | TTS, voice design, 3 s voice cloning, 10 languages | Apache-2.0 (code); weights terms unconfirmed | pip package | opt-in (`voiceover`) | Consent for cloned voices; disclose synthetic audio; GPU |
| 666ghj/MiroFish | Multi-agent "prediction" simulation web app | AGPL-3.0 | **not a skill** | reference only | AGPL; needs LLM + Zep Cloud keys; simulations are not demand evidence |
| LOOT guide (other 5 tools) | Marketing funnel PDF listing 7 tools to resell | n/a | - | reference only | x-algorithm, PersonaPlex, Claude for Financial Services, Cloudflare OS, Hunyuan3D-2 not relevant; not vetted |
| whatships.com | - | - | - | unreviewed | Blocked by the network proxy |
| Shared Google Doc | - | - | - | unreviewed | Blocked by the network proxy |

## What changed in the design because of this

1. **Policy lives in data, not prose.** `integrations.json` carries licence, risk and policy; `hyperskill.py integrations` enforces it (opt-in, commercial block, never-use classes). Tested in `tests/test_hyperskill.py`.
2. **Four kinds of entry**, because the list is not all skills: skills/plugins (used through slots), CLIs (herdr, ocr; detected on PATH), guidelines (karpathy), and references (the showreel). Treating them all as "skills" would have been wrong.
3. **gstack overlaps HyperSkill's whole job.** HyperSkill stays the conductor; gstack is only used per slot, and only if the owner enables it.
4. **Install is always the owner's decision.** Several of these register hooks, build browsers, read cookies or run target code.
