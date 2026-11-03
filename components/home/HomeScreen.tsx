'use client'

import { useState } from 'react'
import Link from 'next/link'
import { HistoryGlyph, SettingsGlyph, StylesGlyph } from '../Glyphs'

const SAMPLES: Record<string, { label: string; icon: string; text: string }> = {
  rasmi: {
    label: 'رسمی و اداری',
    icon: '🏛️',
    text: 'استاد ارجمند، با عرض سلام و احترام؛ بدین‌وسیله تمرین محوله ارسال گردید. خواهشمند است در صورت امکان زمان اعلام نتیجه را تعیین فرمایید. با سپاس فراوان.',
  },
  hoghooghi: {
    label: 'حقوقی و مستدل',
    icon: '⚖️',
    text: 'پیرو تکالیف آموزشی محوله، مراتب تحویل مستندات به استحضار عالی می‌رسد؛ خواهشمند است در مهلت مقتضی نسبت به بررسی و صدور دستور مقتضی اقدام فرمایند.',
  },
  khodemani: {
    label: 'خودمانی و صمیمی',
    icon: '☕',
    text: 'سلام استاد جان، خسته نباشی! تمرین‌ها رو فرستادم خدمتت؛ هروقت فرصت کردی یه نگاهی بهشون بنداز. دمت گرم و ارادتمند.',
  },
  divani: {
    label: 'دیوانی عهد قاجار',
    icon: '📜',
    text: 'حضور مهرظهور استاد معظم دام‌فضله العالی؛ رقیمهٔ تکالیف بدین‌وسیله به ساحت اقدستان واصل آمد؛ مستدعی است در اوقاتی خجسته نسبت به بازبینی بذل عنایت مبذول دارند.',
  },
  lati: {
    label: 'لاتی و باصفا',
    icon: '👑',
    text: 'سلام مخلص استاد گل، چاکریم به مولا. تکالیف رو مشتی و بی‌کم‌وکسر فرستادم خدمتت؛ هروقت صفا دادی یه نگاهی بهش بنداز داداش. تاج سری.',
  },
}

