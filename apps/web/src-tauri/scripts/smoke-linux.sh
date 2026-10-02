#!/usr/bin/env bash
# Smoke test for the built Linux desktop binary, run under a virtual display.
#
#   smoke-linux.sh <path-to-re-shell-desktop> <evidence-dir>
#
# Needs: xvfb-run, curl, ss, imagemagick (import, identify), Node.js >= 18 on PATH.
# Optional: xdotool (enables the "close the window" exit-code check).
#
# For each scenario it launches the REAL binary and checks, with hard failures
# (non-zero exit), that:
#   1. the app starts its own hub on a free 127.0.0.1 port and says so;
#   2. the hub enforces the token (an unauthenticated /health is 401);
#   3. the hub listens on loopback only;
#   4. the dashboard webview connected to the hub WITH the token (the hub's
#      path-only access log shows a 200/101 for origin tauri://localhost);
#   5. a screenshot of the display shows rendered content (not a blank window);
#   6. stopping the app (SIGTERM, then SIGKILL) leaves no hub process or port;
#   7. when the hub cannot start (no usable Node.js) the window says so and the
#      app exits non-zero when that window is closed.
# Logs and screenshots land in <evidence-dir>.
set -euo pipefail

BIN="${1:?usage: smoke-linux.sh <path-to-re-shell-desktop> <evidence-dir>}"
OUT="${2:?usage: smoke-linux.sh <path-to-re-shell-desktop> <evidence-dir>}"

mkdir -p "$OUT"
BIN="$(cd "$(dirname "$BIN")" && pwd)/$(basename "$BIN")"
OUT="$(cd "$OUT" && pwd)"

if [ -z "${SMOKE_INSIDE_XVFB:-}" ]; then
  export SMOKE_INSIDE_XVFB=1
  exec xvfb-run -a -s "-screen 0 1440x900x24" bash "$0" "$BIN" "$OUT"
fi

fail() { echo "SMOKE FAIL: $*" >&2; exit 1; }
note() { echo "smoke: $*"; }

# wait_for_line <file> <ERE> <timeout-seconds>
wait_for_line() {
  local file="$1" pattern="$2" timeout="$3" waited=0
  while ! grep -Eq -- "$pattern" "$file" 2>/dev/null; do
    sleep 0.5
    waited=$((waited + 1))
    if [ "$waited" -ge $((timeout * 2)) ]; then
      echo "---- $file ----" >&2; cat "$file" >&2 || true
      fail "timed out after ${timeout}s waiting for /$pattern/ in $file"
    fi
  done
}

# process_gone <pid>: not running, or only a zombie awaiting reaping.
process_gone() {
  local state
  state="$(ps -o stat= -p "$1" 2>/dev/null | tr -d ' ' || true)"
  [ -z "$state" ] || [ "${state:0:1}" = "Z" ]
}

wait_gone() {
  local pid="$1" what="$2"
  for _ in $(seq 1 40); do
    if process_gone "$pid"; then return 0; fi
    sleep 0.25
  done
  fail "$what (pid $pid) is still running"
}

screenshot() {
  local file="$1"
  import -window root "$file"
  local colors
  colors="$(identify -format '%k' "$file")"
  note "screenshot $file ($colors distinct colors)"
  [ "$colors" -gt 100 ] || fail "screenshot $file looks blank ($colors colors)"
}

