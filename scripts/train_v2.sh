#!/usr/bin/env bash
# v2: retrain the distilled editor with the persian-2-persian error-correction
# corpus folded in as the اصلاح (tashih) mode, alongside the restructuring pairs.
# Run after scripts/build_corrections.ts and the baseline pipeline.
set -euo pipefail
cd "$(dirname "$0")/.."

VENV=/Users/Morad/.virastar-venv
BASE=mlx-community/gemma-2-2b-it-4bit
DATA=data/distill/v2
ADAPTERS="$DATA/adapters"

mkdir -p "$DATA"
cat data/distill/train.jsonl data/distill/corrections.jsonl > "$DATA/train.jsonl"
cat data/distill/valid.jsonl data/distill/corrections_valid.jsonl > "$DATA/valid.jsonl"
echo "v2 train: $(wc -l < "$DATA/train.jsonl") records, valid: $(wc -l < "$DATA/valid.jsonl")"

# Free RAM: the 9B teacher may still be resident.
ollama stop gemma2:9b >/dev/null 2>&1 || true

"$VENV/bin/mlx_lm.lora" \
  --model "$BASE" \
  --train \
  --fine-tune-type lora \
  --data "$DATA" \
  --batch-size 4 \
  --iters 600 \
  --learning-rate 1e-4 \
  --steps-per-eval 150 \
  --val-batches 25 \
  --save-every 300 \
  --seed 7 \
  --config data/distill/lora.yaml \
  --adapter-path "$ADAPTERS" \
  2>&1 | tee "$DATA/train.log"

"$VENV/bin/mlx_lm.fuse" --model "$BASE" \
  --adapter-path "$ADAPTERS" \
  --save-path "$DATA/merged"

"$VENV/bin/mlx_lm.fuse" --model "$BASE" \
  --adapter-path "$ADAPTERS" \
  --export-gguf --gguf-path "$DATA/virastar-small-fa.gguf"

"$VENV/bin/python" scripts/eval.py "$DATA/valid.jsonl" "$DATA/merged" "$DATA/eval_report.txt"

echo "V2 COMPLETE"
du -sh "$DATA/merged" "$DATA/virastar-small-fa.gguf" 2>/dev/null || true
