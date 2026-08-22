#!/usr/bin/env bash
# Distillation fine-tune: QLoRA on Gemma 2 2B, supervised on the teacher's
# edits. Run after scripts/generate_dataset.ts has produced data/distill/train.jsonl.
set -euo pipefail
cd "$(dirname "$0")/.."

VENV=/Users/Morad/.virastar-venv
BASE=mlx-community/gemma-2-2b-it-4bit
DATA=data/distill
ADAPTERS="$DATA/adapters"
# Sources held out of training so we can honestly A/B the small model against
# the 9B teacher on them later (includes the user's own sample, s01).
HOLDOUT="s01 s22 s37 s40"

# Free RAM: the 9B teacher may still be resident in Ollama.
ollama stop gemma2:9b >/dev/null 2>&1 || true

# Split held-out sources into valid.jsonl. Read the source into memory BEFORE
# opening any writer — writing train.jsonl truncates it, so opening it first
# would destroy the dataset we're splitting.
"$VENV/bin/python" - "$HOLDOUT" <<'PY'
import json, sys, pathlib
hold = set(sys.argv[1].split())
src = pathlib.Path("data/distill/train.jsonl")
lines = src.read_text().splitlines()
train = open(src.with_name("train.jsonl"), "w")
valid = open(src.with_name("valid.jsonl"), "w")
for line in lines:
    if not line.strip():
        continue
    r = json.loads(line)
    sid = r["key"].split("|")[-1]
    (valid if sid in hold else train).write(line + "\n")
print("split: train + valid written")
PY

mkdir -p "$ADAPTERS"
"$VENV/bin/mlx_lm.lora" \
  --model "$BASE" \
  --train \
  --fine-tune-type lora \
  --data "$DATA" \
  --batch-size 4 \
  --iters 400 \
  --learning-rate 1e-4 \
  --steps-per-eval 100 \
  --val-batches 25 \
  --save-every 200 \
  --seed 7 \
  --config "$DATA/lora.yaml" \
  --adapter-path "$ADAPTERS" \
  2>&1 | tee "$DATA/train.log"

echo "TRAINING DONE"
