# Virastar-small v2 and future v3: mechanical training handoff

This package prepares, trains, exports, and evaluates `virastar-small-v2`. The data and scripts have been prepared and dry-run through data staging. **No training, fusion, GGUF conversion, Ollama registration, or model evaluation was run while creating this package.**

The executor must follow the commands below exactly. Do not edit prompts, thresholds, split ratios, weights, iteration counts, or model names. If any command exits nonzero, stop. Do not guess a repair and do not promote a model. Return the failed command plus the last 80 lines of `data/distill/v2/pipeline.log` if that file exists.

**Running-job barrier:** sections 1 through 6 document the current v2 run. Do not execute any command in the future-v3 sections 7 through 11 until the user confirms that v2 has finished and these commands all succeed:

```bash
cd /Users/Morad/Claude/Virastar
test -s data/distill/v2/pipeline.log
grep -F '== V2 COMPLETE ==' data/distill/v2/pipeline.log
test -s data/distill/v2/eval_audit.json
jq -e '.status == "PASS" and .hardIssues == 0' data/distill/v2/eval_audit.json
```

If any command fails, stop. Do not start Ollama, prepare v3, train, fuse, export, evaluate, rename, move, or delete anything. Never write to or clean `data/distill/v2` as part of v3 work.

Important: this repository's `.gitignore` excludes the entire `data/distill` directory. Do not run `git clean`, `git clean -x`, or any cleanup command. If the handoff is copied to another checkout, transfer `codex.jsonl` and `codex_review_ledger.json` explicitly along with the already-local legacy and correction JSONL files; Git will not carry them automatically.

## 1. Fixed inputs and outputs

Run from the repository root:

```bash
cd /Users/Morad/Claude/Virastar
```

Inputs that must remain unchanged during the run:

- `data/distill/train.jsonl`: legacy register corpus.
- `data/distill/valid.jsonl`: legacy validation corpus.
- `data/distill/corrections.jsonl` and `corrections_valid.jsonl`: existing correction corpus.
- `data/distill/codex.jsonl`: 1,220 new hand-authored pairs.
- `data/distill/codex_review_ledger.json`: digest-bound approvals for conservative semantic/register review candidates.
- `domain/modes.ts` and `domain/engines/online.ts`: live prompts used to rebuild every record.

The run writes only under `data/distill/v2`, except for the audit report `data/distill/codex_audit_report.json`. If a previous `data/distill/v2` exists, `train_v2.sh` moves it intact to a timestamped directory under `data/distill/v2-backups`. It never overwrites the production GGUF or the production Ollama tag `virastar-small`.

## 2. Preflight and corpus audit

Run these commands exactly:

```bash
test -x /Users/Morad/.virastar-venv/bin/mlx_lm.lora
test -x /Users/Morad/.virastar-venv/bin/mlx_lm.fuse
test -x /Users/Morad/.virastar-venv/bin/mlx_lm.convert
test -s /tmp/llama.cpp/convert_hf_to_gguf.py
test -x /opt/homebrew/bin/llama-quantize
test -x /opt/homebrew/bin/ollama
test -x /opt/homebrew/bin/node
node --check scripts/audit_codex.mjs
node --check scripts/prepare_v2_data.mjs
node --check scripts/check_eval_report.mjs
/Users/Morad/.virastar-venv/bin/python -c 'import ast, pathlib; ast.parse(pathlib.Path("scripts/eval.py").read_text())'
bash -n scripts/train_v2.sh
node scripts/audit_codex.mjs \
  --repo /Users/Morad/Claude/Virastar \
  --input data/distill/codex.jsonl \
  --review-ledger data/distill/codex_review_ledger.json \
  --report data/distill/codex_audit_report.json
```

The last command must exit zero and print all of these values:

```text
records: 1220
expectedRecords: 1220
liveModes: 11
onlineRuleLines: 6
rawFlagsTotal: 392
reviewCandidatesTotal: 392
approvedReviewFlags: 392
unresolvedFlagsTotal: 0
status: PASS
```

