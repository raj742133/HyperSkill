#!/usr/bin/env bash
# Start the server on a free port, hit /api/health, stop it. Exit non-zero on any failure.
set -euo pipefail
cd "$(dirname "$0")/.."
export SESSION_SECRET="${SESSION_SECRET:-$(openssl rand -hex 32)}" PORT="${PORT:-3199}" BCRYPT_ROUNDS=4
node --disable-warning=ExperimentalWarning src/server.js >/tmp/duesoon-smoke.log 2>&1 &
pid=$!
trap 'kill $pid 2>/dev/null || true' EXIT
for _ in $(seq 1 30); do curl -sf "localhost:$PORT/api/health/live" >/dev/null && break; sleep 0.2; done
curl -sf "localhost:$PORT/api/health" | tee /dev/stderr | grep -q '"status":"ok"'
