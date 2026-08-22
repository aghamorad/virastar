import Link from 'next/link'
import { Star } from '../Star'
import { HistoryGlyph, SettingsGlyph, StylesGlyph } from '../Glyphs'

const QUICK = [
  { href: '/history', label: 'نوشته‌های من', icon: HistoryGlyph },
  { href: '/styles', label: 'سبک‌ها', icon: StylesGlyph },
  { href: '/settings', label: 'تنظیمات', icon: SettingsGlyph },
]

export function HomeScreen() {
  return (
    <div className="relative flex min-h-[calc(100dvh-3.5rem)] flex-col items-center justify-center overflow-hidden py-16 text-center">
      {/* The watermark — a slow-turning star behind everything. */}
      <div className="animate-star-turn pointer-events-none absolute -start-24 top-1/2 -translate-y-1/2 text-brand opacity-[0.07]">
        <Star size={520} hollow />
      </div>

      <div className="animate-fade-up relative flex flex-col items-center">
        <div className="animate-star-breathe mb-6 text-brand">
          <Star size={72} />
        </div>

        <h1 className="text-6xl font-black leading-tight tracking-tight md:text-7xl">
          ویراستار
        </h1>
        <p className="mt-4 text-xl font-bold text-ink-soft md:text-2xl">بهتر بنویس، بهتر بگو</p>

        <p className="mt-3 max-w-md text-sm leading-7 text-ink-soft/90">
          نوشته‌ات را بنویس؛ ویراستار بهترش می‌کند. اصلاح، تغییر لحن، یا بازنویسی کامل — مثل یک
          ویراستارِ حرفه‌ای، نه یک چت‌بات.
        </p>

        <Link
          href="/edit"
          className="v-btn-primary mt-10 px-12 py-4 text-lg shadow-card"
        >
          متن جدید
        </Link>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          {QUICK.map((q) => (
            <Link key={q.href} href={q.href} className="v-btn-ghost">
              <q.icon size={18} className="text-brand" />
              {q.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