The 392 raw flags are deliberately conservative lexical warnings: 203 meaning-review candidates and 189 register-marker candidates. Each was read against its input and approved only after meaning and voice were confirmed. The ledger approval is bound to a SHA-256 digest of the exact mode, input, output, and live system prompt; a changed pair or prompt cannot inherit an old approval.

Do not proceed if any expected value differs. A prompt or corpus change requires a knowledgeable Persian reviewer; the executor must not regenerate the review ledger.

## 3. Run the complete v2 pipeline

Run exactly one command:

```bash
bash scripts/train_v2.sh
```

The script performs these steps, in this order:

1. Repeats all preflight and corpus gates.
2. Moves an existing `data/distill/v2` to a recoverable timestamped backup.
3. Rebuilds every legacy, correction, and Codex record with the current instruction plus all six current `ONLINE_RULES` lines.
4. Quarantines poisoned legacy/correction outputs containing foreign-script letters, prompt echoes, placeholders, ASCII digits, no Persian, runaway repetition, or extreme expansion.
5. Creates a deterministic, per-mode 90/10 Codex split: 1,098 unique new training pairs and 122 new held-out pairs.
6. Adds the accepted legacy and correction corpora. It gives new pairs in the six failing modes fourfold training weight, other style modes threefold weight, and correction mode onefold weight. It then interleaves modes deterministically and rejects train/validation input leakage.
7. Trains Gemma-2-2B for one complete prepared-data pass: 4,592 iterations, batch size 2, learning rate `1e-4`, seed 7, 16 LoRA layers, rank 8, scale 20, gradient checkpointing, validation every 400 steps, and a checkpoint every 800 steps.
8. Fuses the adapter.
9. Exports Gemma 2 by the supported route: MLX dequantization to float16, llama.cpp conversion to Q8, then Q4_K_M quantization. It does not use the unsupported `mlx_lm.fuse --export-gguf` route.
10. Evaluates all 203 held-out records with sampling seed 7, then applies deterministic foreign-script, meta-echo, repetition, number-preservation, meaning-anchor, and register-coverage gates.
11. Only after the evaluation passes, creates the separate Ollama model `virastar-small-v2`.

The deterministic preparation dry run produced these expected values. `train_v2.sh` refuses to train if the first two counts differ:

```text
prepared train rows: 9184
prepared validation rows: 203
legacy/correction rows quarantined: 333
duplicate mode/input rows removed: 2
```

Expected prepared mode counts:

| Mode | Training rows after weighting | Validation rows |
|---|---:|---:|
| `tashih` | 3,072 | 71 |
| `rasmi` | 680 | 14 |
| `daneshgahi` | 675 | 14 |
| `edari` | 662 | 14 |
| `khodmani` | 518 | 12 |
| `adabi` | 676 | 14 |
| `lati` | 521 | 12 |
| `taaroofi` | 519 | 12 |
| `pachelhkhor` | 670 | 14 |
| `naslezed` | 518 | 12 |
| `shaeraneh` | 673 | 14 |

## 4. Mechanical acceptance check

Do not accept the run merely because training finished. `scripts/check_eval_report.mjs` makes the decision and exits nonzero unless every condition below is true:

- zero empty or non-Persian outputs;
- zero foreign-script letters and zero ASCII digits in outputs;
- zero instruction/meta-request echoes;
- zero repeated long lines or fragments;
- zero lost numeric anchors;
- zero unchanged inputs outside correction mode;
- no more than 10% conservative meaning-anchor review candidates;
- at least 75% deterministic register-marker coverage in every one of the six historically failing modes;
- all 11 modes represented in evaluation.

After `train_v2.sh` prints `== V2 COMPLETE ==`, run:

```bash
test -s data/distill/v2/adapters/adapters.safetensors
test -s data/distill/v2/merged/config.json
test -s data/distill/v2/virastar-small-fa-q8.gguf
test -s data/distill/v2/virastar-small-fa.gguf
test -s data/distill/v2/eval_report.txt
test -s data/distill/v2/eval_audit.json
jq -e '.status == "PASS" and .hardIssues == 0' data/distill/v2/eval_audit.json
jq -e '.final.trainRows == 9184 and .final.validRows == 203' data/distill/v2/preparation_manifest.json
grep -F '== V2 COMPLETE ==' data/distill/v2/pipeline.log
ollama show virastar-small-v2 >/dev/null
shasum -a 256 \
  data/distill/v2/train.jsonl \
  data/distill/v2/valid.jsonl \
  data/distill/v2/virastar-small-fa.gguf
```

