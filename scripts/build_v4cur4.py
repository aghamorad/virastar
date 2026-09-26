#!/usr/bin/env python3
"""Build v4cur4: final micro-pass from the a025 checkpoint (1 hard issue).

a025 over-generalized the anti-echo lesson "holding -> در حالت توقف" to ALL
status words: it wrote "هزینه‌ها در حالت توقف قرار دارند" for vitaSizeCache
and "وضعیت پرداخت در حالت توقف" for pending. This set drills the correct
distinctions with high repetition so the model's status-word slot maps
  pending      -> در انتظار
  vitaSizeCache-> حافظهٔ نهان
  holding      -> در حالت توقف (kept, fewer reps so it doesn't crowd the slot)
"""
import json, random, re

random.seed(7)

V4 = "data/distill/v4/train.jsonl"
OUT = "data/distill/v4cur4/train.jsonl"

def has_foreign(s):
    return bool(re.search(r"[A-Za-z一-鿿぀-ヿ฀-๿ऀ-ॿЀ-ӿ]", s))

def make_row(key, mode, register, system, text_input, text_output):
    return {
        "key": key,
        "mode": mode,
        "register": register,
        "system": system,
        "input": text_input,
        "output": text_output,
        "messages": [
            {"role": "user", "content": system + "\n\n" + text_input},
            {"role": "assistant", "content": text_output},
        ],
    }

def main():
    sys_by_mode = {}
    clean = []
    for line in open(V4):
        r = json.loads(line)
        sys_by_mode.setdefault(r["mode"], r["system"])
        if not has_foreign(r["input"]) and not has_foreign(r["output"]):
            clean.append(r)

    out_rows = []
    n = [0]
    def new_key(prefix):
        n[0] += 1
        return f"{prefix}-{n[0]:05d}"

    def add(mode, text_in, text_out, prefix="fx"):
        out_rows.append(make_row(new_key(prefix), mode, mode,
                                 sys_by_mode[mode], text_in, text_out))

    # ---- pending -> در انتظار (heavy) ----
    pend = [
        ("وضعیت پرداخت هنوز pending است و باید صبر کنیم.",
         "وضعیت پرداخت هنوز در انتظار است و باید صبر کنیم."),
        ("در گزارش آمده پرداخت pending است و در حال بررسی.",
         "در گزارش آمده پرداخت در انتظار است و در حال بررسی."),
        ("وضعیت سفارش من pending است و هنوز ارسال نشده.",
         "وضعیت سفارش من در انتظار است و هنوز ارسال نشده."),
        ("تو سیستم وضعیت فاکتور pending است.",
         "در سیستم وضعیت فاکتور در انتظار است."),
        ("نوشته وضعیت پرداخت pending و راهنمایی لازم است.",
         "نوشته وضعیت پرداخت در انتظار و راهنمایی لازم است."),
        ("پرداختِ این سفارش pending مانده است.",
         "پرداختِ این سفارش در انتظار مانده است."),
        ("وضعیت درخواست شما pending است و بررسی می‌شود.",
         "وضعیت درخواست شما در انتظار است و بررسی می‌شود."),
        ("چون اعتبار کم بود، پرداخت pending شد.",
         "چون اعتبار کم بود، پرداخت در انتظار ماند."),
        ("کارشناس گفت وضعیت آن pending است.",
         "کارشناس گفت وضعیت آن در انتظار است."),
        ("در برگه نوشته وضعیت: pending.",
         "در برگه نوشته وضعیت: در انتظار."),
    ]
    for a, b in pend:
        for _ in range(3):
            add("lati", a, b, "pend")

    # ---- vitaSizeCache -> حافظهٔ نهان (heavy) ----
    vsc = [
        ("هزینه‌های vitaSizeCache بالا رفته و بودجه کم است.",
         "هزینه‌های حافظهٔ نهان بالا رفته و بودجه کم است."),
        ("برای vitaSizeCache هزینهٔ اضافه ثبت شده است.",
         "برای حافظهٔ نهان هزینهٔ اضافه ثبت شده است."),
        ("گزارش از افزایش هزینهٔ vitaSizeCache می‌گوید.",
         "گزارش از افزایش هزینهٔ حافظهٔ نهان می‌گوید."),
        ("وضعیت vitaSizeCache در سامانه مشخص نیست.",
         "وضعیت حافظهٔ نهان در سامانه مشخص نیست."),
        ("بخش vitaSizeCache را باید به‌روز کنیم.",
         "بخش حافظهٔ نهان را باید به‌روز کنیم."),
        ("در جدول ستون vitaSizeCache خالی است.",
         "در جدول ستون حافظهٔ نهان خالی است."),
        ("هزینهٔ نگهداری vitaSizeCache زیاد شده است.",
         "هزینهٔ نگهداری حافظهٔ نهان زیاد شده است."),
        ("می‌گویند vitaSizeCache مشکل دارد.",
         "می‌گویند حافظهٔ نهان مشکل دارد."),
    ]
    for a, b in vsc:
        for _ in range(3):
            add("lati", a, b, "vsc")

    # ---- holding -> در حالت توقف (kept, lighter) ----
    hold = [
        ("توی سیستم زده پرونده holding است ولی مطمئن نیستم متوقف شده.",
         "توی سیستم ثبت شده پرونده در حالت توقف است ولی مطمئن نیستم متوقف شده."),
        ("وضعیت درخواست من holding است و باید ببینم کی آزاد می‌شود.",
         "وضعیت درخواست من در حالت توقف است و باید ببینم کی آزاد می‌شود."),
        ("کارشناس گفت پرونده holding است و باید منتظر بمانیم.",
         "کارشناس گفت پرونده در حالت توقف است و باید منتظر بمانیم."),
    ]
    for a, b in hold:
        add("tashih", a, b, "hold")

    # ---- 漢 -> نویسه (keep) ----
    han = [
        ("دو نویسه 漢字 کنار جدول مانده که بی‌معناست.",
         "دو نویسهٔ بی‌معنا کنار جدول مانده است."),
        ("در متن چند 漢字 دیده می‌شود که باید فارسی شوند.",
         "در متن چند نویسهٔ چینی دیده می‌شود که باید فارسی شوند."),
    ]
    for a, b in han:
        add("lati", a, b, "han")

    # ---- numbers (keep) ----
    DIG = [("۱۰۰", "۶۵"), ("۶۵", "۴۳"), ("۳۷", "۶۸")]
    sha = [
        ("از {A} نفر پرسیدیم و فقط {B} نفر جواب کامل دادند.",
         "از {A} تن پرسش کردیم و تنها {B} تن پاسخ را به پایان رساندند."),
    ]
    for inp_t, out_t in sha:
        for a, b in DIG:
            add("shaeraneh", inp_t.format(A=a, B=b), out_t.format(A=a, B=b), "num")

    # ---- clean anchors ----
    for r in random.sample(clean, 150):
        out_rows.append(make_row(new_key("cln"), r["mode"], r["register"],
                                 r["system"], r["input"], r["output"]))

    random.shuffle(out_rows)
    with open(OUT, "w") as f:
        for r in out_rows:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
    print(f"v4cur4: {len(out_rows)} rows -> {OUT}")

if __name__ == "__main__":
    main()
