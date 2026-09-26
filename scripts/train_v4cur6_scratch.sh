#!/usr/bin/env bash
# Train v4cur6 FROM SCRATCH (no resume) on the register-voice repaired
# curriculum. The resumed run (train_v4cur6.sh) peaked at step-100 then
# degraded — its trajectory inherited step-400's old-curriculum behavior.
# A clean start is the test of whether the repaired data alone carries the
# model to ≥75% register coverage in all six gate modes.
#
# Usage: scripts/train_v4cur6_scratch.sh [iters]
set -euo pipefail
cd "$(dirname "$0")/.."

VENV=/Users/Morad/.virastar-venv
BASE=mlx-community/gemma-3-4b-it-4bit
DATA=data/distill/v4cur6
ADAPTERS="$DATA/scratch-adapters"
ITERS="${1:-600}"

mkdir -p "$ADAPTERS"
/opt/homebrew/bin/ollama stop gemma2:9b >/dev/null 2>&1 || true

"$VENV/bin/mlx_lm.lora" \
  --model "$BASE" \
  --train \
  --fine-tune-type lora \
  --data "$DATA" \
  --batch-size 1 \
  --iters "$ITERS" \
  --learning-rate 5e-5 \
  --steps-per-eval 25 \
  --val-batches 40 \
  --save-every 25 \
  --grad-checkpoint \
  --mask-prompt \
  --seed 7 \
  --config "$DATA/../lora.yaml" \
  --adapter-path "$ADAPTERS" \
  2>&1 | tee "$DATA/train-v4cur6-scratch.log"

echo "TRAINING DONE"