If all commands succeed, report the three hashes, the complete `eval_audit.json` summary, and the final training-loss/validation-loss lines from `data/distill/v2/train.log`. Stop there. Do not replace `data/distill/virastar-small-fa.gguf`, do not recreate `virastar-small`, and do not deploy the model; promotion is a separate decision.

## 5. New-corpus quality table

| Mode | New pairs | How the known failures were targeted |
|---|---:|---|
| `tashih` | 100 | Minimal, meaning-preserving repairs; punctuation, half-spaces, agreement, typos, and already-near-correct inputs without stylistic invention. |
| `rasmi` | 120 | Formal but readable requests, business notes, refusals, complaints, dates, quantities, negation, and explicit “make this formal” traps whose actual content is rewritten. |
| `daneshgahi` | 120 | Meta-request traps plus research claims, sampling limits, denominators, causation versus correlation, source bias, uncertainty, and method language without inventing findings. |
| `edari` | 120 | Explicit “write an administrative letter” traps converted into the requested letter; concrete cases with identifiers, dates, facilities, personnel, payments, and exact requested action. |
| `khodmani` | 100 | Natural everyday voice across plans, apologies, complaints, family notes, and work messages, while keeping every event and negation anchored. |
| `adabi` | 120 | Explicit literary-rewrite traps and grounded scenes with sustained imagery, cadence, and literary diction; facts and actions remain unchanged rather than becoming invented stories. |
| `lati` | 100 | Streetwise address and rhythm across realistic conflicts and favors, without foreign slang tokens, threats, extra actors, or changed outcomes. |
| `taaroofi` | 100 | Polite refusals, boundaries, invitations, requests, and gratitude with culturally recognizable courtesy while preserving the actual yes/no intent. |
| `pachelhkhor` | 120 | Deliberate overpraise and humorous hyperbole, including requests likely to trigger self-referential loops; praise stays attached to the real act and adds no new event. |
| `naslezed` | 100 | Contemporary Persian youth voice, irony, and short social messages using Persian-script vocabulary only, without Latin tokens or semantic detours. |
| `shaeraneh` | 120 | Explicit “say this poetically” traps plus rhythmic, image-rich transformations; concrete people, objects, time, weather, and outcomes remain recoverable. |

Total: **1,220 new pairs**. The six historically failing modes contain 120 pairs each; the other five contain 100 each.

## 6. Known residual limitation

The remaining weakness is automated proof of semantic equivalence when a strong register legitimately replaces literal vocabulary with idiom or metaphor. Numeric, negation, lexical-anchor, schema, script, prompt-echo, and register gates reduce this risk, and every conservative Codex review candidate is digest-bound to a human approval, but no surface-form script can prove that every figurative rewrite preserves every nuance. The 203-record held-out evaluation is therefore mandatory and promotion remains separate from training.

## 7. Future v3 inputs and non-negotiable isolation

This section is for a separate future run only, after the running-job barrier above passes. The new files are:

- `data/distill/codex_v3.jsonl`: 1,320 long-form training candidates, exactly 120 per mode. Every input has 3 to 8 sentences; the observed distribution is 27 four-sentence, 572 five-sentence, 714 six-sentence, and 7 seven-sentence inputs.
- `data/distill/hard_test.jsonl`: 110 adversarial held-out records, exactly 10 per mode. It is evaluation data and must never be copied, concatenated, sampled, or weighted into training or validation.
- `scripts/audit_codex_v3.mjs`: deterministic schema, prompt, uniqueness, script, sentence-count, number, meta-echo, trap-coverage, meaning-anchor, and register checks.
- `scripts/prepare_v3_data.mjs`: deterministic v3 fold-in of the legacy corpus, corrections, `codex.jsonl`, and `codex_v3.jsonl`; it explicitly rejects any `hard_test.jsonl` input leakage.
- `scripts/eval_v3.py`: the deterministic evaluator with a 700-token output allowance needed for paragraph rewrites.
- `scripts/check_semantics.mjs`: the independent local-teacher semantic gate.

