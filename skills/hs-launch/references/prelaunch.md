# Pre-launch checklist

Tick only with evidence (test run, URL, file). Fix each unticked item or waive it with a reason via `hyperskill.py gate launch --waive`.

## Data and access
- [ ] Requesting another tenant's record by ID is refused; test output saved
- [ ] Sign-in uses an established provider or library; no home-made password hashing
- [ ] Every endpoint validates input and checks permissions server-side
- [ ] Payment webhooks are signature-checked and safe to replay

## Delivery
- [ ] CI blocks merges on failing tests; a production rollback has been rehearsed
- [ ] Sign-up, sign-in, core workflow, billing and invites have end-to-end tests
- [ ] Staging and production separate, with their own databases and keys
- [ ] Production backups on; a restore into a scratch database has succeeded

## Protection
- [ ] Security review outside the authoring session; dependencies audited; external penetration test if data is sensitive
- [ ] Throttling on sign-in, sign-up, reset and costly endpoints, using a shared store
- [ ] No tenant-specific data in a shared cache or CDN

## Operations
- [ ] Exceptions reach an error tracker; logs are structured with secrets removed
- [ ] Uptime probes and alerts, each with a runbook
- [ ] Load test at expected launch traffic, figures recorded
- [ ] Spending alerts on every billing vendor

## Legal and trust
- [ ] Terms of service and privacy policy published and linked
- [ ] Cookie and consent handling fits the target regions
- [ ] Every marketing and promo claim matches something the product does today
- [ ] Licences logged: typefaces, icons, music, sound effects, stock and footage, AI-generated media, synthetic voices (written consent for any cloned voice)
