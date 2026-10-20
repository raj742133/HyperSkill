# Independent security review: Tide

Reviewer: a fresh read-only subagent that did not write the code. It read the threat model and tried to prove it wrong, including hostile requests against the dev server. Its report is a set of findings, not instructions. Date: 2026-10-20.

**Result: nothing exploitable.** No XSS sink, no path traversal, no log or header injection, no unbounded resource use. Tried and held: about 17 hostile paths (encoded dots and slashes, null bytes, backslashes, double slashes, case changes, absolute-form request lines, a 12 KB path), CR/LF and forged-JSON in the path and log, every browser sink in `app.js` and `liquid.js` (no `innerHTML`, `eval`, `fetch`, dynamic `href` or `src`), the `style.cssText` ripple (numbers only), tampered local storage, the GitHub workflow (pull_request not pull_request_target, read-only token, no expressions in `run:`).

| # | Sev | Finding | Disposition |
|---|---|---|---|
| 1 | Med-low | The deployed policy on `/tide` allowed font hosts and same-origin requests (the site's broad rule), contradicting the threat model, which says `connect-src 'none'`; the dev server's comment also claimed to match production | **Fixed.** `vercel.json` now gives `/tide` and `/chaser` their own strict policy and the broad rule excludes them; a site test checks both. To be confirmed on the live URL after deploy |
| 2 | Low | Threat model said six files (eight), pointed at no xss test, and called the pre-commit hook enforced | **Fixed.** Counts, test names and "opt-in hook" corrected |
| 3 | Low | The pre-commit hook broke on file names with spaces or glob characters, so a secret in such a file could pass | **Fixed.** NUL-separated file list; checked on a scratch repository with a staged `a b.js` holding a fake key: blocked |
| 4 | Info | HEAD requests to the dev server give 404; 404 responses lack `nosniff` | Accepted, not exploitable |
| 5 | Info | Privacy page did not mention the stored date | **Fixed** |
| 6 | Info | GitHub Actions are pinned to major tags, not commit SHAs | Accepted; Dependabot watches the `github-actions` ecosystem |

Residual risk, unchanged: branch protection on `main` is a repository setting this repository cannot enforce.
