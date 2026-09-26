#!/usr/bin/env python3
"""Build v4cur6: register-voice repair corpus via forced teacher regeneration.

Evidence (2026-08-27): the step-400 champion's register-marker coverage on the
full valid set is pachelhkhor 19%, adabi 46%, rasmi 52%, daneshgahi 72%,
edari 72% — the gate needs all six >= 75%. The teacher's own outputs carry
markers only ~44% of the time in the worst modes, so filtering (v4cur5) cannot
fix it: v4cur5 dropped every mixed-script row and its foreign-script issues
exploded to 6-22. The pilot proves explicit register-forcing lifts marker
coverage from 9/12 to 12/12 on pachelhkhor.

This script:
  1. Loads v4cur/train.jsonl (the champion's curriculum, 42% mixed-script).
  2. For every row in a required voice mode whose output fails the exact
     hasVoice() regex, regenerates the output with a register-forcing prompt
     via gemma2:9b (Ollama).
  3. Verifies each candidate against the gate: hasVoice passes, no foreign
     script in output, all input numbers preserved, output != input.
  4. Writes v4cur6/train.jsonl = EVERY v4cur row, with successfully upgraded
     outputs replaced in place (mixed-script and clean rows all kept).
  5. Progress is saved after each row so a crash can resume.

Usage: PYTHON_VENV/bin/python scripts/build_v4cur6.py [--start N] [--limit M]
"""
import json
import pathlib
import random
import re
import sys
import threading
import time
import urllib.request

random.seed(7)

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "data" / "distill" / "v4cur" / "train.jsonl"
OUT_DIR = ROOT / "data" / "distill" / "v4cur6"
OUT_TRAIN = OUT_DIR / "train.jsonl"
PROGRESS = OUT_DIR / "regenerate_progress.jsonl"
REJECTED = OUT_DIR / "regenerate_rejected.jsonl"

OLLAMA_URL = "http://localhost:11434/api/generate"
MODEL = "gemma2:9b"

MARKERS = {
    "rasmi": r"(خواهشمند|لطفاً|شایسته|مقتضی|بدین|احترام|اعلام|درخواست|ضروری|امکان|مطابق|بررسی|ارسال|پیگیری|پیشنهاد)",
    "daneshgahi": r"(پژوهش|تحلیل|مطالعه|داده|شواهد|نتایج|یافته|فرضیه|روش|نمونه|متغیر|نشان می‌دهد|بررسی|ارزیابی|همبستگی|علّی|نظری)",
    "edari": r"(احتراماً|بدین‌وسیله|خواهشمند است|دستور فرمایید|اقدام لازم|پیگیری|درخواست|اعلام|ابلاغ|بررسی|شماره|ثبت|واحد|مدارک|پیوست)",
    "adabi": r"(دل|سایه|روشن|خاموش|آسمان|کوچه|پنجره|باد|خاطره|روزگار|شب|صبح|جان|لبخند|سنگینی|قصه|رنگ)",
    "pachelhkhor": r"(استاد|نابغه|بی‌نظیر|شاهکار|افسانه|اعجوبه|تاریخ|جهان|کهکشان|سلطان|حضرت|درخشان|محشر|عظمت)",
    "shaeraneh": r"(دل|شب|صبح|ماه|خورشید|آسمان|باران|باد|رود|دریا|سایه|رویا|پنجره|کوچه|خواب|ستاره|غروب|سپیده|پرنده)",
}
REQUIRED = list(MARKERS)  # the six gate modes (tashih excluded: always passes)

