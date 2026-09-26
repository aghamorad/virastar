#!/usr/bin/env python3
"""Build v4cur3: surgical anti-echo repair on top of the r250 checkpoint.

r250 fixed 漢->نویسه and digit preservation, leaving only:
  - systematic "holding" echo on hard01 financial inputs (6 modes)
  - one repetition (hard10|pachelhkhor)

This set counter-trains the echo with natural-context lessons (correct
translations authored here, no teacher), plus clean rows to stabilize
generation and a sample of the r250 gains (漢, numbers) so they persist.
"""
import json, random, re

random.seed(7)

V4CUR2 = "data/distill/v4cur2/train.jsonl"
V4 = "data/distill/v4/train.jsonl"
OUT = "data/distill/v4cur3/train.jsonl"

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
    # system prompts per mode from the v4 clean set
    sys_by_mode = {}
    for line in open(V4):
        r = json.loads(line)
        sys_by_mode.setdefault(r["mode"], r["system"])
    clean = []
    for line in open(V4):
        r = json.loads(line)
        if not has_foreign(r["input"]) and not has_foreign(r["output"]):
            clean.append(r)

    out_rows = []
    n = [0]
    def new_key(prefix):
        n[0] += 1
        return f"{prefix}-{n[0]:05d}"

    def add(mode, text_in, text_out, prefix="anti"):
        out_rows.append(make_row(new_key(prefix), mode, mode,
                                 sys_by_mode[mode], text_in, text_out))

    # ---- 1. holding echo counter-training (natural contexts) ----
    holding_pairs = [
        ("توی دانشکده نوشته‌اند وضعیت پرونده holding است و هیچ‌کس توضیح نداده یعنی چی.",
         "توی دانشکده نوشته‌اند وضعیت پرونده در حالت توقف است و هیچ‌کس توضیح نداده یعنی چی."),
        ("تو سیستم زده پرونده holding است ولی من مطمئن نیستم متوقف شده.",
         "تو سیستم ثبت شده پرونده در حالت توقف است ولی من مطمئن نیستم متوقف شده."),
        ("نام پرونده روی holding قرار دارد و هنوز تصمیمی نگرفته‌اند.",
         "پرونده در حالت توقف قرار دارد و هنوز تصمیمی نگرفته‌اند."),
        ("وضعیت درخواست من holding است و باید ببینم کی آزاد می‌شود.",
         "وضعیت درخواست من در حالت توقف است و باید ببینم کی آزاد می‌شود."),
        ("کارشناس گفت پرونده holding است و باید منتظر بمانیم.",
         "کارشناس گفت پرونده در حالت توقف است و باید منتظر بمانیم."),
        ("چون مدرک ناقص بود، پرونده را روی holding گذاشتند.",
         "چون مدرک ناقص بود، پرونده را در حالت توقف گذاشتند."),
        ("در صفحه اول نوشته وضعیت: holding و هیچ توضیحی نیست.",
         "در صفحه اول نوشته وضعیت: در حالت توقف و هیچ توضیحی نیست."),
        ("می‌گویند پرونده holding است، یعنی شاید بعداً دوباره بررسی شود.",
         "می‌گویند پرونده در حالت توقف است، یعنی شاید بعداً دوباره بررسی شود."),
    ]
    for a, b in holding_pairs:
        add("tashih", a, b, "hold")
        add("edari", a, b, "hold")
        add("rasmi", a, b, "hold")

    # ---- 2. nominal value -> ارزش اسمی (correct order) ----
    nv_pairs = [
        ("پایینش هم عبارت nominal value آمده و هیچ‌کس توضیح نداده منظورش چیه.",
         "پایینش هم عبارت ارزش اسمی آمده و هیچ‌کس توضیح نداده منظورش چیه."),
        ("در جدول ستون nominal value را خالی گذاشته‌اند.",
         "در جدول ستون ارزش اسمی را خالی گذاشته‌اند."),
        ("گزارش می‌گوید nominal value تغییر کرده است.",
         "گزارش می‌گوید ارزش اسمی تغییر کرده است."),
        ("برای این سهم nominal value را حساب نکرده‌اند.",
         "برای این سهم ارزش اسمی را حساب نکرده‌اند."),
        ("کنار اسم سهم نوشته nominal value و عدد درشت.",
         "کنار اسم سهم نوشته ارزش اسمی و عدد درشت."),
    ]
    for a, b in nv_pairs:
        add("tashih", a, b, "nv")

    # ---- 3. capitalized-Latin generalization (translate, don't echo) ----
    cap_pairs = [
        ("وضعیت در سیستم Status است", "وضعیت در سیستم ثبت شده"),
        ("تو گزارش نوشته Cash دریافت شد", "تو گزارش نوشته پول نقد دریافت شد"),
        ("ستون Data خالی مانده", "ستون داده خالی مانده"),
        ("در صفحه نوشته Value و بعدش عدد", "در صفحه نوشته ارزش و بعدش عدد"),
        ("بخش Report هنوز کامل نشده", "بخش گزارش هنوز کامل نشده"),
        ("روی فرم نوشته Order ثبت شد", "روی فرم نوشته سفارش ثبت شد"),
        ("وضعیت آن در سیستم Pending است", "وضعیت آن در سیستم در انتظار است"),
    ]
    for a, b in cap_pairs:
        add("tashih", a, b, "cap")
        add("rasmi", a, b, "cap")

    # ---- 4. reinforce r250 gains: 漢 -> نویسه ----
    han_pairs = [
        ("دو نویسه 漢字 کنار جدول مانده که هیچ معنایی توی فارسی ندارند.",
         "دو نویسه بی‌معنا کنار جدول مانده که هیچ معنایی توی فارسی ندارند."),
        ("در متن چند 漢字 دیده می‌شود که باید فارسی شوند.",
         "در متن چند نویسهٔ چینی دیده می‌شود که باید فارسی شوند."),
        ("کنار گزارش 漢字 نوشته شده و هیچ‌کس نمی‌داند یعنی چه.",
         "کنار گزارش نویسهٔ چینی نوشته شده و هیچ‌کس نمی‌داند یعنی چه."),
        ("این 汉字ها باید به فارسی برگردند.", "این نویسه‌های چینی باید به فارسی برگردند."),
        ("در جدول 漢字 مانده که معنی ندارد.", "در جدول نویسهٔ بی‌معنا مانده است."),
    ]
    for a, b in han_pairs:
        add("lati", a, b, "han")
        add("tashih", a, b, "han")

    # ---- 5. pending / vitaSizeCache contexts ----
    pend_pairs = [
        ("وضعیت پرداخت هنوز pending است و باید صبر کنیم.",
         "وضعیت پرداخت هنوز در انتظار است و باید صبر کنیم."),
        ("هزینه‌های vitaSizeCache بالا رفته و بودجه کم است.",
         "هزینه‌های حافظهٔ نهان بالا رفته و بودجه کم است."),
        ("در گزارش آمده پرداخت pending است و بررسی می‌شود.",
         "در گزارش آمده پرداخت در انتظار است و بررسی می‌شود."),
        ("برای vitaSizeCache هزینهٔ اضافه ثبت شده است.",
         "برای حافظهٔ نهان هزینهٔ اضافه ثبت شده است."),
    ]
    for a, b in pend_pairs:
        add("lati", a, b, "pend")

    # ---- 6. digit-preservation scaffolds (keep the gain) ----
    DIG = [("۱۰۰", "۶۵"), ("۶۵", "۴۳"), ("۳۷", "۶۸"), ("۴۲", "۵۶"), ("۸۰", "۶۶")]
    sha = [
        ("از {A} نفر پرسیدیم و فقط {B} نفر جواب کامل دادند.",
         "از {A} تن پرسش کردیم و تنها {B} تن پاسخ را به پایان رساندند."),
        ("توی گزارش نوشته نرخ پاسخ {B} درصد بوده، ولی ما از {A} نفر سؤال کردیم.",
         "در گزارش آمده نرخ پاسخ {B} درصد است؛ اما ما از {A} تن پرسش کردیم."),
        ("{A} برگه به دستمان رسید ولی {B} برگه کامل بود.",
         "{A} برگ به ما رسید و از آن میان {B} برگ تمام و کامل بود."),
    ]
    for inp_t, out_t in sha:
        for a, b in DIG:
            add("shaeraneh", inp_t.format(A=a, B=b), out_t.format(A=a, B=b), "num")

    # ---- 7. clean stability rows ----
    for r in random.sample(clean, 500):
        out_rows.append(make_row(new_key("cln"), r["mode"], r["register"],
                                 r["system"], r["input"], r["output"]))

    random.shuffle(out_rows)
    with open(OUT, "w") as f:
        for r in out_rows:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
    print(f"v4cur3: {len(out_rows)} rows -> {OUT}")

if __name__ == "__main__":
    main()
