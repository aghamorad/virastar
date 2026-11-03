import type { ReactNode } from 'react'
import Link from 'next/link'
import { MODES, type WritingMode } from '@/domain/modes'
import { ModeGlyph } from '../editor/ModeGlyph'
import { Star } from '../Star'

const SECTIONS = [
  {
    title: 'دیوان، دارالحکومه و مکاتبات رسمی',
    tagline: 'برای نامه‌های کاری، لوایح دادگستری، مکاتبات اداری و مکاتبات منشیانه',
    icon: '🏛️',
    modeIds: ['tashih', 'rasmi', 'edari', 'hoghooghi', 'divani'],
  },
  {
    title: 'ادبستان، حکمت و اندیشه',
    tagline: 'برای پژوهش‌های علمی، مقالات دانشگاهی، نثر فاخر گلستان و شعر',
    icon: '📜',
    modeIds: ['adabi', 'daneshgahi', 'shaerane'],
  },
  {
    title: 'کوچه، بازار و طنز صمیمانه',
    tagline: 'برای چت‌های دوستانه، تعارف‌های شیرین، مرام تهرانی و زبان شبکه‌های اجتماعی',
    icon: '☕',
    modeIds: ['khodemani', 'lati', 'taarofi', 'pachekhari', 'genz'],
  },
]

export function StylesScreen() {
  return (
    <div className="space-y-12 max-w-5xl mx-auto pb-12">
      <header className="border-b border-border/70 pb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand/10 text-brand text-xs font-black mb-3">
          <Star size={13} />
          <span>قلم‌دان ۱۳ لحن و آوای زبان فارسی</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-ink tracking-tight">
          جُنگ و نگارخانهٔ سبک‌های نگارش
        </h1>
        <p className="mt-2.5 max-w-2xl text-sm sm:text-base leading-7 text-ink-soft font-bold">
          هر سبک در ویراستار، یک لحنِ زنده با دستور زبان و واژگان گزیده است. ویراستار بدون گم کردن معنای اصلی شما، جامهٔ واژه‌ها را دگرگون می‌کند.
        </p>
      </header>

      {SECTIONS.map((sec) => {
        const modes = MODES.filter((m) => sec.modeIds.includes(m.id))
        return (
          <section key={sec.title} className="space-y-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-s-4 border-brand ps-3">
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-ink flex items-center gap-2">
                  <span>{sec.icon}</span>
                  <span>{sec.title}</span>
                </h2>
                <p className="text-xs sm:text-sm text-ink-soft mt-0.5 font-bold">{sec.tagline}</p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {modes.map((m) => (
                <ModeCard key={m.id} mode={m} />
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}

function ModeCard({ mode }: { mode: WritingMode }) {
  return (
    <Link
      href={`/edit?mode=${mode.id}`}
      prefetch={false}
      className="v-folio p-5 group flex flex-col justify-between transition-all hover:-translate-y-1 hover:shadow-card cursor-pointer border border-border/80"
    >
      <div>
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10 text-brand border border-brand/20 group-hover:scale-110 transition-transform">
              <ModeGlyph modeId={mode.id} size={20} />
            </span>
            <div>
              <h3 className="text-base font-black text-ink leading-tight">{mode.label}</h3>
              <p className="text-[11px] font-bold text-ink-soft">{mode.tagline}</p>
            </div>
          </div>

          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-paper-deep text-ink-soft border border-border">
            {mode.register}
          </span>
        </div>

        <p className="text-xs leading-6 text-ink-soft mb-4">
          {mode.description}
        </p>
      </div>

      <div className="pt-3 border-t border-border/60 flex items-center justify-between text-xs font-black text-brand">
        <span className="flex items-center gap-1.5 group-hover:translate-x-[-2px] transition-transform">
          <Star size={12} />
          <span>تحریر با این لحن</span>
        </span>
        <span className="text-lg leading-none opacity-40 group-hover:opacity-100 transition-opacity">
          ←
        </span>
      </div>
    </Link>
  )
}
