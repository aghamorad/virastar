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
# The holdout is shared between valid.jsonl (for early stopping) and
# test.jsonl (for the final A/B in eval.py).
VALID_SOURCES="s01 s22"
TEST_SOURCES="s37 s40"

# Free RAM: the 9B teacher may still be resident in Ollama.
ollama stop gemma2:9b >/dev/null 2>&1 || true

# Split the canonical all.jsonl into train/valid/test. The canonical file is
# never written here, so the split is idempotent. Subset files that would end
# up empty are NOT created at all — mlx_lm treats an absent file as empty but
# crashes on an existing 0-byte one (create_dataset's data[0]).
"$VENV/bin/python" - "$VALID_SOURCES" "$TEST_SOURCES" <<'PY'
import json, sys, pathlib
valid_hold = set(sys.argv[1].split())
test_hold = set(sys.argv[2].split())
src = pathlib.Path("data/distill/all.jsonl")
out_dir = src.parent
train = open(out_dir / "train.jsonl", "w")
valid = open(out_dir / "valid.jsonl", "w")
test = open(out_dir / "test.jsonl", "w")
nt = nv = nte = 0
for line in src.read_text().splitlines():
    if not line.strip():
        continue
    try:
        r = json.loads(line)
    except ValueError:
        continue  # truncated tail write; the generator will re-emit it
    sid = r["key"].split("|")[-1]
    if sid in test_hold:
        test.write(line + "\n"); nte += 1
    elif sid in valid_hold:
        valid.write(line + "\n"); nv += 1
    else:
        train.write(line + "\n"); nt += 1
for f, n in ((train, nt), (valid, nv), (test, nte)):
    f.close()
    if n == 0:
        pathlib.Path(f.name).unlink(missing_ok=True)
print(f"split: train={nt} valid={nv} test={nte}")
PY

mkdir -p "$ADAPTERS"
"$VENV/bin/mlx_lm.lora" \
  --model "$BASE" \
  --train \
  --fine-tune-type lora \
  --data "$DATA" \
  --batch-size 4 \
  --iters 800 \
  --learning-rate 1e-4 \
  --steps-per-eval 200 \
  --val-batches 25 \
  --save-every 400 \
  --seed 7 \
  --config "$DATA/lora.yaml" \
  --adapter-path "$ADAPTERS" \
  2>&1 | tee "$DATA/train.log"

echo "TRAINING DONE"
