# Pre-launch checklist

Tick only with evidence. Anything unticked is fixed or waived (with reason) via `hyperskill.py gate launch --waive`.

## Data and access
- [ ] Cross-tenant access tested and blocked (test output)
- [ ] Auth via proven provider; no custom password handling
- [ ] Every endpoint validates input and checks permissions server-side
- [ ] Payments driven by verified, idempotent webhooks

## Delivery
- [ ] CI blocks merges on failing tests; production deploy has a tested rollback
- [ ] Critical flows covered by end-to-end tests
- [ ] Separate staging and production environments and databases
- [ ] Backups enabled and a restore actually tested

## Protection
- [ ] Security review (fresh context) done; dependencies audited; (external pen-test if sensitive data)
- [ ] Rate limits on login, signup and expensive endpoints
- [ ] No tenant data cached at shared layers

## Operations
- [ ] Errors reach the tracker; logs structured and redacted
- [ ] Uptime checks and alerts, each with a runbook
- [ ] Load tested at expected launch traffic
- [ ] Billing alerts set on every provider

## Legal and trust
- [ ] Terms of service and privacy policy published and linked
- [ ] Cookie/consent handling appropriate to target regions
- [ ] Marketing claims match real behaviour
- [ ] Licences recorded for fonts, music, sound effects, stock/footage, AI-generated media
