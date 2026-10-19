# Pre-launch checklist

Tick an item only with evidence (test run, URL, file). Each unticked item is fixed first or waived with a written reason via `hyperskill.py gate launch --waive`.

## Data and access
- [ ] Requesting another tenant's record by ID is refused; test output saved
- [ ] Sign-in uses an established provider or library; no home-made password hashing
- [ ] Every endpoint validates input and checks permissions server-side
- [ ] If payments exist: webhooks are signature-checked and safe to deliver twice

## Delivery
- [ ] CI blocks merges on failing tests; a production rollback has been rehearsed
- [ ] Sign-up, sign-in, core workflow and any billing or invite flow have end-to-end tests
- [ ] Staging and production are separate, each with its own database and keys
- [ ] Production backups are on and a restore into a scratch database has succeeded

## Protection
- [ ] Security review by someone outside the authoring session; dependency audit clean or explained; external penetration test if sensitive data is handled
- [ ] Throttling on sign-in, sign-up, reset and costly endpoints, using a shared store
- [ ] No tenant-specific data in a shared cache or CDN

## Operations
- [ ] Exceptions reach an error tracker; logs are structured with secrets removed
- [ ] External uptime probes and alerts, each linked to a runbook
- [ ] Load test at expected launch-day traffic, with latency and error figures recorded
- [ ] Spending alerts set with every vendor that bills you

## Legal and trust
- [ ] Terms of service and privacy policy live and linked, reviewed by the owner or a lawyer
- [ ] Cookie and consent handling fits the regions served
- [ ] Every marketing and promo claim matches something the product does today
- [ ] Licences logged for typefaces, icons, music, sound effects, stock and footage, AI-generated media and synthetic voices (written consent for any cloned voice)
