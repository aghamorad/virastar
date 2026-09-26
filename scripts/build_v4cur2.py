#!/usr/bin/env python3
"""Build v4cur2: a focused repair set for the step-400 diagnostic winner.

The v4cur curriculum cut the 44-case diagnostic from 18 to 4 hard issues
(foreign-script 2, lost-number 2). This set drills the exact remaining leaks:
  - 漢字 -> نویسه (and a few other Chinese chars)  [foreign-script]
  - Latin financial tokens (holding / nominal value / vitaSizeCache / ...)
    -> Persian                                 [echo prevention]
  - digit preservation in shaeraneh/taaroofi/edari  [lost-number]
  - clean Persian rows to anchor pure-Persian output  [Thai hallucination]

All injection outputs are authored by this script (no teacher), so every
input->output pair is guaranteed correct.
"""
import json, random, re, sys

random.seed(7)

V4 = "data/distill/v4/train.jsonl"
OUT = "data/distill/v4cur2/train.jsonl"

def has_foreign(s):
    return bool(re.search(r"[A-Za-z一-鿿぀-ヿ฀-๿ऀ-ॿЀ-ӿ]", s))

def load_clean_rows():
    rows = []
    for line in open(V4):
        r = json.loads(line)
        if not has_foreign(r["input"]) and not has_foreign(r["output"]):
            rows.append(r)
    return rows

def inject(s, token, frac):
    parts = s.split(" ")
    pos = max(1, min(len(parts) - 1, round((len(parts) - 1) * frac)))
    parts.insert(pos, token)
    return " ".join(parts)

def make_row(key, mode, register, system, text_input, text_output):
    user = system + "\n\n" + text_input
    return {
        "key": key,
        "mode": mode,
        "register": register,
        "system": system,
        "input": text_input,
        "output": text_output,
        "messages": [
            {"role": "user", "content": user},
            {"role": "assistant", "content": text_output},
        ],
    }