The internal mode identifier remains `pachelhkhor`; its correct Persian name is **پاچه‌خواری**.

## 8. Audit and prepare v3 data

After section 7's barrier passes, run exactly:

```bash
cd /Users/Morad/Claude/Virastar
test ! -e data/distill/v3
test -s data/distill/codex_v3.jsonl
test -s data/distill/hard_test.jsonl
node --check scripts/audit_codex_v3.mjs
node --check scripts/prepare_v3_data.mjs
node --check scripts/check_semantics.mjs
/Users/Morad/.virastar-venv/bin/python -c 'import ast, pathlib; ast.parse(pathlib.Path("scripts/eval_v3.py").read_text())'
node scripts/audit_codex_v3.mjs \
  --repo /Users/Morad/Claude/Virastar \
  --input data/distill/codex_v3.jsonl \
  --report data/distill/codex_v3_audit.json
jq -e '.status == "PASS" and .records == 1320 and .foreignScriptFlags == 0 and .unresolvedFlagsTotal == 0 and .uniqueKeys == 1320 and .uniqueInputs == 1320 and .uniqueOutputs == 1320 and .sentenceDiversity.maxInputSentenceRepeat <= 5 and .sentenceDiversity.maxOutputSentenceRepeat <= 3' \
  data/distill/codex_v3_audit.json
node scripts/prepare_v3_data.mjs \
  --repo /Users/Morad/Claude/Virastar \
  --output data/distill/v3
jq -e '.final.trainRows == 12100 and .final.validRows == 335 and .codex.hardTest.included == 0 and .filteredCount == 333 and .duplicateCount == 2' \
  data/distill/v3/preparation_manifest.json
test "$(wc -l < data/distill/v3/train.jsonl | tr -d ' ')" = 12100
test "$(wc -l < data/distill/v3/valid.jsonl | tr -d ' ')" = 335
shasum -a 256 data/distill/v3/train.jsonl data/distill/v3/valid.jsonl
```

The hashes must be exactly:

```text
2d02509f13abf77038f7ea822a911d4a73dd57c17e539dc2985c00f9a76c6ce8  data/distill/v3/train.jsonl
5bff10c538642b292e2ad2b7984c012b60c42f5c71ce3aee59506b56e81f5c8b  data/distill/v3/valid.jsonl
```

Expected prepared counts:

| Mode | Training rows after weighting | Validation rows |
|---|---:|---:|
| `tashih` | 3,180 | 83 |
| `rasmi` | 1,004 | 26 |
| `daneshgahi` | 999 | 26 |
| `edari` | 986 | 26 |
| `khodmani` | 734 | 24 |
| `adabi` | 1,000 | 26 |
| `lati` | 737 | 24 |
| `taaroofi` | 735 | 24 |
| `pachelhkhor` | 994 | 26 |
| `naslezed` | 734 | 24 |
| `shaeraneh` | 997 | 26 |

The six difficult modes—`rasmi`, `daneshgahi`, `edari`, `adabi`, `pachelhkhor`, and `shaeraneh`—receive threefold weight for long pairs; the other style modes receive twofold weight and correction remains onefold. The short corpus retains the v2 weights. Do not alter these weights.

## 9. Future v3 train, fuse, and GGUF export

Do not run this section during v2. After section 8 succeeds, run the following commands in one shell, in order. A failure stops the sequence because `set -euo pipefail` is enabled.

