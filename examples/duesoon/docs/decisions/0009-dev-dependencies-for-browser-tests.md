# 0009. Dev dependencies for browser tests

- Date: 2026-10-19T18:26:13Z
- Phase: product

## Decision
Add playwright-core and axe-core as devDependencies; e2e runs against the system Chromium (no browser download)

## Why
The playbook requires e2e tests for critical flows and an automated accessibility check; assumed for dogfood (owner not consulted)

## Alternatives considered
_Add here._

## Consequences
_Add here._
