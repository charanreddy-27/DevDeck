#!/usr/bin/env bash
# End-to-end smoke test against a production build (`npm run build` first).
#
#   1. No token reaches the browser: the build was made with canary token
#      values, and no client chunk may contain them.
#   2. Demo mode serves simulated data with no tokens at all.
#   3. The password gate locks pages and API routes, and a correct password
#      gets a session cookie that opens them.
#
# Usage: CANARY=<value the build saw as VERCEL_TOKEN/GITHUB_TOKEN> scripts/smoke.sh
set -euo pipefail

PORT="${PORT:-3100}"
BASE="http://127.0.0.1:${PORT}"
NEXT_BIN="node_modules/next/dist/bin/next"
SERVER_PID=""

fail() { echo "smoke: FAIL: $*" >&2; exit 1; }

stop_server() {
  if [ -n "$SERVER_PID" ]; then
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
    SERVER_PID=""
  fi
}
trap stop_server EXIT

start_server() {
  # Started with node directly so $! is the server itself, not an npx wrapper.
  env -u VERCEL_TOKEN -u GITHUB_TOKEN -u VERCEL_TEAM_ID "$@" node "$NEXT_BIN" start -p "$PORT" >/dev/null 2>&1 &
  SERVER_PID=$!
  for _ in $(seq 1 40); do
    curl -s -o /dev/null "$BASE/login" && return 0
    sleep 0.5
  done
  fail "server did not start on $PORT"
}

# 1. Canary tokens never appear in client output.
if [ -n "${CANARY:-}" ]; then
  [ -d .next/static ] || fail ".next/static missing; run npm run build first"
  if grep -rl -- "$CANARY" .next/static >/dev/null 2>&1; then
    fail "a token value was found in client output: $(grep -rl -- "$CANARY" .next/static | head -3)"
  fi
  echo "smoke: ok   no token in .next/static"
fi

# 2. Demo mode.
start_server DEVDECK_DEMO=1
status=$(curl -sf "$BASE/api/status")
echo "$status" | grep -q '"mode":"demo"' || fail "expected demo mode, got: $status"
projects=$(curl -sf "$BASE/api/vercel/projects")
echo "$projects" | grep -q '"projects":\[{' || fail "demo returned no projects"
curl -sf "$BASE/api/vercel/activity" | grep -q '"summary"' || fail "demo activity has no summary"
curl -sf -o /dev/null "$BASE/" || fail "dashboard page did not render"
stop_server
echo "smoke: ok   demo mode serves projects and activity"

# 3. Password gate.
start_server DEVDECK_PASSWORD=smoke-test-password
code=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/vercel/projects")
[ "$code" = "401" ] || fail "API without a session returned $code, expected 401"
location=$(curl -s -o /dev/null -w '%{redirect_url}' "$BASE/")
case "$location" in */login\?next=*) ;; *) fail "page without a session redirected to '$location'" ;; esac
code=$(curl -s -o /dev/null -w '%{http_code}' -H 'content-type: application/json' \
  -d '{"password":"wrong"}' "$BASE/api/auth/login")
[ "$code" = "401" ] || fail "wrong password returned $code, expected 401"
cookie=$(curl -s -D - -o /dev/null -H 'content-type: application/json' \
  -d '{"password":"smoke-test-password"}' "$BASE/api/auth/login" |
  tr -d '\r' | sed -n 's/^[Ss]et-[Cc]ookie: \(devdeck_session=[^;]*\).*/\1/p')
[ -n "$cookie" ] || fail "correct password set no session cookie"
code=$(curl -s -o /dev/null -w '%{http_code}' -H "cookie: $cookie" "$BASE/api/status")
[ "$code" = "200" ] || fail "API with a session returned $code, expected 200"
stop_server
echo "smoke: ok   password gate locks, rejects, and admits"
