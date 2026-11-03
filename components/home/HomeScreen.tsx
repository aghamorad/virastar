'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Star } from '../Star'
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
    text: 'پیرو تکالیف آموزشی محوله، مراتب تحویل مستندات مربوطه به استحضار عالی می‌رسد؛ خواهشمند است در مهلت مقتضی نسبت به بررسی و اعلام نظر مقرر فرمایید.',
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
    <div className="relative min-h-[calc(100dvh-5rem)] py-8 sm:py-12 flex flex-col justify-between">
      {/* Decorative Persian Calligraphic Star Watermark */}
      <div className="animate-star-turn pointer-events-none absolute -start-28 top-1/4 -translate-y-1/2 text-brand opacity-[0.04]">
        <Star size={640} hollow />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto w-full text-center">
        {/* Artistic Calligraphic Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand/10 border border-brand/20 text-brand text-xs font-black mb-6 shadow-xs animate-fade-up">
          <Star size={14} />
          <span>میز کار هنرورزانه و پیرایشگر زبان فارسی</span>
        </div>

        <h1 className="text-4xl sm:text-6xl md:text-7xl font-black tracking-tight leading-[1.2] text-ink mb-4">
          بهتر بنویس، سنجیده‌تر بگو
        </h1>

        <p className="max-w-2xl mx-auto text-base sm:text-lg leading-8 text-ink-soft font-bold mb-8">
          ویراستار ابزاری برای اهل قلم و همه‌کسانی است که به کلمات اهمیت می‌دهند.
          غلط‌گیری دقیق املایی، تنظیم هوشمند نیم‌فاصله‌ها و تبدیل متن به ۱۳ لحن گوناگون فارسی.
        </p>

        {/* Master CTA Button */}
        <div className="flex flex-wrap items-center justify-center gap-4 mb-12">
          <Link
            href="/edit"
            className="v-seal-master text-base sm:text-lg"
          >
            <span>✒️</span>
            <span>ورود به میز کار و آغاز نگارش</span>
          </Link>
          <Link
            href="/styles"
            className="v-btn-ghost px-6 py-3.5 text-sm sm:text-base font-black shadow-xs"
          >
            <span>قلم‌دان ۱۳ سبک نگارش</span>
          </Link>
        </div>

        {/* Live Transformation Demonstration Station */}
        <div className="v-folio p-5 sm:p-7 text-start shadow-card mb-12 border-2 border-brand/20">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-border/70">
            <div className="flex items-center gap-2">
              <span className="text-xl">✨</span>
              <div>
                <h3 className="font-black text-sm sm:text-base text-ink">
                  کارگاه زندهٔ دگرگونی لحن در زبان فارسی
                </h3>
                <p className="text-[11px] text-ink-soft">
                  روی هر مهر کلیک کنید تا ببینید یک پیام ساده چگونه بازآفرینی می‌شود
                </p>
              </div>
            </div>

            {/* Style Selector Seals */}
            <div className="flex flex-wrap items-center gap-1.5">
              {Object.entries(SAMPLES).map(([key, item]) => {
                const isActive = activeStyle === key
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setActiveStyle(key)}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                      isActive
                        ? 'bg-brand text-on-brand shadow-sm scale-105 ring-2 ring-brand/30'
                        : 'bg-paper text-ink border border-border hover:border-brand/40'
                    }`}
                  >
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Raw Input Draft */}
            <div className="rounded-2xl bg-paper/70 p-4 border border-border/70">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-extrabold text-ink-soft">پیش‌نویس خام و محاوره‌ای:</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-700 font-bold">
                  بدون ویرایش
                </span>
              </div>
              <p className="text-sm leading-7 text-ink/80 font-medium">
                «سلام استاد خسته نباشین من تمرین رو فرستادم کی جواب میدین ممنون»
              </p>
            </div>

            {/* Refined Folio */}
            <div className="rounded-2xl bg-brand/5 p-4 border border-brand/25 relative overflow-hidden">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-black text-brand flex items-center gap-1.5">
                  <span>{sample.icon}</span>
                  <span>نسخهٔ پیراستهٔ ویراستار ({sample.label}):</span>
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-brand/15 text-brand font-black">
                  مهر تایید
                </span>
              </div>
              <p className="text-sm leading-7 text-ink font-bold animate-fade-up">
                {sample.text}
              </p>
            </div>
          </div>
        </div>

        {/* 3 Luxury Craft Folio Cards */}
        <div className="grid gap-4 sm:grid-cols-3 text-start">
          <Link
            href="/history"
            className="v-card p-5 hover:-translate-y-1 transition-all group border border-border/80"
          >
            <div className="flex items-center gap-3 mb-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand/10 text-brand group-hover:scale-110 transition-transform">
                <HistoryGlyph size={22} />
              </span>
              <div>
                <h3 className="font-black text-base text-ink">دفتر نگارش‌ها</h3>
                <p className="text-xs text-ink-soft font-bold">حافظهٔ آفلاین نوشته‌ها</p>
              </div>
            </div>
            <p className="text-xs leading-6 text-ink-soft">
              تمام متون ویرایش‌شده به صورت امن در حافظهٔ دستگاه شما ذخیره می‌شوند و هر زمان قابل بازخوانی هستند.
            </p>
          </Link>

          <Link
            href="/styles"
            className="v-card p-5 hover:-translate-y-1 transition-all group border border-border/80"
          >
            <div className="flex items-center gap-3 mb-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand/10 text-brand group-hover:scale-110 transition-transform">
                <StylesGlyph size={22} />
              </span>
              <div>
                <h3 className="font-black text-base text-ink">قلم‌دان ۱۳ سبک</h3>
                <p className="text-xs text-ink-soft font-bold">از رسمی تا لاتی و دیوانی</p>
              </div>
            </div>
            <p className="text-xs leading-6 text-ink-soft">
              از نامه‌نگاری اداری و لوایح حقوقی دادگستری تا نثر گلستان، شوخی‌های روزمره و متن‌های نسل جدید.
            </p>
          </Link>

          <Link
            href="/settings"
            className="v-card p-5 hover:-translate-y-1 transition-all group border border-border/80"
          >
            <div className="flex items-center gap-3 mb-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand/10 text-brand group-hover:scale-110 transition-transform">
                <SettingsGlyph size={22} />
              </span>
              <div>
                <h3 className="font-black text-base text-ink">کارگاه هوش مصنوعی</h3>
                <p className="text-xs text-ink-soft font-bold">۱۰۰٪ آفلاین یا ابری</p>
              </div>
            </div>
            <p className="text-xs leading-6 text-ink-soft">
              امکان اجرای مدل‌های آفلاین روی گوشی، اتصال ۱-کلیکه به سرور رایگان Cloudflare یا استفاده از کلید Gemini.
            </p>
          </Link>
        </div>
      </div>
    </div>
  )
}
