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
    <div className="space-y-10 py-6 max-w-5xl mx-auto">
      {/* 1. Yellow Poster carrying oversized headline strips & Red Arrow Accent */}
      <section className="border-4 border-black bg-[#ffed00] p-6 sm:p-10 shadow-[8px_8px_0px_#000] relative">
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <span className="nb-strip-black text-sm uppercase">
            نسخه ۱.۶.۰ · NEO-BRUTALISM EDITION
          </span>
          <span className="nb-strip-red text-sm uppercase">
            بدون لکنت املایی
          </span>
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="nb-strip-black text-3xl sm:text-5xl md:text-6xl font-black">
              ویراستار فارسی
            </span>
            <span className="nb-signal-tile w-12 h-12 sm:w-16 sm:h-16 text-2xl sm:text-3xl font-black">
              →
            </span>
          </div>

          <div className="block">
            <span className="bg-white text-black border-4 border-black px-4 py-2 text-2xl sm:text-4xl md:text-5xl font-black shadow-[4px_4px_0px_#000] inline-block">
              بهتر بنویس، بی‌نقص بگو
            </span>
          </div>
        </div>

        <p className="mt-6 text-base sm:text-lg font-black text-black max-w-2xl leading-8">
          ابزار مقتدر پیرایش و بازآفرینی زبان فارسی. غلط‌گیری دقیق املایی، درج خودکار نیم‌فاصله‌ها و تبدیل جملات عامیانه به ۱۳ لحن رسمی، اداری، حقوقی و ادبی.
        </p>

        {/* Action Buttons in Yellow Poster */}
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <Link
            href="/edit"
            className="v-btn-primary text-base sm:text-lg px-8 py-3.5 bg-[#ff4332] text-white hover:bg-black shadow-[6px_6px_0px_#000]"
          >
            <span>✒️</span>
            <span>ورود به میز ویرایش متن</span>
          </Link>
          <Link
            href="/styles"
            className="v-btn-ghost text-base sm:text-lg px-6 py-3.5 bg-white text-black shadow-[6px_6px_0px_#000]"
          >
            <span>قلم‌دان ۱۳ لحن فارسی</span>
          </Link>
        </div>
      </section>

      {/* 2. Violet Band beneath holding explanation & live transformation */}
      <section className="nb-violet-band space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b-3 border-black pb-3">
          <div className="flex items-center gap-2">
            <span className="bg-black text-yellow-300 font-black px-2 py-0.5 text-xs border border-black">
              کارگاه
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-black">
              آزمایشگاه زندهٔ دگرگونی لحن در زبان فارسی
            </h2>
          </div>
          <span className="text-xs font-black text-black bg-white px-3 py-1 border-2 border-black shadow-[2px_2px_0px_#000]">
            روی سبک‌ها کلیک کنید
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
                className={`border-3 border-black px-3.5 py-1.5 text-xs sm:text-sm font-black transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#ffed00] text-black shadow-[4px_4px_0px_#000] translate-x-[-2px] translate-y-[-2px]'
                    : 'bg-white text-black shadow-[2px_2px_0px_#000] hover:bg-[#ffed00]'
                }`}
              >
                <span className="ml-1">{item.icon}</span>
                <span>{item.label}</span>
              </button>
            )
          })}
        </div>

        {/* Comparison Row: Raw vs Refined */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="border-3 border-black bg-white p-4 shadow-[4px_4px_0px_#000]">
            <div className="flex items-center justify-between border-b-2 border-black pb-2 mb-3">
              <span className="text-xs font-black bg-black text-white px-2 py-0.5">
                ورودی خام محاوره‌ای
              </span>
              <span className="text-xs font-black text-[#ff4332]">بدون ویرایش</span>
            </div>
            <p className="text-sm sm:text-base leading-7 font-black text-black">
              «سلام استاد خسته نباشین من تمرین رو فرستادم کی جواب میدین ممنون»
            </p>
          </div>

          <div className="border-3 border-black bg-[#ffed00] p-4 shadow-[4px_4px_0px_#000]">
            <div className="flex items-center justify-between border-b-2 border-black pb-2 mb-3">
              <span className="text-xs font-black bg-[#ff4332] text-white px-2 py-0.5 border border-black">
                نسخه پیراسته ({sample.label})
              </span>
              <span className="text-xs font-black text-black">✓ مهر تأیید ویراستار</span>
            </div>
            <p className="text-sm sm:text-base leading-7 font-black text-black">
              {sample.text}
            </p>
          </div>
        </div>
      </section>

      {/* 3. Ruled Ledger: Features with clear internal divisions */}
      <section className="nb-ledger">
        <div className="p-4 bg-black text-white border-b-4 border-black flex items-center justify-between">
          <h3 className="font-black text-base sm:text-lg">ویژگی‌های بنیادی ویراستار</h3>
          <span className="text-xs font-mono font-bold bg-[#ffed00] text-black px-2 py-0.5">
            SPECIFICATION
          </span>
        </div>

        <div className="grid sm:grid-cols-3 divide-y-3 sm:divide-y-0 sm:divide-x-3 sm:divide-x-reverse divide-black bg-white">
          <Link
            href="/history"
            className="p-5 hover:bg-[#fff5d6] transition-colors group flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="bg-[#ffed00] p-2 border-2 border-black shadow-[2px_2px_0px_#000]">
                  <HistoryGlyph size={20} />
                </span>
                <span className="text-xs font-black bg-black text-white px-2 py-0.5">۰۱</span>
              </div>
              <h4 className="font-black text-base text-black mb-1">دفتر نگارش‌های آفلاین</h4>
              <p className="text-xs font-bold text-black/80 leading-5">
                تمام نوشته‌ها در حافظه دستگاه شما ثبت می‌شوند؛ بدون نیاز به اینترنت و بدون ردیابی.
              </p>
            </div>
            <span className="mt-4 text-xs font-black text-[#ff4332] group-hover:underline">
              مشاهده نوشته‌ها →
            </span>
          </Link>

          <Link
            href="/styles"
            className="p-5 hover:bg-[#fff5d6] transition-colors group flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="bg-[#d4bdff] p-2 border-2 border-black shadow-[2px_2px_0px_#000]">
                  <StylesGlyph size={20} />
                </span>
                <span className="text-xs font-black bg-black text-white px-2 py-0.5">۰۲</span>
              </div>
              <h4 className="font-black text-base text-black mb-1">قلم‌دان سیزده لحن</h4>
              <p className="text-xs font-bold text-black/80 leading-5">
                از لوایح دادگستری و نامه‌های اداری تا نثر گلستان، شوخی‌های روزمره و اصطلاحات جوانان.
              </p>
            </div>
            <span className="mt-4 text-xs font-black text-[#ff4332] group-hover:underline">
              آزمایش سبک‌ها →
            </span>
          </Link>

          <Link
            href="/settings"
            className="p-5 hover:bg-[#fff5d6] transition-colors group flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="bg-[#ff4332] text-white p-2 border-2 border-black shadow-[2px_2px_0px_#000]">
                  <SettingsGlyph size={20} />
                </span>
                <span className="text-xs font-black bg-black text-white px-2 py-0.5">۰۳</span>
              </div>
              <h4 className="font-black text-base text-black mb-1">مرکز مدل‌های هوش مصنوعی</h4>
              <p className="text-xs font-bold text-black/80 leading-5">
                دانلود مدل‌های آفلاین روی گوشی، اتصال ۱-کلیکه به سرور Cloudflare یا کلید رایگان Gemini.
              </p>
            </div>
            <span className="mt-4 text-xs font-black text-[#ff4332] group-hover:underline">
              پیکربندی هوش مصنوعی →
            </span>
          </Link>
        </div>
      </section>
    </div>
  )
}
