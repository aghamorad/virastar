# Codex handoff — finish Virastar's distilled Persian editor model (v4cur6 era)

You are taking over the active model-improvement job on this Mac (`/Users/Morad/Claude/Virastar`). Goal: get the small distilled Persian editor model to pass the acceptance gates at **100%** — zero hard issues on both full audit sets, and all six register tones at or above 75% marker coverage. If it cannot pass, you deliver the honest not-ready verdict in plain language. The user (Morad) is non-technical; report in lay terms.

## The bar — 100%, non-negotiable
The gate (`scripts/check_eval_report.mjs`) is the source of truth. A candidate is READY only when `status: "PASS"` on **BOTH**:
- full valid audit (331 held-out cases) — `data/distill/v4cur6/full-valid-<label>-audit.json`
- full hard audit (110 adversarial cases) — `data/distill/v4cur6/full-hard-<label>-audit.json`

`PASS` requires:
- `hardIssues: 0` on both (zero foreign-script letters, zero lost numbers, zero repetition, zero unchanged-register, zero ascii digits, zero prompt-echo)
- `registerMarkerCoverage >= 0.75` for every one of the six gate modes: **rasmi, daneshgahi, edari, adabi, pachelhkhor, shaeraneh**
- `meaningReviewRate <= 0.10`
- A semantic `SKIP` is NOT a pass.

Do not soften any of this. Do not register any model that does not pass.

## Environment
- Python venv: `/Users/Morad/.virastar-venv` (`mlx_lm`, `sentencepiece`; **no** `pip` binary — use `uv pip install --python /Users/Morad/.virastar-venv/bin/python <pkg>`; `uv` at `/Users/Morad/.local/bin/uv`)
- Node: `/opt/homebrew/bin/node`
- Base model: `mlx-community/gemma-3-4b-it-4bit` (already in HF cache)
- Training config: `data/distill/lora.yaml` (LoRA 16 layers, rank 8, scale 20.0, batch 1, lr 5e-5, mask-prompt, grad-checkpoint, seed 7)
- Teacher for data generation: Ollama `gemma2:9b` (`/opt/homebrew/bin/ollama serve`, `http://localhost:11434`)

## Current state (do NOT retrain what is already done)
- **Best candidate so far**: adapter at `data/distill/v4cur6/ckpts/0100/` (resumed-run step-100 of the register-voice-repaired curriculum).
  - diagnostic (44): 2 hard
  - full valid (331): 23 hard (8 foreign-script, 6 lost-number, 5 repetition, 3 ascii-digit, 1 unchanged-register)
  - full hard (110): 8 hard (5 foreign, 2 lost, 1 repetition)
  - register coverage on full valid: rasmi 64%, daneshgahi 64%, edari 88%, adabi 69%, pachelhkhor 62%, shaeraneh 96%
- The from-scratch run (`data/distill/v4cur6/scratch-adapters`, 600 iters) was **conclusively worse** (11–20 foreign-script hard per snapshot) — do not retry from scratch on this base.
- Two proven root causes:
  1. **Register-voice is a teacher-data problem.** The Ollama teacher itself marks pachelhkhor only ~44% / naslezed ~36% of outputs with the register marker, so the student cannot learn a ≥75% criterion. `data/distill/v4cur6/train.jsonl` was repaired with register-FORCING prompts (see below) and lifted train coverage to 89–99%, and student coverage +11–16 pts on pachelhkhor/adabi/edari — but still 10+ pts short on 4 modes.
  2. **Foreign-letter leaks are a base-model/tokenizer property.** Clean-Persian-only training (v4cur5) made foreign leaks WORSE; the current base still emits Latin/Cyrillic letters occasionally (漢, Cyrillic). This cannot be fixed with more training on this base — only a different base.

## Task 1 — Register-voice corpus (the tone gap; highest leverage, fully parallel-safe)
Generate additional high-quality **register-demonstrating** Persian rows for the six gate modes, especially **pachelhkhor** (playful flattery) and **adabi** (literary), where coverage is weakest. Write to `data/distill/codex_voice_corpus.jsonl` (new file), one JSON per line:

```json
{"key": "cxv-<n>-<mode>", "mode": "<mode>", "register": "<mode>", "system": "<the per-mode system prompt>", "input": "<informal Persian text to rewrite>", "output": "<rewritten text that CLEARLY demonstrates the register marker>", "messages": [{"role": "user", "content": "<system>\n\n<input>"}, {"role": "assistant", "content": "<output>"}]}
```

Rules:
- Each `output` must contain at least one marker word from that mode's regex (below) — verify each one programmatically.
- `output` must be pure Persian: **zero** Latin/Cyrillic/CJK letters (a hard foreign-script rule — check with `[\p{Script_Extensions=Arabic}]` on letters, or the simpler ASCII+Han+Katakana+Devanagari+Cyrillic regex from `scripts/build_v4cur6.py`).
- Preserve all digits/numbers from `input` in `output`.
- `output` must differ from `input` (a real rewrite, not an echo).
- `input` should be natural informal Persian (chat/social tone), 1–4 sentences.
- Aim for **~400 new rows per mode** for the six gate modes (~2,400 rows), prioritizing pachelhkhor and adabi.

Per-mode system prompts and markers (from `scripts/build_v4cur6.py` — keep identical):

