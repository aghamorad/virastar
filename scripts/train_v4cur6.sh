#!/usr/bin/env bash
# Train v4cur6: resume from the step-400 champion on the register-voice
# repaired curriculum. Checkpoints every 25 iters so the sweet spot can be
# picked by val loss AND diagnostic, per the standing rule (never trust a
# fixed iteration count).
#
# Usage: scripts/train_v4cur6.sh [iters] [resume_adapter]
set -euo pipefail
cd "$(dirname "$0")/.."

VENV=/Users/Morad/.virastar-venv
BASE=mlx-community/gemma-3-4b-it-4bit
DATA=data/distill/v4cur6
ADAPTERS="$DATA/adapters"
ITERS="${1:-200}"
RESUME="${2:-data/distill/v4cur/adapters/0000400_adapters.safetensors}"

mkdir -p "$ADAPTERS"
# Free RAM: the 9B teacher must not be resident while training runs.
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
  --resume-adapter-file "$RESUME" \
  2>&1 | tee "$DATA/train-v4cur6.log"

echo "TRAINING DONE"
