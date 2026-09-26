#!/usr/bin/env bash
# Evaluate one checkpoint deterministically on a dataset.
#
#   scripts/eval_ckpt.sh <adapter_dir> <label> [dataset] [base_model]
#
# Fuses <adapter_dir> into the base model, writes the merged model to
# data/distill/v4cur6/merged-<label>, runs scripts/eval_v3.py on the dataset
# (default: the 44-case diagnostic), then runs scripts/check_eval_report.mjs.
# Prints status / hard / byCat / meaning at the end.
#
# NOTE: never run this while a training job or another GPU eval is active —
# concurrent Metal compute crashes BOTH processes. Run evals strictly after
# training finishes.
#
# NOTE: check_eval_report.mjs exits 1 when a checkpoint has hard issues. That
# is a valid result, not a harness failure — so this script never propagates
# the gate's exit code (a runner loop with `set -e` must not abort on it).
set -uo pipefail
cd "$(dirname "$0")/.."

VENV=/Users/Morad/.virastar-venv
ADAPTER="${1:?adapter dir required}"
LABEL="${2:?label required}"
DATASET="${3:-/private/tmp/virastar-v4-diagnostic.jsonl}"
BASE="${4:-mlx-community/gemma-3-4b-it-4bit}"
RUN_DIR="data/distill/v4cur6"
MERGED="$RUN_DIR/merged-$LABEL"

mkdir -p "$RUN_DIR"
echo "== fusing $ADAPTER -> $MERGED =="
if ! "$VENV/bin/mlx_lm.fuse" \
  --model "$BASE" \
  --adapter-path "$ADAPTER" \
  --save-path "$MERGED" \
  >/dev/null 2>&1; then
  echo "FUSE FAILED: $ADAPTER"
  exit 2
fi

echo "== evaluating on $(basename "$DATASET") =="
REPORT="$RUN_DIR/diag-$LABEL-report.txt"
"$VENV/bin/python" scripts/eval_v3.py "$DATASET" "$MERGED" "$REPORT" 2>&1 \
  | tail -n 1 || true
echo "report written to $REPORT"
/opt/homebrew/bin/node scripts/check_eval_report.mjs \
  --report "$REPORT" \
  --json "$RUN_DIR/diag-$LABEL-audit.json" \
  || true
python3 - "$LABEL" "$REPORT" <<'PY'
import json, sys
label, report = sys.argv[1], sys.argv[2]
audit = report.rsplit('-report.txt', 1)[0] + '-audit.json'
try:
    d = json.load(open(audit))
except FileNotFoundError:
    # audit path derived differently; read report directly for the summary line
    d = {}
status = d.get('status', '?')
hard = d.get('hardIssues', 0)  # audit stores the count, not the list
bycat = d.get('hardIssuesByCategory') or {}
meaning = d.get('meaningReviewRate', '?')
print(f"{label}: status={status} hard={hard} byCat={bycat} meaning={meaning}")
PY