export function HomeScreen() {
  const [activeStyle, setActiveStyle] = useState<string>('rasmi')
  const sample = SAMPLES[activeStyle] ?? SAMPLES.rasmi

  return (
    <div className="space-y-12 py-6 max-w-5xl mx-auto">
      {/* 1. Large Handwritten Statement beside cluster of notes & tape strip */}
      <section className="v-card p-6 sm:p-10 relative">
        <div className="sketch-tape" aria-hidden="true" />

        <div className="flex flex-wrap items-center gap-2 mb-4">
          <span className="sketch-blue-note text-xs">
            ✎ برگهٔ کاری و تحریریهٔ فارسی
          </span>
          <span className="sketch-highlight text-xs font-bold">
            بدون لکنت و غلط املایی
          </span>
        </div>

        <div className="space-y-2">
          <h1 className="text-3xl sm:text-5xl md:text-6xl font-black text-ink tracking-tight leading-tight">
            بهتر بنویس، <span className="sketch-highlight">بی‌نقص بگو</span>
          </h1>
          <p className="text-xl sm:text-2xl font-bold text-accent pt-1">
            دستیار هوشمند پیرایش، ویرایش و بازنویسی زبان فارسی
          </p>
        </div>

        <p className="mt-5 text-base sm:text-lg text-ink-soft max-w-2xl leading-relaxed font-normal">
          جملات خود را با خیال راحت بنویسید؛ ویراستار غلط‌های املایی را می‌گیرد، نیم‌فاصله‌ها و علائم نگارشی را در جای درست می‌نشاند و لحن متن شما را به ۱۳ سبک مختلف دگرگون می‌سازد.
        </p>

        {/* Action Buttons & Hand-drawn arrow */}
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <Link
            href="/edit"
            className="v-btn-primary text-base px-6 py-3"
          >
            <span>✒️</span>
            <span>ورود به میز ویرایش متن</span>
          </Link>
          <Link
            href="/styles"
            className="v-btn-ghost text-base px-5 py-3"
          >
            <span>قلم‌دان ۱۳ لحن فارسی</span>
          </Link>
          <span className="text-xs text-ink-soft hidden sm:inline-flex items-center gap-1 font-bold">
            <span className="text-brand">⤹</span> آماده نگارش بدون نیاز به ثبت‌نام
          </span>
        </div>
      </section>

      {/* 2. Process / Comparison Row: Raw vs Refined on a Taped Sheet */}
      <section className="v-card p-6 sm:p-8 space-y-6 relative">
        <div className="sketch-tape" aria-hidden="true" />

        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/80 pb-3">
          <div className="flex items-center gap-2">
            <span className="sketch-bracket text-lg">[</span>
            <h2 className="text-xl sm:text-2xl font-black text-ink">
              آزمایشگاه زندهٔ دگرگونی لحن در زبان فارسی
            </h2>
            <span className="sketch-bracket text-lg">]</span>
          </div>
          <span className="text-xs font-bold text-accent bg-paper px-2.5 py-1 border border-border rounded-[6px_3px_8px_4px]">
            روی هر لحن بزنید تا بازنویسی آن را ببینید ✎
          </span>
        </div>

        {/* Style Selector Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {Object.entries(SAMPLES).map(([key, item]) => {
            const isActive = activeStyle === key
            return (
              <button
                key={key}
                type="button"
                onClick={() => setActiveStyle(key)}
                className={`v-chip px-3 py-1.5 text-xs sm:text-sm font-bold ${
                  isActive ? 'v-chip-active' : ''
                }`}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            )
          })}
        </div>

        {/* Comparison Row: Raw vs Refined */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* Raw Draft Scrap */}
          <div className="bg-paper p-4 rounded-[10px_5px_12px_6px] border border-border shadow-soft">
            <div className="flex items-center justify-between border-b border-border pb-2 mb-3">
              <span className="text-xs font-bold text-ink-soft">
                ورودی خام محاوره‌ای
              </span>
              <span className="text-xs text-brand font-bold">بدون ویرایش</span>
            </div>
            <p className="text-sm sm:text-base leading-relaxed text-ink-soft font-medium">
              «سلام استاد خسته نباشین من تمرین رو فرستادم کی جواب میدین ممنون»
            </p>
          </div>

          {/* Refined Sheet Highlighted */}
          <div className="bg-highlight/50 p-4 rounded-[10px_5px_12px_6px] border border-ink/30 shadow-soft">
            <div className="flex items-center justify-between border-b border-ink/20 pb-2 mb-3">
              <span className="text-xs font-bold text-ink flex items-center gap-1">
                <span>✓</span> نسخهٔ پیراسته ({sample.label})
              </span>
              <span className="text-xs text-accent font-bold">تأیید ویراستار</span>
            </div>
            <p className="text-sm sm:text-base leading-relaxed font-bold text-ink">
              {sample.text}
            </p>
          </div>
        </div>
      </section>

      {/* 3. Features as Open Thoughts with Circled Numbers */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="sketch-bracket text-lg">[</span>
          <h3 className="font-black text-lg text-ink">ویژگی‌های بنیادی دفترچهٔ ویراستار</h3>
          <span className="sketch-bracket text-lg">]</span>
        </div>

        <div className="grid sm:grid-cols-3 gap-4">
          <Link
            href="/history"
            className="v-card p-5 group flex flex-col justify-between hover:border-ink transition-all"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="bg-highlight p-2 border border-border rounded-[8px_4px_10px_4px] shadow-soft">
                  <HistoryGlyph size={18} />
                </span>
                <span className="text-xs font-bold text-accent bg-paper px-2 py-0.5 rounded-[4px] border border-border">①</span>
              </div>
              <h4 className="font-bold text-base text-ink mb-1">دفتر نگارش‌های آفلاین</h4>
              <p className="text-xs text-ink-soft leading-relaxed font-normal">
                تمام نوشته‌ها فقط در حافظهٔ دستگاه شما ثبت می‌شوند؛ بدون نیاز به اینترنت و بدون ردیابی.
              </p>
            </div>
            <span className="mt-4 text-xs font-bold text-brand group-hover:underline">
              مشاهده نوشته‌ها ←
            </span>
          </Link>

          <Link
            href="/styles"
            className="v-card p-5 group flex flex-col justify-between hover:border-ink transition-all"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="bg-paper-deep p-2 border border-border rounded-[8px_4px_10px_4px] shadow-soft">
                  <StylesGlyph size={18} />
                </span>
                <span className="text-xs font-bold text-accent bg-paper px-2 py-0.5 rounded-[4px] border border-border">②</span>
              </div>
              <h4 className="font-bold text-base text-ink mb-1">قلم‌دان سیزده لحن</h4>
              <p className="text-xs text-ink-soft leading-relaxed font-normal">
                از لوایح دادگستری و نامه‌های اداری تا نثر گلستان، شوخی‌های روزمره و اصطلاحات جوانان.
              </p>
            </div>
            <span className="mt-4 text-xs font-bold text-brand group-hover:underline">
              آزمایش سبک‌ها ←
            </span>
          </Link>

          <Link
            href="/settings"
            className="v-card p-5 group flex flex-col justify-between hover:border-ink transition-all"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="bg-surface p-2 border border-border rounded-[8px_4px_10px_4px] shadow-soft">
                  <SettingsGlyph size={18} />
                </span>
                <span className="text-xs font-bold text-accent bg-paper px-2 py-0.5 rounded-[4px] border border-border">③</span>
              </div>
              <h4 className="font-bold text-base text-ink mb-1">مرکز مدل‌های هوش مصنوعی</h4>
              <p className="text-xs text-ink-soft leading-relaxed font-normal">
                دانلود مدل‌های آفلاین روی گوشی، اتصال ۱-کلیکه به سرور Cloudflare یا کلید رایگان Gemini.
              </p>
            </div>
            <span className="mt-4 text-xs font-bold text-brand group-hover:underline">
              پیکربندی هوش مصنوعی ←
            </span>
          </Link>
        </div>
      </section>
    </div>
  )
}
