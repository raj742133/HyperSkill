# Security

## What is in scope

Hyperfigure is a set of instructions, a drawing kit and local Node scripts. The scripts that start Chrome (`capture.mjs`, `drive.mjs`, `lines.mjs`, `turn-check.mjs`) run it headless with a throwaway profile and `--allow-file-access-from-files`, and `drive.mjs` runs JavaScript you pass it in the page. Point them only at pages you trust.

A security problem is anything in this repository that could let a page, a prompt or a file run code, read files or reach the network in a way the user did not ask for: in the kit, in the scripts, in the built example pages, or in instructions in `SKILL.md` and `references/` that would lead Claude to do something unsafe.

## Supported versions

Only the latest commit on `main` is supported.

## Reporting a vulnerability

Please don't open a public issue for a security problem. Report it privately to the owner of this repository, `raj742133`, through GitHub's [private vulnerability reporting](https://github.com/raj742133/HyperSkill/security/advisories/new) for `raj742133/HyperSkill`, if it is enabled there. If it is not, open an issue that only asks for a private way to report, without describing the problem.

Include what you found, how to reproduce it, and what it could let someone do.
