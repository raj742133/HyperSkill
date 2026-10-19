# DueSoon

Tiny deadline tracker for students. Built as a dry run of the HyperSkill pipeline.

## Run
```
cd examples/duesoon && npm install
SESSION_SECRET=$(openssl rand -hex 32) npm run dev   # http://localhost:3000
npm test
```
Config is validated at startup; the server refuses to start if `SESSION_SECRET` is missing or short. See `.env.example`.