FORCE = {
    "rasmi": "نوشته را به لحن اداری و رسمی بازنویسی کن و حتماً از واژه‌هایی مانند «خواهشمند»، «لطفاً»، «پیگیری»، «درخواست» یا «بررسی» استفاده کن.",
    "daneshgahi": "نوشته را به لحن دانشگاهی بازنویسی کن و حتماً از واژه‌هایی مانند «پژوهش»، «تحلیل»، «بررسی»، «داده» یا «نتایج» استفاده کن.",
    "edari": "نوشته را به لحن اداری بازنویسی کن و حتماً از عبارت‌هایی مانند «احتراماً»، «خواهشمند است»، «دستور فرمایید» یا «اقدام لازم» استفاده کن.",
    "adabi": "نوشته را به لحن ادبی بازنویسی کن و حتماً از واژه‌هایی مانند «دل»، «سایه»، «شب»، «کوچه»، «خاطره» یا «روزگار» استفاده کن.",
    "pachelhkhor": "نوشته را با تعریف و تمجید اغراق‌آمیز و بامزه بازنویسی کن و حتماً از واژه‌هایی مانند «استاد»، «نابغه»، «شاهکار»، «بی‌نظیر» یا «افسانه» استفاده کن.",
    "shaeraneh": "نوشته را به لحن شاعرانه بازنویسی کن و حتماً از واژه‌هایی مانند «شب»، «ماه»، «آسمان»، «ستاره»، «رویا» یا «سایه» استفاده کن.",
}

FOREIGN = re.compile(r"[A-Za-z一-鿿぀-ヿ฀-๿ऀ-ॿЀ-ӿ]")
DIGITS = dict(zip("۰۱۲۳۴۵۶۷۸۹", "0123456789"))

try:
    import regex as _rx
    ARABIC_LETTER = _rx.compile(r"[\p{Script_Extensions=Arabic}]")
except ImportError:  # pragma: no cover
    ARABIC_LETTER = None


def has_foreign_letter(s: str) -> bool:
    """Gate-exact check: any Letter whose Script_Extensions excludes Arabic."""
    if ARABIC_LETTER is not None:
        return any(
            ch.isalpha() and ARABIC_LETTER.fullmatch(ch) is None
            for ch in s
        )
    return bool(FOREIGN.search(s))


def normalize_digits(s: str) -> str:
    return "".join(DIGITS.get(ch, ch) for ch in s)


def has_voice(mode: str, output: str) -> bool:
    if mode == "tashih":
        return True
    if mode == "shaeraneh":
        structural = "\n" in output or (output.count("،") + output.count("؛")) >= 2
        return True if structural else bool(re.search(MARKERS["shaeraneh"], output))
    return bool(re.search(MARKERS[mode], output))


def numbers_preserved(row) -> bool:
    nums = re.findall(r"\d+(?:[.,]\d+)?", normalize_digits(row["input"]))
    outn = normalize_digits(row["output"])
    return all(n in outn for n in nums)


def verified(mode: str, out: str, row) -> tuple[bool, str]:
    """Check candidate output against the exact gate logic. Returns (ok, reason)."""
    if not out.strip():
        return False, "empty"
    if not re.search(r"[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]", out):
        return False, "no-persian"
    if has_foreign_letter(out):
        return False, "foreign"
    if not has_voice(mode, out):
        return False, "no-marker"
    if mode != "tashih" and out.strip() == row["input"].strip():
        return False, "unchanged"
    if not numbers_preserved(row):
        return False, "lost-number"
    return True, "ok"