```bash
cd /Users/Morad/Claude/Virastar
set -euo pipefail
V3_ROOT="$(pwd)"
V3_ENV=/Users/Morad/.virastar-venv
V3_BASE=mlx-community/gemma-2-2b-it-4bit
V3_DATA=data/distill/v3
V3_ADAPTERS="$V3_DATA/adapters"
test "$(wc -l < "$V3_DATA/train.jsonl" | tr -d ' ')" = 12100
test "$(wc -l < "$V3_DATA/valid.jsonl" | tr -d ' ')" = 335
/opt/homebrew/bin/ollama stop gemma2:9b >/dev/null 2>&1 || true
mkdir -p "$V3_ADAPTERS"
"$V3_ENV/bin/mlx_lm.lora" \
  --model "$V3_BASE" \
  --train \
  --fine-tune-type lora \
  --data "$V3_DATA" \
  --batch-size 2 \
  --iters 6050 \
  --learning-rate 1e-4 \
  --steps-per-eval 400 \
  --val-batches 100 \
  --save-every 800 \
  --grad-checkpoint \
  --seed 7 \
  --config data/distill/lora.yaml \
  --adapter-path "$V3_ADAPTERS" \
  2>&1 | tee "$V3_DATA/train.log"
test -s "$V3_ADAPTERS/adapters.safetensors"
"$V3_ENV/bin/mlx_lm.fuse" \
  --model "$V3_BASE" \
  --adapter-path "$V3_ADAPTERS" \
  --save-path "$V3_DATA/merged"
test -s "$V3_DATA/merged/config.json"
"$V3_ENV/bin/mlx_lm.convert" \
  --model "$V3_DATA/merged" \
  --mlx-path "$V3_DATA/merged-f16" \
  --dtype float16 \
  -d
(cd /tmp/llama.cpp && \
  "$V3_ENV/bin/python" convert_hf_to_gguf.py "$V3_ROOT/$V3_DATA/merged-f16" \
    --outfile "$V3_ROOT/$V3_DATA/virastar-small-fa-q8.gguf" \
    --outtype q8_0)
/opt/homebrew/bin/llama-quantize --allow-requantize \
  "$V3_DATA/virastar-small-fa-q8.gguf" \
  "$V3_DATA/virastar-small-fa.gguf" \
  q4_K_M
test -s "$V3_DATA/virastar-small-fa.gguf"
cp data/distill/Modelfile "$V3_DATA/Modelfile"
```

This is one complete pass because 6,050 batches at batch size 2 consume all 12,100 prepared rows. Do not initialize v3 from the v2 adapter or merged model; both short and long corpora are already folded into the v3 preparation.

## 10. Re-evaluate on v3 validation and the untouched hard set

Run both evaluations before creating any Ollama tag:

```bash
cd /Users/Morad/Claude/Virastar
/Users/Morad/.virastar-venv/bin/python scripts/eval_v3.py \
  data/distill/v3/valid.jsonl \
  data/distill/v3/merged \
  data/distill/v3/eval_report.txt
node scripts/check_eval_report.mjs \
  --report data/distill/v3/eval_report.txt \
  --json data/distill/v3/eval_audit.json
/Users/Morad/.virastar-venv/bin/python scripts/eval_v3.py \
  data/distill/hard_test.jsonl \
  data/distill/v3/merged \
  data/distill/v3/hard_eval_report.txt
node scripts/check_eval_report.mjs \
  --report data/distill/v3/hard_eval_report.txt \
  --json data/distill/v3/hard_eval_audit.json
jq -e '.status == "PASS" and .hardIssues == 0' data/distill/v3/eval_audit.json
jq -e '.status == "PASS" and .hardIssues == 0' data/distill/v3/hard_eval_audit.json
```

Then start the local teacher, run the semantic gate twice, and require complete, skip-free results:

```bash
/opt/homebrew/bin/ollama serve
```

Leave that foreground command running and use a second terminal:

```bash
cd /Users/Morad/Claude/Virastar
node scripts/check_semantics.mjs \
  --eval-report data/distill/v3/eval_report.txt \
  --output data/distill/v3/semantic_eval.json
node scripts/check_semantics.mjs \
  --eval-report data/distill/v3/hard_eval_report.txt \
  --output data/distill/v3/hard_semantic_eval.json
jq -e '.status == "COMPLETE" and .skipped == 0 and .uncertain == 0 and .passRate >= 0.95 and (.teacherDisagreements | length) == 0' \
  data/distill/v3/semantic_eval.json
jq -e '.status == "COMPLETE" and .skipped == 0 and .uncertain == 0 and .passRate >= 0.90 and (.teacherDisagreements | length) == 0' \
  data/distill/v3/hard_semantic_eval.json
```

