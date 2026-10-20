# Chaser (experiment)

A no-accounts page that writes three payment-reminder messages for freelancers. It is an experiment to test demand, not a product. Start with `docs/research.md`, then `docs/system-design.md`.

## Run
```
cd examples/chaser
OPERATOR_TOKEN=$(openssl rand -hex 16) npm run dev    # http://127.0.0.1:3000
npm test
```
Current state: scaffold only (health endpoints, security headers, config validation). The message generator is not built yet.