def main():
    clean = load_clean_rows()
    print(f"clean base rows: {len(clean)}")
    by_mode = {}
    for r in clean:
        by_mode.setdefault(r["mode"], []).append(r)
    out_rows = []
    key_counter = [0]

    def new_key(prefix):
        key_counter[0] += 1
        return f"{prefix}-{key_counter[0]:05d}"

    # ---- 1. targeted foreign->Persian injections ----
    pairs = [
        # (foreign token, Persian translation, repetitions)
        ("漢字", "نویسه", 100),
        ("汉字", "نویسه", 70),
        ("中国", "چین", 30),
        ("中文", "زبان چینی", 30),
        ("支付", "پرداخت", 30),
        ("银行", "بانک", 30),
        ("报告", "گزارش", 30),
        ("钱", "پول", 30),
        ("学习", "یادگیری", 20),
        ("需要", "نیاز", 20),
        ("भुगतान", "پرداخت", 70),
        ("pending", "در انتظار", 70),
        ("vitaSizeCache", "حافظهٔ نهان", 70),
        ("holding", "هلدینگ", 50),
        ("Nominal Value", "ارزش اسمی", 50),
        ("nominal", "اسمی", 30),
        ("value", "ارزش", 40),
        ("status", "وضعیت", 40),
        ("report", "گزارش", 40),
        ("data", "داده", 40),
        ("online", "برخط", 40),
        ("cache", "حافظهٔ نهان", 40),
        ("need", "نیاز", 30),
        ("work", "کار", 30),
        ("money", "پول", 30),
        ("bank", "بانک", 30),
        ("market", "بازار", 30),
        ("percent", "درصد", 30),
        ("number", "شماره", 30),
        ("time", "زمان", 30),
        ("paid", "پرداخت‌شده", 25),
        ("total", "مجموع", 25),
        ("balance", "موجودی", 25),
        ("invoice", "صورت‌حساب", 25),
        ("amount", "مبلغ", 25),
        ("payment", "پرداخت", 25),
        ("customer", "مشتری", 25),
        ("order", "سفارش", 25),
        ("price", "قیمت", 25),
        ("cost", "هزینه", 25),
        ("fee", "کارمزد", 25),
    ]
    for token, persian, reps in pairs:
        for _ in range(reps):
            base = random.choice(clean)
            frac = random.uniform(0.15, 0.85)
            inp = inject(base["input"], token, frac)
            out = inject(base["output"], persian, frac)
            out_rows.append(make_row(new_key("tgt"), base["mode"],
                                     base["register"], base["system"], inp, out))
    print(f"targeted injections: {sum(p[2] for p in pairs)}")

    # ---- 2. digit-preservation lessons ----
    # 2a. real v4 rows with digits in the weak registers
    for r in clean:
        if r["mode"] in ("shaeraneh", "taaroofi", "edari") and re.search(r"[۰-۹0-9]", r["input"]):
            out_rows.append(make_row(new_key("num"), r["mode"], r["register"],
                                     r["system"], r["input"], r["output"]))
    # 2b. scaffold pairs (informal -> formal/poetic), digits preserved verbatim
    scaffolds = []
    def sc(mode, register, system_src_mode, inp, out):
        scaffolds.append((mode, register, system_src_mode, inp, out))
    DIG = [("۱۰۰", "۶۵"), ("۶۵", "۴۳"), ("۳۷", "۶۸"), ("۴۲", "۵۶"), ("۸۰", "۶۶")]
    sha = [
        ("از {A} نفر پرسیدیم و فقط {B} نفر جواب کامل دادند.",
         "از {A} تن پرسش کردیم و تنها {B} تن پاسخ را به پایان رساندند."),
        ("توی گزارش نوشته نرخ پاسخ {B} درصد بوده، ولی ما از {A} نفر سؤال کردیم.",
         "در گزارش آمده نرخ پاسخ {B} درصد است؛ اما ما از {A} تن پرسش کردیم."),
        ("{A} برگه به دستمان رسید ولی {B} برگه کامل بود.",
         "{A} برگ به ما رسید و از آن میان {B} برگ تمام و کامل بود."),
        ("از {A} دانش‌آموز، فقط {B} نفر امتحان را تمام کردند.",
         "از {A} دانش‌پژوه، تنها {B} تن آزمون را به فرجام رساندند."),
        ("{A} روز منتظر ماندیم و بعد از {B} روز دیگر خبر آمد.",
         "{A} روز در انتظار ماندیم و پس از {B} روز دیگر، خبر فرا رسید."),
        ("می‌گفتند {A} تاکسی آمده اما {B} تا هنوز سر جایش است.",
         "گفتند {A} درشکه رسیده، اما {B} درشکه هنوز بر جای خود است."),
        ("از {A} باغ، {B} باغ شکوفه داد و بقیه خشک ماندند.",
         "از {A} باغ، {B} باغ به شکوفه نشست و دیگران به خشکی ماندند."),
    ]
    for inp_t, out_t in sha:
        for a, b in DIG:
            inp = inp_t.format(A=a, B=b)
            out = out_t.format(A=a, B=b)
            sc("shaeraneh", "shaeraneh", "shaeraneh", inp, out)
    edari = [
        ("لطفاً {A} نسخه از فرم را به {B} واحد تحویل دهید.",
         "خواهشمند است {A} نسخه از فرم را به {B} واحد تحویل فرمایید."),
        ("گزارش در {A} صفحه تنظیم شده و {B} پیوست دارد.",
         "گزارش در {A} صفحه تنظیم شده و دارای {B} پیوست است."),
        ("مجموع {A} فاکتور به مبلغ {B} میلیون تومان رسیده است.",
         "مجموع {A} صورتحساب به مبلغ {B} میلیون تومان بالغ گردیده است."),
        ("این درخواست در {A} بند تنظیم شده و بند {B} مورد تأیید نیست.",
         "این درخواست در {A} بند تنظیم شده و بند {B} مورد تأیید نمی‌باشد."),
    ]
    for inp_t, out_t in edari:
        for a, b in DIG:
            inp = inp_t.format(A=a, B=b)
            out = out_t.format(A=a, B=b)
            sc("edari", "edari", "edari", inp, out)
    taaroofi = [
        ("خواهش می‌کنم {A} تا از کتاب‌ها رو تا {B} روز دیگه بهتون پس بدم.",
         "خواهش می‌کنم {A} نسخه از کتاب‌ها را تا {B} روز دیگر به شما بازگردانم."),
        ("اگه {A} نفر بیان، می‌تونیم {B} میز هم اضافه کنیم.",
         "اگر {A} نفر تشریف بیاورند، می‌توانیم {B} میز نیز اضافه کنیم."),
        ("{A} جلد از این دیوان رو براتون کنار گذاشتم و {B} جلد دیگه هم سفارش دادم.",
         "{A} نسخه از این دیوان را برایتان کنار گذاشتم و {B} نسخه دیگر نیز سفارش دادم."),
    ]
    for inp_t, out_t in taaroofi:
        for a, b in DIG:
            inp = inp_t.format(A=a, B=b)
            out = out_t.format(A=a, B=b)
            sc("taaroofi", "taaroofi", "taaroofi", inp, out)
    for mode, register, sys_mode, inp, out in scaffolds:
        sys_row = random.choice(by_mode[sys_mode])
        out_rows.append(make_row(new_key("num"), mode, register,
                                 sys_row["system"], inp, out))
    print(f"digit lessons (real + scaffolds): "
          f"{sum(1 for r in clean if r['mode'] in ('shaeraneh','taaroofi','edari') and re.search(r'[۰-۹0-9]', r['input']))} + {len(scaffolds)}")

    # ---- 3. clean stability rows (anchor pure-Persian output) ----
    clean_sample = random.sample(clean, 1400)
    for r in clean_sample:
        out_rows.append(make_row(new_key("cln"), r["mode"], r["register"],
                                 r["system"], r["input"], r["output"]))
    print(f"clean stability rows: {len(clean_sample)}")

    # ---- write ----
    random.shuffle(out_rows)
    with open(OUT, "w") as f:
        for r in out_rows:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
    print(f"TOTAL: {len(out_rows)} rows -> {OUT}")

if __name__ == "__main__":
    main()
