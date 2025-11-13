#!/usr/bin/env bash
set -euo pipefail
INTERVAL="${1:-30}"
OUT="live_sales_coach_tests.txt"
JSON="live_sales_coach_tests.json"
TMP="tmp_sales_coach_run.txt"

echo "[watch] Starting multi-turn sales coach test watch (interval=${INTERVAL}s). Ctrl+C to stop." >&2

run_once() {
  TS=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  # Execute existing multi-turn test script
  if bash test_multiturn_sales_coach.sh >"${TMP}" 2>&1; then
    STATUS="ok"
  else
    STATUS="error"
  fi
  {
    echo "=== Run at ${TS} (status=${STATUS}) ===";
    cat "${TMP}";
    echo;
  } >>"${OUT}"

  python3 - <<'PY' "${TMP}" "${JSON}" "${TS}" "${STATUS}" >/dev/null 2>&1 || true
import json,sys
raw=open(sys.argv[1]).read()
open(sys.argv[2],'w').write(json.dumps({
  'timestamp': sys.argv[3],
  'status': sys.argv[4],
  'raw': raw
}, indent=2))
PY
}

# Initial run
run_once

# Loop
while true; do
  sleep "${INTERVAL}"
  run_once
done
