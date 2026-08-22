#!/usr/bin/env bash
# Master distillation pipeline: waits for dataset generation, trains the 2B
# QLoRA, fuses + exports GGUF, then A/Bs the small model vs the teacher.
set -euo pipefail
cd "$(dirname "$0")/.."
LOG=data/distill/pipeline.log
exec > >(tee -a "$LOG") 2>&1

echo "== $(date) pipeline start =="

echo "== waiting for dataset generation =="
while pgrep -f "tsx scripts/generate_dataset" >/dev/null; do sleep 20; done
sleep 5
echo "records: $(wc -l < data/distill/all.jsonl)"
tail -n 3 /tmp/virastar-model/gen.log || true

echo "== training =="
bash scripts/train.sh

echo "== fusing adapters into base =="
VENV=/Users/Morad/.virastar-venv
BASE=mlx-community/gemma-2-2b-it-4bit
"$VENV/bin/mlx_lm.fuse" --model "$BASE" \
  --adapter-path data/distill/adapters \
  --save-path data/distill/merged

echo "== exporting GGUF =="
"$VENV/bin/mlx_lm.fuse" --model "$BASE" \
  --adapter-path data/distill/adapters \
  --export-gguf --gguf-path data/distill/virastar-small-fa.gguf

echo "== A/B eval vs teacher =="
"$VENV/bin/python" scripts/eval.py

echo "== $(date) PIPELINE COMPLETE =="
du -sh data/distill/merged data/distill/virastar-small-fa.gguf 2>/dev/null || true