If Ollama is busy or unavailable, the checker retries and records `SKIP` instead of crashing. A skipped record is not a pass: rerun the whole semantic command after the teacher becomes available. If either `jq` command fails, stop and report both semantic JSON summaries; do not register or promote the model.

Only after every gate above succeeds, create a separate non-production tag:

```bash
cd /Users/Morad/Claude/Virastar
/opt/homebrew/bin/ollama create virastar-small-v3 -f data/distill/v3/Modelfile
/opt/homebrew/bin/ollama show virastar-small-v3 >/dev/null
shasum -a 256 \
  data/distill/v3/train.jsonl \
  data/distill/v3/valid.jsonl \
  data/distill/v3/virastar-small-fa.gguf
```

Do not replace `data/distill/virastar-small-fa.gguf`, `virastar-small`, or `virastar-small-v2`. Promotion remains a separate user decision.

## 11. Standalone semantic checker and old-eval baseline

To judge an evaluation report containing `INPUT`, `TEACHER (9B)`, and `SMALL (2B)` columns:

```bash
cd /Users/Morad/Claude/Virastar
node scripts/check_semantics.mjs \
  --eval-report data/distill/eval_report.txt \
  --output data/distill/semantic_eval_old.json
jq '{status, judgedRecords, passed, failed, uncertain, skipped, passRate, teacherDisagreements, worstFive}' \
  data/distill/semantic_eval_old.json
```

To compare two ordinary JSONL files, both files must use matching record keys. The first file supplies candidate outputs; the second supplies original inputs and reference outputs:

```bash
node scripts/check_semantics.mjs CANDIDATE.jsonl REFERENCE.jsonl \
  --output semantic_report.json
```

The checker asks `gemma2:9b` for two independent judgments per record. Every record receives `PASS`, `FAIL`, `UNCERTAIN`, or `SKIP` plus a Persian reason. `teacherDisagreements` lists records on which the two judgments differ. `passRate` excludes unavailable `SKIP` records, so always inspect and require `skipped == 0` before treating the rate as complete.

## 12. V3 long-corpus quality table

All modes contain 120 unique long-input pairs. Every mode contains 24 meta-request traps, 24 mixed-script traps, 24 ambiguous asks, 24 polite-refusal traps, and 24 nested-request traps.

| Mode | Pairs | Specific register and failure targeting |
|---|---:|---|
| `tashih` | 120 | Full-paragraph correction without flattening casual meaning; mixed-script terms are translated and every nested fact remains. |
| `rasmi` | 120 | Formal requests, reports, refusals, complaints, dates, conditions, and multi-party actions; adds no bureaucratic invention. |
| `daneshgahi` | 120 | Research framing, evidence limits, uncertainty, samples, causation, and professor correspondence; explicit rewrite instructions become the requested prose rather than a meta-reply. |
| `edari` | 120 | File numbers, dates, approvals, prerequisites, recipients, and requested actions in sustained administrative voice. |
| `khodmani` | 120 | Natural multi-message rhythm, apologies, family and work logistics, refusals, and ambiguity without losing sub-points. |
| `adabi` | 120 | Sustained imagery and cadence across a whole paragraph while temporal order, uncertainty, refusal, and concrete facts stay recoverable. |
| `lati` | 120 | Streetwise rhythm and address without foreign slang, threats, new actors, or altered outcomes. |
| `taaroofi` | 120 | Layered courtesy, gratitude, boundaries, invitations, and definite refusals without turning “no” into “maybe.” |
| `pachelhkhor` | 120 | Deliberate پاچه‌خواری through humorous overpraise attached to the real addressee and action, without invented achievements. |
| `naslezed` | 120 | Contemporary youth rhythm and irony entirely in Persian script, with codeswitched input vocabulary translated. |
| `shaeraneh` | 120 | Paragraph-level rhythm and metaphor with all actors, objects, numbers, conditions, and outcomes still identifiable. |

The six historically difficult modes also carry an additional meaning-bearing sub-point in every long input and receive the higher long-corpus training weight documented in section 8.
