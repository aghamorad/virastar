import Link from 'next/link'
import { MODES, type WritingMode } from '@/domain/modes'
import { ModeGlyph } from '../editor/ModeGlyph'

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
      {/* Sketch Header Scrap */}
      <header className="v-card p-6 sm:p-8 relative">
        <div className="sketch-tape" aria-hidden="true" />
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="sketch-blue-note text-xs">
            ✎ نگارخانهٔ لحن‌های فارسی
          </span>
          <span className="sketch-highlight text-xs font-bold">
            ۱۳ آوای متمایز نگارش
          </span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-ink tracking-tight leading-tight">
          جُنگ و نگارخانهٔ سبک‌های نگارش
        </h1>
        <p className="mt-2.5 max-w-2xl text-sm sm:text-base leading-relaxed text-ink-soft font-normal">
          هر سبک در ویراستار، یک لحنِ زنده با دستور زبان و واژگان گزیده است. ویراستار بدون گم کردن معنای اصلی شما، جامهٔ واژه‌ها را با دقت دگرگون می‌کند.
        </p>
      </header>

      {SECTIONS.map((sec) => {
        const modes = MODES.filter((m) => sec.modeIds.includes(m.id))
        return (
          <section key={sec.title} className="space-y-4">
            {/* Section Header with Drawn Bracket */}
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border/80 pb-2">
              <div className="flex items-center gap-2">
                <span className="sketch-bracket text-lg">[</span>
                <h2 className="text-xl sm:text-2xl font-bold text-ink flex items-center gap-2">
                  <span className="text-xl">{sec.icon}</span>
                  <span>{sec.title}</span>
                </h2>
                <span className="sketch-bracket text-lg">]</span>
                <p className="text-xs sm:text-sm text-ink-soft hidden md:inline-block font-normal">
                  — {sec.tagline}
                </p>
              </div>
              <span className="text-xs text-ink-soft bg-paper px-2.5 py-0.5 rounded-[4px] border border-border">
                {modes.length.toLocaleString('fa-IR')} لحن
              </span>
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
      className="v-card p-5 group flex flex-col justify-between hover:border-ink hover:rotate-[-0.5deg] transition-all cursor-pointer shadow-soft"
    >
      <div>
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px_4px_10px_4px] bg-paper border border-border text-brand group-hover:bg-highlight group-hover:border-ink transition-all shadow-soft">
              <ModeGlyph modeId={mode.id} size={20} />
            </span>
            <div>
              <h3 className="text-base font-bold text-ink leading-tight">{mode.label}</h3>
              <p className="text-[11px] text-ink-soft font-normal">{mode.tagline}</p>
            </div>
          </div>

          <span className="sketch-highlight text-[10px] font-bold shrink-0">
            {mode.register}
          </span>
        </div>

        <p className="text-xs leading-relaxed text-ink-soft mb-4 font-normal">
          {mode.description}
        </p>
      </div>

      <div className="pt-3 border-t border-border/70 flex items-center justify-between text-xs font-bold text-accent group-hover:text-brand transition-colors">
        <span className="flex items-center gap-1">
          <span>✎</span>
          <span>تحریر با این لحن</span>
        </span>
        <span className="text-sm opacity-60 group-hover:opacity-100 transition-opacity">
          ←
        </span>
      </div>
    </Link>
  )
}