| mode | marker regex (output must match one) |
|---|---|
| rasmi | `(خواهشمند\|لطفاً\|شایسته\|مقتضی\|بدین\|احترام\|اعلام\|درخواست\|ضروری\|امکان\|مطابق\|بررسی\|ارسال\|پیگیری\|پیشنهاد)` |
| daneshgahi | `(پژوهش\|تحلیل\|مطالعه\|داده\|شواهد\|نتایج\|یافته\|فرضیه\|روش\|نمونه\|متغیر\|نشان می‌دهد\|بررسی\|ارزیابی\|همبستگی\|علّی\|نظری)` |
| edari | `(احتراماً\|بدین‌وسیله\|خواهشمند است\|دستور فرمایید\|اقدام لازم\|پیگیری\|درخواست\|اعلام\|ابلاغ\|بررسی\|شماره\|ثبت\|واحد\|مدارک\|پیوست)` |
| adabi | `(دل\|سایه\|روشن\|خاموش\|آسمان\|کوچه\|پنجره\|باد\|خاطره\|روزگار\|شب\|صبح\|جان\|لبخند\|سنگینی\|قصه\|رنگ)` |
| pachelhkhor | `(استاد\|نابغه\|بی‌نظیر\|شاهکار\|افسانه\|اعجوبه\|تاریخ\|جهان\|کهکشان\|سلطان\|حضرت\|درخشان\|محشر\|عظمت)` |
| shaeraneh | `(دل\|شب\|صبح\|ماه\|خورشید\|آسمان\|باران\|باد\|رود\|دریا\|سایه\|رویا\|پنجره\|کوچه\|خواب\|ستاره\|غروب\|سپیده\|پرنده)` (or structural: newline OR ≥2 of ،/؛) |

Example system prompt for pachelhkhor: `نوشته را با تعریف و تمجید اغراق‌آمیز و بامزه بازنویسی کن و حتماً از واژه‌هایی مانند «استاد»، «نابغه»، «شاهکار»، «بی‌نظیر» یا «افسانه» استفاده کن.` (there are analogous FORCE prompts in `scripts/build_v4cur6.py` `FORCE` dict — mirror that style for each mode).

## Task 2 — Base-model switch investigation (the foreign-letter wall; the only path to kill foreign leaks)
Probe whether a different base eliminates foreign-letter leaks:
- Candidate already downloaded: `mlx-community/gemma-4-e4b-it-4bit` (also `mlx-community/gemma-4-e2b-it-4bit` in cache; `mlx-community/gemma-3-4b-it-8bit` also present).
- **Probe first (cheap):** fuse nothing — run `scripts/eval_v3.py /private/tmp/virastar-v4-diagnostic.jsonl <base-model-path> <report>` directly against the base model (no adapter) and count `foreign-script` hard issues via `scripts/check_eval_report.mjs`. Compare leak rates across bases.
- **If a base shows ~0 foreign leaks** on the diagnostic, run a short LoRA probe on `data/distill/v4cur6/train.jsonl` (e.g. 200 iters, `--save-every 25 --steps-per-eval 25`, adapters in `data/distill/v4baseprobe/`), then fuse + full-audit the best checkpoint.
- Report the foreign-script count per base clearly.

## Task 3 — Full audits + verdict on the best candidate
Re-fuse and re-audit any candidate that looks better than step-100. Commands:

```bash
cd /Users/Morad/Claude/Virastar
VALID=data/distill/v4cur/valid.jsonl      # full valid, 331 rows
HARD=data/distill/hard_test.jsonl         # full hard, 110 rows

# fuse an adapter dir (per-checkpoint dir, NOT the shared adapters dir — fusing a shared
# dir silently uses the last-saved adapter every time; that bug has been caught before)
/Users/Morad/.virastar-venv/bin/mlx_lm.fuse --model mlx-community/gemma-3-4b-it-4bit \
  --adapter-path data/distill/v4cur6/ckpts/0100 --save-path data/distill/v4cur6/merged-final

# evaluate both full sets
/Users/Morad/.virastar-venv/bin/python scripts/eval_v3.py "$VALID" data/distill/v4cur6/merged-final data/distill/v4cur6/full-valid-<label>-report.txt
/Users/Morad/.virastar-venv/bin/python scripts/eval_v3.py "$HARD" data/distill/v4cur6/merged-final data/distill/v4cur6/full-hard-<label>-report.txt

# run the gate on each
/opt/homebrew/bin/node scripts/check_eval_report.mjs --report data/distill/v4cur6/full-valid-<label>-report.txt --json data/distill/v4cur6/full-valid-<label>-audit.json
/opt/homebrew/bin/node scripts/check_eval_report.mjs --report data/distill/v4cur6/full-hard-<label>-report.txt --json data/distill/v4cur6/full-hard-<label>-audit.json
```

**Verdict:** ready ONLY if both audits are PASS (0 hard) AND all six modes ≥75%. Otherwise report not-ready with exact numbers.

## Guardrails (violating these is a real failure)
1. **GPU is single-user (Apple Metal).** NEVER run `mlx_lm` training or `eval_v3.py` concurrently with any other MLX process — they crash each other. Before any GPU command run `ps aux | grep -E "mlx_lm|eval_v3" | grep -v grep`; if anything shows, STOP and wait. (Currently idle.)
2. **Production is untouchable.** Do NOT modify, replace, or re-register the Ollama `virastar-small:latest` tag, any production GGUF, or `data/distill/Modelfile`. No model gets promoted without the user's explicit separate decision.
3. **Never soften the gate.** Do not edit `scripts/check_eval_report.mjs`'s thresholds. Semantic SKIP is not a pass.
4. **Do not delete anything.** Do not run `git add -A`; stage files by name.
5. **The 44-case diagnostic alone is not trustworthy** (a prior model "won" it 0-hard while failing 33 on full valid; step-100's 2 hard hid 23 full-valid hard). Always confirm winners on BOTH full audits.
6. `data/distill/` is gitignored — never commit it.

## Report back (plain language, no jargon)
State: ready or not; the exact key numbers (hard issues on both audits, coverage per tone); what remains; your recommendation. If not ready after both tasks, say so plainly and recommend the next lever.
