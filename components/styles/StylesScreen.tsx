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
      {/* Neo-Brutalist Strip Header */}
      <header className="border-b-4 border-black pb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-none border-2 border-black bg-emphasis text-black text-xs font-black shadow-[2px_2px_0px_#000] uppercase mb-4">
          <Star size={13} className="text-signal fill-signal" />
          <span>قلم‌دان ۱۳ لحن و آوای زبان فارسی</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-black text-ink tracking-tight uppercase leading-tight">
          جُنگ و نگارخانهٔ سبک‌های نگارش
        </h1>
        <p className="mt-3 max-w-2xl text-sm sm:text-base leading-7 text-ink font-bold">
          هر سبک در ویراستار، یک لحنِ زنده با ساختار نحوی و واژگان گزیده است. ویراستار بدون گم کردن معنای اصلی شما، جامهٔ واژه‌ها را با دقت دگرگون می‌کند.
        </p>
      </header>

      {SECTIONS.map((sec) => {
        const modes = MODES.filter((m) => sec.modeIds.includes(m.id))
        return (
          <section key={sec.title} className="space-y-5">
            {/* Ruled Ledger Section Header */}
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b-4 border-black pb-3">
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-ink flex items-center gap-2">
                  <span className="text-2xl">{sec.icon}</span>
                  <span>{sec.title}</span>
                </h2>
                <p className="text-xs sm:text-sm text-ink-soft mt-1 font-bold">{sec.tagline}</p>
              </div>
              <span className="rounded-none border-2 border-black bg-white px-2.5 py-0.5 text-xs font-black shadow-[2px_2px_0px_#000]">
                {modes.length.toLocaleString('fa-IR')} لحن تخصصی
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
      className="rounded-none border-4 border-black bg-white shadow-[5px_5px_0px_#000] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[8px_8px_0px_#000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0px_#000] transition-none p-5 flex flex-col justify-between group cursor-pointer"
    >
      <div>
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-none border-3 border-black bg-emphasis text-black shadow-[2px_2px_0px_#000] group-hover:bg-signal group-hover:text-white transition-none">
              <ModeGlyph modeId={mode.id} size={22} />
            </span>
            <div>
              <h3 className="text-base font-black text-ink leading-tight">{mode.label}</h3>
              <p className="text-[11px] font-bold text-ink-soft">{mode.tagline}</p>
            </div>
          </div>

          <span className="rounded-none border-2 border-black bg-field text-black text-[10px] font-black px-2 py-0.5 shadow-[1px_1px_0px_#000] shrink-0">
            {mode.register}
          </span>
        </div>

        <p className="text-xs leading-6 text-black/85 font-medium mb-4">
          {mode.description}
        </p>
      </div>

      <div className="pt-3 border-t-3 border-black flex items-center justify-between text-xs font-black text-black">
        <span className="flex items-center gap-1.5 group-hover:translate-x-[-2px] transition-transform">
          <Star size={13} className="text-signal fill-signal" />
          <span>تحریر با این لحن</span>
        </span>
        <span className="flex h-7 w-7 items-center justify-center rounded-none border-2 border-black bg-signal text-white font-black text-sm shadow-[2px_2px_0px_#000] group-hover:bg-black group-hover:text-emphasis transition-none">
          ←
        </span>
      </div>
    </Link>
  )
}
