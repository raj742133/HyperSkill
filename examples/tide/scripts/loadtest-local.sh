#!/usr/bin/env bash
# Starts the dev server on port 4220, load tests it, stops it. Usage: bash scripts/loadtest-local.sh   (USERS and SECONDS can be set)
set -uo pipefail
cd "$(dirname "$0")/.."
PORT=4220 node scripts/serve.js > /dev/null 2>&1 &
pid=$!
trap 'kill $pid 2>/dev/null' EXIT
for _ in $(seq 1 50); do curl -s -o /dev/null "http://127.0.0.1:4220/api/health/live" && break; sleep 0.1; done
BASE=http://127.0.0.1:4220 USERS="${USERS:-50}" SECONDS="${SECONDS_RUN:-10}" node scripts/loadtest.js
