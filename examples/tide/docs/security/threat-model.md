# Threat model: Tide

Scope: the Tide page (static files) and its small local dev server. No accounts, no server-side data, no outgoing requests after load.

## Assets
| Asset | Why it matters |
|---|---|
| The visitor's timer settings and today's finished-session count (browser local storage) | Low value, but it is the only data the page keeps |
| The visitor's trust that the page does nothing else | The page's whole promise is that it makes no requests and keeps no cookies |
| The integrity of the files the host serves | A changed `app.js` would run in every visitor's browser |
| The repository and its deploy path (GitHub to Vercel) | Whoever can push to `main` can change what visitors run |

## Entry points
1. **Text and number inputs**: only the three length fields in the settings dialog. Values are clamped to 1-120 and 1-60 minutes and never written into the page as HTML.
2. **Local storage**: read at load. A tampered value is parsed defensively (bad JSON or wrong types fall back to defaults).
3. **The URL**: the page reads nothing from the query string or fragment.
4. **The host's static files** and the response headers the host sends.
5. **The dev server** (`scripts/serve.js`): local only (127.0.0.1), allow-list of eight files, GET only.
6. **The supply chain**: two dev-only npm packages and GitHub Actions. Nothing is shipped from npm to visitors.

## Threats and mitigations
| Threat | Mitigation | Evidence |
|---|---|---|
| Script injection through a field or stored value | No `innerHTML` with user data; numbers only; a strict Content-Security-Policy on `/tide` (`script-src 'self'`, `connect-src 'none'`, `font-src 'none'`), set by its own rule in `vercel.json` (the site's broader policy allows fonts and same-origin requests for other pages and is deliberately not applied to `/tide`) | Browser test "script-injection probe" (payloads in the fields and in tampered stored settings); CSP tests in `tests/serve.test.js` and `tests/test_site.py` |
| The page quietly starts contacting another site | `connect-src 'none'` stops any request; a browser test fails on any request after load | privacy browser test |
| Path traversal on the dev server | File allow-list (eight files), matched against the raw URL with no decoding, so no encoded form reaches a file | server test (`/../package.json` is 404) |
| A tampered local-storage value breaks the page | Parsed with fallbacks; blocked or empty storage is tested | browser test (storage refused) |
| A secret is committed | CI secret scan of the working tree and history. A pre-commit hook exists but is **opt-in**: it only runs after `git config core.hooksPath examples/tide/.githooks` | `scripts/secret-scan.sh`, CI step |
| A vulnerable dependency | `npm audit` in CI, weekly Dependabot PRs; dev-only, so none reaches visitors | CI, `.github/dependabot.yml` |
| A malicious change to the deployed files | Changes only by pull request; a test fails when the deployed copy differs from the source. **Branch protection is not configured by this repo and should be on** | site test; open item |
| Clickjacking | `frame-ancestors 'none'` | site header |
| Denial of service | Static files only; the host's own limits apply; no expensive endpoint exists | n/a |
| Timer manipulation (clock changed) | Affects only the visitor's own timer; time left is capped at the session length | unit test |

## Not in scope or not covered
Accounts, passwords and sessions (none exist). Attacks on the visitor's browser or operating system. The host's own security. Real-phone behaviour.
