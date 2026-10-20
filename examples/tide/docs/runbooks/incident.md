# Incident runbook: Tide

Tide is static files on Vercel, linked from the HyperSkill site. There is no database, login, queue or scheduled job, so nearly every incident is one of three things.

## 1. The page is down or blank
1. Open https://hyperskill-hazel.vercel.app/tide in a private window. If the HyperSkill home page also fails, it is the host: check the Vercel status page (https://www.vercel-status.com/) and wait.
2. If only `/tide` fails: open the Vercel project's latest deployment and read its build log. A failed deploy keeps the previous version live, so visitors usually see the last good page.
3. Compare the deployed files with the source: `python3 -m unittest tests.test_site` from the repository root. A mismatch means the copy in `site/tide/` is stale: run the copy step in `examples/tide/CLAUDE.md` and open a pull request.
4. **Roll back:** in Vercel, promote the last good deployment (Deployments, the three-dot menu, "Promote to Production" or "Instant Rollback"), or revert the bad commit on `main` with a pull request. No data needs restoring.

## 2. The timer is wrong or the animation is broken for some visitors
1. Ask for the browser, device and whether sound or reduced motion is on.
2. Reproduce with `CHROME_PATH=... npm run test:e2e` and the specific test. The fake-clock tests show whether the logic is at fault.
3. A visitor can always reset the page's stored settings: clear site data for the page.

## 3. A security concern (a changed file, a leaked key)
1. Do not discuss it in a public issue. Rotate any exposed key at once.
2. Check the commit history for the file (`git log -p -- site/tide`) and the deployment list for deploys nobody made.
3. Revert as in section 1, then run `bash examples/tide/scripts/secret-scan.sh --history`.

## What there is not
No status page of our own, no pager, no error tracker (the page reports nothing, by design). If the page is down nobody is told automatically. Anyone who wants that would add an external uptime check on the URL above and link it here.