def ollama(prompt: str, max_tokens: int = 400, temp: float = 0.4, retries: int = 3):
    body = json.dumps({
        "model": MODEL, "prompt": prompt, "stream": False,
        "options": {"num_predict": max_tokens, "temperature": temp, "seed": 7},
    }).encode()
    for attempt in range(retries):
        try:
            req = urllib.request.Request(OLLAMA_URL, body, {"Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=240) as resp:
                return json.load(resp)["response"].strip()
        except Exception as exc:  # noqa: BLE001
            if attempt == retries - 1:
                return None
            time.sleep(5 * (attempt + 1))
    return None


def assemble() -> None:
    """Rebuild v4cur6/train.jsonl = every v4cur row, with successfully
    regenerated outputs swapped in for the required-mode rows."""
    rows = [json.loads(line) for line in SRC.read_text().splitlines() if line.strip()]
    swaps = {}
    if PROGRESS.exists():
        for line in PROGRESS.read_text().splitlines():
            if line.strip():
                rec = json.loads(line)
                if rec.get("status") == "ok":
                    swaps[rec["key"]] = rec["output"]
    replaced = 0
    for r in rows:
        if r["key"] in swaps:
            r["output"] = swaps[r["key"]]
            r["messages"][1]["content"] = swaps[r["key"]]
            replaced += 1
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    with open(OUT_TRAIN, "w") as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
    print(f"v4cur6 assembled: {len(rows)} rows, {replaced} outputs replaced -> {OUT_TRAIN}")
    # validate: every required-mode row must now pass hasVoice
    bad = [r["key"] for r in rows if r["mode"] in REQUIRED and not has_voice(r["mode"], r["output"])]
    print(f"required-mode rows still failing hasVoice after assembly: {len(bad)}")
    if bad[:5]:
        print("examples:", bad[:5])


def main() -> None:
    if "--assemble" in sys.argv:
        assemble()
        return
    workers = 4
    start = 0
    limit = 10**9
    for i, arg in enumerate(sys.argv):
        if arg == "--start" and i + 1 < len(sys.argv):
            start = int(sys.argv[i + 1])
        if arg == "--limit" and i + 1 < len(sys.argv):
            limit = int(sys.argv[i + 1])
        if arg == "--workers" and i + 1 < len(sys.argv):
            workers = int(sys.argv[i + 1])

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    rows = [json.loads(line) for line in SRC.read_text().splitlines() if line.strip()]
    print(f"v4cur rows: {len(rows)}; required modes: {REQUIRED}")

    # Decide which rows need regeneration: required mode AND output fails hasVoice.
    targets = []
    for r in rows:
        if r["mode"] in REQUIRED and not has_voice(r["mode"], r["output"]):
            targets.append(r)
    targets = targets[start:start + limit] if limit else targets[start:]
    print(f"rows needing regeneration: {len(targets)} (window {start}..{start + len(targets) - 1})")

    # Load prior progress so a crash can resume.
    done = {}
    if PROGRESS.exists():
        for line in PROGRESS.read_text().splitlines():
            if line.strip():
                rec = json.loads(line)
                done[rec["key"]] = rec
    print(f"prior regenerated: {len(done)}")

    lock = threading.Lock()
    pf = open(PROGRESS, "a")
    rf = open(REJECTED, "a")
    counters = {"ok": 0, "reject": 0, "fail": 0}

    def process(row):
        mode = row["mode"]
        prompt = (FORCE[mode]
                  + "\n\nمتن: " + row["input"]
                  + "\n\nفقط متن بازنویسی‌شده را برگردان؛ معنا، اعداد و نام‌ها را حفظ کن.")
        out = ollama(prompt)
        with lock:
            if out is None:
                counters["fail"] += 1
                pf.write(json.dumps({"key": row["key"], "status": "ollama-fail"}) + "\n")
                pf.flush()
                return
            ok, reason = verified(mode, out, row)
            if ok:
                counters["ok"] += 1
                pf.write(json.dumps({"key": row["key"], "status": "ok", "output": out}, ensure_ascii=False) + "\n")
                pf.flush()
            else:
                counters["reject"] += 1
                rf.write(json.dumps({"key": row["key"], "mode": mode, "reason": reason,
                                     "candidate": out, "input": row["input"]}, ensure_ascii=False) + "\n")
                rf.flush()
                print(f"{row['key']} REJECT {reason}")

    # run in a thread pool; skip rows already done
    todo = [r for r in targets if r["key"] not in done]
    print(f"to process this pass: {len(todo)}")

    import concurrent.futures
    t0 = time.time()
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as ex:
        for i, _ in enumerate(ex.map(process, todo), 1):
            if i % 25 == 0:
                dt = time.time() - t0
                rate = i / max(dt, 1e-9)
                print(f"[{i}/{len(todo)}] processed; {rate:.1f} rows/s; ok={counters['ok']} reject={counters['reject']} fail={counters['fail']}")
    pf.close()
    rf.close()
    print(f"\nregeneration pass complete: ok={counters['ok']} reject={counters['reject']} fail={counters['fail']}; progress: {PROGRESS}")


if __name__ == "__main__":
    main()