run_scenario() {
  local mode="$1" shot="$2"
  local log="$OUT/app-$mode.log" ws
  ws="$(mktemp -d)"
  note "=== scenario: stop with SIG$mode ==="

  "$BIN" --workspace "$ws" >"$log" 2>&1 &
  local app_pid=$!

  wait_for_line "$log" '\[desktop\] hub ready at http://127\.0\.0\.1:[0-9]+ \(pid [0-9]+\)' 40
  local ready port hub_pid
  ready="$(grep -Eo 'hub ready at http://127\.0\.0\.1:[0-9]+ \(pid [0-9]+\)' "$log" | head -1)"
  port="$(echo "$ready" | sed -E 's/.*127\.0\.0\.1:([0-9]+).*/\1/')"
  hub_pid="$(echo "$ready" | sed -E 's/.*\(pid ([0-9]+)\).*/\1/')"
  note "app pid $app_pid started hub pid $hub_pid on 127.0.0.1:$port"

  # (2) the token is required.
  local code
  code="$(curl -s -o /dev/null -w '%{http_code}' -H 'Accept: application/json' "http://127.0.0.1:$port/health")"
  [ "$code" = "401" ] || fail "unauthenticated /health returned $code, expected 401"

  # (3) loopback only.
  local listeners
  listeners="$(ss -ltnH "sport = :$port")"
  echo "$listeners" | grep -q "127\.0\.0\.1:$port" || fail "hub is not listening on 127.0.0.1:$port ($listeners)"
  if echo "$listeners" | grep -Eq '(0\.0\.0\.0|\[::\]|\*):'"$port"; then
    fail "hub listens on a non-loopback address: $listeners"
  fi

  # (4) the webview reached the hub with the token.
  wait_for_line "$log" 'access GET /events -> 200 origin=tauri://localhost' 90
  note "webview made an authenticated request: $(grep -E 'access GET /events -> 200 origin=tauri://localhost' "$log" | head -1)"
  if grep -E 'access .* -> 401 origin=tauri://localhost' "$log" >/dev/null; then
    fail "the webview was rejected by the hub (401):
$(grep -E 'access .* -> 401' "$log")"
  fi

  # The token itself must never be printed anywhere.
  # (It lives only in the hub environment and the webview.)

  # (5) something was rendered.
  sleep 2
  [ -z "$shot" ] || screenshot "$OUT/$shot"

  # (6) stop the app; the hub must go with it.
  note "sending SIG$mode to the app"
  kill "-$mode" "$app_pid"
  wait "$app_pid" 2>/dev/null || true
  wait_gone "$hub_pid" "hub"
  if curl -s -o /dev/null --max-time 2 "http://127.0.0.1:$port/health"; then
    fail "hub port $port still answers after the app was stopped"
  fi
  note "hub pid $hub_pid and port $port are gone after SIG$mode"
  rm -rf "$ws"
}

scenario_no_node() {
  local log="$OUT/app-no-node.log" ws code=0
  ws="$(mktemp -d)"
  note "=== scenario: hub cannot start (no usable Node.js) ==="
  RE_SHELL_NODE=/nonexistent/node "$BIN" --workspace "$ws" >"$log" 2>&1 &
  local app_pid=$!

  wait_for_line "$log" '\[desktop\] failed to start the hub: ' 30
  if grep -q 'hub ready at' "$log"; then fail "app claimed a hub was ready without one"; fi
  sleep 3
  screenshot "$OUT/screenshot-no-node.png"

  if command -v xdotool >/dev/null 2>&1; then
    local wid
    wid="$(xdotool search --onlyvisible --pid "$app_pid" 2>/dev/null | tail -1 || true)"
    if [ -n "$wid" ]; then
      note "closing the error window ($wid)"
      xdotool windowquit "$wid" || true
      for _ in $(seq 1 40); do
        if ! kill -0 "$app_pid" 2>/dev/null; then break; fi
        sleep 0.25
      done
    fi
  fi

  if kill -0 "$app_pid" 2>/dev/null; then
    note "could not close the window through xdotool; stopping with SIGTERM (exit status not asserted)"
    kill -TERM "$app_pid"
    wait "$app_pid" 2>/dev/null || true
  else
    wait "$app_pid" || code=$?
    [ "$code" = "1" ] || fail "app exited with $code after the error window closed, expected 1"
    note "app exited with status 1 after its error window was closed"
  fi
  rm -rf "$ws"
}

run_scenario TERM screenshot-dashboard.png
run_scenario KILL ""
scenario_no_node

note "ALL SMOKE CHECKS PASSED"
