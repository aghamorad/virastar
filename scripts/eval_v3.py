#!/usr/bin/env python3
"""Deterministically evaluate long-form Virastar rewrites without truncating them."""
import json
import pathlib
import sys

import mlx.core as mx
from mlx_lm import generate, load
from mlx_lm.sample_utils import make_repetition_penalty, make_sampler

ROOT = pathlib.Path(__file__).resolve().parent.parent
VALID = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "data" / "distill" / "v3" / "valid.jsonl"
MERGED = pathlib.Path(sys.argv[2]) if len(sys.argv) > 2 else ROOT / "data" / "distill" / "v3" / "merged"
REPORT = pathlib.Path(sys.argv[3]) if len(sys.argv) > 3 else ROOT / "data" / "distill" / "v3" / "eval_report.txt"

MAX_TOKENS = 700
TEMP = 0.4
REPETITION_PENALTY = 1.1
EVAL_SEED = 7


def fold(system: str, user: str) -> str:
    return f"<start_of_turn>user\n{system}\n\n{user}<end_of_turn>\n<start_of_turn>model\n"


def main() -> None:
    records = [json.loads(line) for line in VALID.read_text().splitlines() if line.strip()]
    if not records:
        raise RuntimeError(f"no evaluation records in {VALID}")
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    print(f"loaded {len(records)} held-out records; sampling seed={EVAL_SEED}; max_tokens={MAX_TOKENS}")
    mx.random.seed(EVAL_SEED)
    model, tokenizer = load(str(MERGED))

    lines: list[str] = []
    rep_penalty = make_repetition_penalty(REPETITION_PENALTY)
    sampler = make_sampler(temp=TEMP)
    for index, record in enumerate(records, 1):
        output = generate(
            model,
            tokenizer,
            prompt=fold(record["system"], record["input"]),
            max_tokens=MAX_TOKENS,
            sampler=sampler,
            logits_processors=[rep_penalty],
        ).strip()
        lines.extend([
            "=" * 64,
            f"{record['key']}  (mode: {record['mode']})",
            "INPUT : " + record["input"],
            "TEACHER (9B): " + record["output"],
            "SMALL (2B) : " + output,
            "",
        ])
        print(f"[{index}/{len(records)}] {record['key']} done", flush=True)

    REPORT.write_text("\n".join(lines) + "\n")
    print(f"\nreport written to {REPORT}")


if __name__ == "__main__":
    sys.exit(main())
