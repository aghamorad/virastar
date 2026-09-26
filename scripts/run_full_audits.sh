#!/usr/bin/env bash
# Run the two full acceptance audits on one adapter.
#
#   scripts/run_full_audits.sh <adapter_dir> <label>
#
# Fuses <adapter_dir>, evaluates on the full valid set (331 rows) and the full
# hard set (110 rows), runs check_eval_report.mjs on each, prints both scores.
#
# Final readiness requires status PASS AND hardIssues 0 on BOTH sets.
#
# NOTE: never run while training or another GPU eval is active — concurrent
# Metal compute crashes BOTH processes.
set -uo pipefail
cd "$(dirname "$0")/.."

VENV=/Users/Morad/.virastar-venv
ADAPTER="${1:?adapter dir required}"
LABEL="${2:?label required}"
BASE="${3:-mlx-community/gemma-3-4b-it-4bit}"
RUN_DIR="data/distill/v4cur6"
VALID=data/distill/v4cur/valid.jsonl
HARD=data/distill/hard_test.jsonl

summary() {  # summary <report-path>
  local report="$1"
  local audit="${report%-report.txt}-audit.json"
  /Users/Morad/.virastar-venv/bin/python - "$report" "$audit" <<'PY'
import json, sys
report, audit = sys.argv[1], sys.argv[2]
try:
    d = json.load(open(audit))
except FileNotFoundError:
    d = {}
status = d.get('status', '?')
hard = d.get('hardIssues', '?')
bycat = d.get('hardIssuesByCategory') or {}
meaning = d.get('meaningReviewRate', '?')
print(f"{report}: status={status} hard={hard} byCat={bycat} meaning={meaning}")
PY
}

echo "== audit 1/2: full valid (331) =="
"$VENV/bin/mlx_lm.fuse" --model "$BASE" --adapter-path "$ADAPTER" \
  --save-path "$RUN_DIR/merged-$LABEL" >/dev/null 2>&1 \
  || { echo "FUSE FAILED"; exit 2; }
"$VENV/bin/python" scripts/eval_v3.py "$VALID" "$RUN_DIR/merged-$LABEL" \
  "$RUN_DIR/full-valid-$LABEL-report.txt" >/dev/null 2>&1
/opt/homebrew/bin/node scripts/check_eval_report.mjs \
  --report "$RUN_DIR/full-valid-$LABEL-report.txt" \
  --json "$RUN_DIR/full-valid-$LABEL-audit.json" >/dev/null 2>&1 || true
summary "$RUN_DIR/full-valid-$LABEL-report.txt"

echo "== audit 2/2: full hard (110) =="
"$VENV/bin/python" scripts/eval_v3.py "$HARD" "$RUN_DIR/merged-$LABEL" \
  "$RUN_DIR/full-hard-$LABEL-report.txt" >/dev/null 2>&1
/opt/homebrew/bin/node scripts/check_eval_report.mjs \
  --report "$RUN_DIR/full-hard-$LABEL-report.txt" \
  --json "$RUN_DIR/full-hard-$LABEL-audit.json" >/dev/null 2>&1 || true
summary "$RUN_DIR/full-hard-$LABEL-report.txt"

echo "AUDITS DONE"
