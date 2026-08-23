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

# mlx_lm's fuse --export-gguf doesn't support gemma2, so export via llama.cpp:
# dequantize to f16 (mlx_lm.convert -d), convert with llama.cpp's
# convert_hf_to_gguf.py (repo cloned at /tmp/llama.cpp), quantize to q4_K_M.
echo "== exporting GGUF (via llama.cpp; mlx_lm can't convert gemma2) =="
ROOT="$(pwd)"
"$VENV/bin/mlx_lm.convert" --model data/distill/merged \
  --mlx-path data/distill/merged-f16 --dtype float16 -d
(cd /tmp/llama.cpp \
  && "$VENV/bin/python" convert_hf_to_gguf.py "$ROOT/data/distill/merged-f16" \
     --outfile "$ROOT/data/distill/virastar-small-fa-q8.gguf" --outtype q8_0)
/opt/homebrew/bin/llama-quantize --allow-requantize \
  data/distill/virastar-small-fa-q8.gguf data/distill/virastar-small-fa.gguf q4_K_M
ollama create virastar-small -f data/distill/Modelfile

echo "== A/B eval vs teacher =="
"$VENV/bin/python" scripts/eval.py

echo "== $(date) PIPELINE COMPLETE =="
du -sh data/distill/merged data/distill/virastar-small-fa.gguf 2>/dev/null || true
