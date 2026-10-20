# Operations: Tide

What can be observed, and what cannot. Tide is static files; the only process that logs is the local dev server.

## Logs
`scripts/serve.js` writes one JSON line per request: `level`, `time`, `id` (a random UUID, also sent back as the `x-request-id` header), `method`, `path`, `status`, `ms`. The query string is dropped, so nothing a visitor typed into a URL is recorded. There is no user id because there are no users. Tests: `tests/serve.test.js` ("every request gets an id, one JSON log line carries it, and nothing from the visitor is logged") sends a request carrying a fake token and password in the URL and checks neither appears in the log.
The deployed site's request logs belong to the host and are outside this repository.

## Health
`GET /api/health` on the dev server checks that every file the page needs can be read and answers `200 {"status":"ok","files":8}` or `503 {"status":"degraded","missing":[...]}`; `GET /api/health/live` is the cheap liveness check. There is no database, cache or job system to check. Test: a directory missing `liquid.js` gives 503 naming it.

## Catch blocks (audited 2026-10-20)
| Where | What it catches | Why it is not silent |
|---|---|---|
| `app.js` load() | A bad or unavailable stored value | Falls back to defaults; the value is then re-validated by `clean()`; browser test with tampered storage |
| `app.js` save() | Storage refused (private window) | Settings will not persist, which the page cannot fix; browser test "it still works when the browser refuses to store anything" |
| `app.js` unlockAudio() | No audio support | `chime()` then turns sound off and the button shows it |
| `app.js` chime() | No audio support | Turns sound off and repaints the button |
| `serve.js` health() and file read | A missing file | Reported as degraded (503) or a 404 |
| `serve.js` start-up | A bad PORT | Prints the message and exits with code 1; unit test |
No empty `catch` blocks remain, and none catches an error type it does not expect to handle.

## Not available here
- **Error tracker:** none. The page sends nothing anywhere by design, so a browser error is not reported to us. A visitor would have to tell us.
- **Alerts and uptime probes:** none, because they need a monitoring provider this environment does not have. The incident runbook (`docs/runbooks/incident.md`) says what to do when someone reports the page down, and says plainly that nobody is told automatically.
- **Status page of our own:** none; the host's status page is linked from the runbook.
