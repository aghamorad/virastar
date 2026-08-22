#!/usr/bin/env python3
"""A/B the distilled small model against the 9B teacher on the held-out records.

Each record is (system prompt, messy input, teacher edit) from
data/distill/valid.jsonl. The small model is prompted with the same folded
user turn used in training (Gemma 2 has no system role), so the comparison is
fair and matches production inference.
"""
import json
import sys
import pathlib

from mlx_lm import load, generate

ROOT = pathlib.Path(__file__).resolve().parent.parent
VALID = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "data" / "distill" / "valid.jsonl"
MERGED = pathlib.Path(sys.argv[2]) if len(sys.argv) > 2 else ROOT / "data" / "distill" / "merged"
REPORT = pathlib.Path(sys.argv[3]) if len(sys.argv) > 3 else ROOT / "data" / "distill" / "eval_report.txt"

MAX_TOKENS = 300
TEMP = 0.4


def fold(system: str, user: str) -> str:
    return f"<start_of_turn>user\n{system}\n\n{user}<end_of_turn>\n<start_of_turn>model\n"


def main() -> None:
    records = [json.loads(l) for l in VALID.read_text().splitlines() if l.strip()]
    print(f"loaded {len(records)} held-out records")
    model, tokenizer = load(str(MERGED))

    lines: list[str] = []
    for i, r in enumerate(records, 1):
        prompt = fold(r["system"], r["input"])
        out = generate(
            model,
            tokenizer,
            prompt=prompt,
            max_tokens=MAX_TOKENS,
            temp=TEMP,
        ).strip()
        lines.append("=" * 64)
        lines.append(f"{r['key']}  (mode: {r['mode']})")
        lines.append("INPUT : " + r["input"])
        lines.append("TEACHER (9B): " + r["output"])
        lines.append("SMALL (2B) : " + out)
        lines.append("")
        print(f"[{i}/{len(records)}] {r['key']} done", flush=True)

    REPORT.write_text("\n".join(lines) + "\n")
    print(f"\nreport written to {REPORT}")


if __name__ == "__main__":
    sys.exit(main())
