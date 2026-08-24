#!/usr/bin/env bash
# Audited v2 retrain. This script prepares data, trains, exports, registers a
# separate Ollama model, evaluates it, and applies deterministic acceptance gates.
set -euo pipefail
cd "$(dirname "$0")/.."

ROOT="$(pwd)"
VENV=/Users/Morad/.virastar-venv
BASE=mlx-community/gemma-2-2b-it-4bit
DATA=data/distill/v2
ADAPTERS="$DATA/adapters"
RUN_STAMP="$(date +%Y%m%d-%H%M%S)"

fail() { echo "ERROR: $*" >&2; exit 1; }
trap 'status=$?; echo "FAILED (exit ${status}) at line ${LINENO}: ${BASH_COMMAND}" >&2' ERR

echo "== v2 preflight =="
for file in \
  data/distill/train.jsonl data/distill/valid.jsonl \
  data/distill/corrections.jsonl data/distill/corrections_valid.jsonl \
  data/distill/codex.jsonl data/distill/codex_review_ledger.json \
  data/distill/lora.yaml data/distill/Modelfile \
  scripts/audit_codex.mjs scripts/prepare_v2_data.mjs \
  scripts/check_eval_report.mjs scripts/eval.py \
  domain/modes.ts domain/engines/online.ts; do
  [[ -s "$file" ]] || fail "missing or empty required file: $file"
done
for executable in \
  "$VENV/bin/python" "$VENV/bin/mlx_lm.lora" "$VENV/bin/mlx_lm.fuse" \
  "$VENV/bin/mlx_lm.convert" /opt/homebrew/bin/node /opt/homebrew/bin/ollama \
  /opt/homebrew/bin/llama-quantize; do
  [[ -x "$executable" ]] || fail "missing executable: $executable"
done
[[ -s /tmp/llama.cpp/convert_hf_to_gguf.py ]] || fail "missing /tmp/llama.cpp/convert_hf_to_gguf.py"

available_kb="$(df -Pk . | awk 'NR==2 {print $4}')"
[[ "$available_kb" =~ ^[0-9]+$ ]] || fail "could not determine free disk space"
(( available_kb >= 20971520 )) || fail "at least 20 GiB of free disk space is required"

echo "== auditing the hand-authored corpus =="
/opt/homebrew/bin/node scripts/audit_codex.mjs \
  --repo "$ROOT" \
  --input data/distill/codex.jsonl \
  --review-ledger data/distill/codex_review_ledger.json \
  --report data/distill/codex_audit_report.json

if [[ -e "$DATA" ]]; then
  backup="data/distill/v2-backups/v2-$RUN_STAMP"
  mkdir -p "$(dirname "$backup")"
  [[ ! -e "$backup" ]] || fail "backup path already exists: $backup"
  mv "$DATA" "$backup"
  echo "previous v2 directory moved to $backup"
fi
mkdir -p "$DATA"
exec > >(tee -a "$DATA/pipeline.log") 2>&1

echo "== preparing poison-filtered, prompt-normalized data =="
/opt/homebrew/bin/node scripts/prepare_v2_data.mjs --repo "$ROOT" --output "$DATA"
train_rows="$(wc -l < "$DATA/train.jsonl" | tr -d ' ')"
valid_rows="$(wc -l < "$DATA/valid.jsonl" | tr -d ' ')"
[[ "$train_rows" == "9184" ]] || fail "unexpected training row count: $train_rows (expected 9184)"
[[ "$valid_rows" == "203" ]] || fail "unexpected validation row count: $valid_rows (expected 203)"

echo "== training one deterministic pass: 4592 steps x batch 2 =="
# Batch 2 plus gradient checkpointing is the repository's known 16 GiB-safe
# configuration. 4592 batches consume exactly 9184 prepared rows once.
/opt/homebrew/bin/ollama stop gemma2:9b >/dev/null 2>&1 || true
mkdir -p "$ADAPTERS"
"$VENV/bin/mlx_lm.lora" \
  --model "$BASE" \
  --train \
  --fine-tune-type lora \
  --data "$DATA" \
  --batch-size 2 \
  --iters 4592 \
  --learning-rate 1e-4 \
  --steps-per-eval 400 \
  --val-batches 40 \
  --save-every 800 \
  --grad-checkpoint \
  --seed 7 \
  --config data/distill/lora.yaml \
  --adapter-path "$ADAPTERS" \
  2>&1 | tee "$DATA/train.log"

[[ -s "$ADAPTERS/adapters.safetensors" ]] || fail "training finished without adapters.safetensors"

echo "== fusing adapters =="
"$VENV/bin/mlx_lm.fuse" \
  --model "$BASE" \
  --adapter-path "$ADAPTERS" \
  --save-path "$DATA/merged"
[[ -s "$DATA/merged/config.json" ]] || fail "fused model is missing config.json"

echo "== exporting Gemma 2 through the supported llama.cpp route =="
# mlx_lm.fuse --export-gguf does not support Gemma 2 in this repository.
"$VENV/bin/mlx_lm.convert" \
  --model "$DATA/merged" \
  --mlx-path "$DATA/merged-f16" \
  --dtype float16 \
  -d
# llama.cpp's converter wants the SentencePiece tokenizer.model; the
# dequantized MLX dir only carries tokenizer.json. Pull it from the base
# model's HF cache (already downloaded; no network needed).
TOKENIZER_SRC="$(HF_HUB_OFFLINE=1 "$VENV/bin/python" - "$BASE" <<'PY'
import sys
from huggingface_hub import snapshot_download
print(snapshot_download(sys.argv[1]))
PY
)"
cp "$TOKENIZER_SRC/tokenizer.model" "$DATA/merged-f16/tokenizer.model"
(cd /tmp/llama.cpp && \
  "$VENV/bin/python" convert_hf_to_gguf.py "$ROOT/$DATA/merged-f16" \
    --outfile "$ROOT/$DATA/virastar-small-fa-q8.gguf" \
    --outtype q8_0)
/opt/homebrew/bin/llama-quantize --allow-requantize \
  "$DATA/virastar-small-fa-q8.gguf" \
  "$DATA/virastar-small-fa.gguf" \
  q4_K_M
[[ -s "$DATA/virastar-small-fa.gguf" ]] || fail "GGUF export is missing or empty"

cp data/distill/Modelfile "$DATA/Modelfile"

echo "== evaluating all 203 held-out records =="
"$VENV/bin/python" scripts/eval.py \
  "$DATA/valid.jsonl" \
  "$DATA/merged" \
  "$DATA/eval_report.txt"
/opt/homebrew/bin/node scripts/check_eval_report.mjs \
  --report "$DATA/eval_report.txt" \
  --json "$DATA/eval_audit.json"

echo "== registering the accepted model under a non-production tag =="
/opt/homebrew/bin/ollama create virastar-small-v2 -f "$DATA/Modelfile"

echo "== V2 COMPLETE =="
shasum -a 256 "$DATA/train.jsonl" "$DATA/valid.jsonl" "$DATA/virastar-small-fa.gguf"
du -sh "$DATA/merged" "$DATA/virastar-small-fa.gguf"
