'use client'

import { THEMES } from '@/domain/themes'
import type { EngineSettings } from '@/domain/engine'
import { useSettings } from '@/hooks/useSettings'
import { applyTheme, useActiveTheme } from '@/hooks/useActiveTheme'
import { Star } from '../Star'

export function SettingsScreen() {
  const active = useActiveTheme()
  const [settings, save] = useSettings()

  function setEngine(patch: Partial<EngineSettings>) {
    save({ ...settings, ...patch })
  }

  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-3xl font-black">تنظیمات</h1>
        <p className="mt-2 text-sm leading-7 text-ink-soft">
          پوستهٔ ویراستار و موتوری که ویرایش را انجام می‌دهد.
        </p>
      </header>

      {/* Themes */}
      <section>
        <h2 className="mb-3 text-xl font-black">پوسته</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {THEMES.map((t) => {
            const isActive = t.id === active
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => applyTheme(t.id)}
                aria-pressed={isActive}
                className={`v-card shadow-soft flex items-start gap-3 p-4 text-start transition-all ${
                  isActive ? 'ring-2 ring-brand' : 'hover:-translate-y-0.5'
                }`}
              >
                <Star size={22} className={`mt-0.5 shrink-0 ${isActive ? 'text-brand' : 'text-ink-soft'}`} />
                <span>
                  <span className="block font-black">{t.label}</span>
                  <span className="mt-1 block text-xs leading-5 text-ink-soft">{t.blurb}</span>
                </span>
              </button>
            )
          })}
        </div>
      </section>

      {/* Engine */}
      <section className="space-y-4">
        <h2 className="text-xl font-black">موتور ویرایش</h2>

        <div className="v-card shadow-soft p-5">
          <div className="flex gap-3">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="engine"
                checked={settings.engine === 'offline'}
                onChange={() => setEngine({ engine: 'offline' })}
                className="h-4 w-4 accent-brand"
              />
              <span className="font-extrabold">آفلاین</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="engine"
                checked={settings.engine === 'online'}
                onChange={() => setEngine({ engine: 'online' })}
                className="h-4 w-4 accent-brand"
              />
              <span className="font-extrabold">آنلاین</span>
            </label>
          </div>

          {settings.engine === 'offline' ? (
            <p className="mt-3 text-sm leading-7 text-ink-soft">
              موتور آفلاین روی همین دستگاه کار می‌کند: اصلاح و نیم‌فاصله، و تغییر لحن با واژه‌نامه.
              بدون اینترنت و با حریم خصوصی کامل. برای بازنویسی واقعی، موتور آنلاین را وصل کن.
            </p>
          ) : (
            <p className="mt-3 text-sm leading-7 text-ink-soft">
              موتور آنلاین یک مدل زبان واقعی (Qwen یا Gemma) را به کار می‌گیرد و واقعاً بازنویسی
              می‌کند. پیش‌فرض آن مدل محلی اولاما روی همین دستگاه است — متن هیچ‌وقت از کامپیوترت
              خارج نمی‌شود. هر سرویس دیگری که با
              <span dir="ltr" className="mx-1 font-bold">chat/completions</span>
              سازگار باشد هم کار می‌کند. اگر سرویس در دسترس نباشد، ویراستار خودش به موتور آفلاین
              برمی‌گردد.
            </p>
          )}

          <div className="mt-4 space-y-3">
            <label className="block">
              <span className="mb-1 block text-xs font-black text-ink-soft">آدرس سرویس</span>
              <input
                type="text"
                dir="ltr"
                placeholder="https://…/v1/chat/completions"
                value={settings.endpoint}
                onChange={(e) => setEngine({ endpoint: e.target.value })}
                className="v-field py-2.5 text-left font-mono text-sm"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-black text-ink-soft">نام مدل</span>
              <input
                type="text"
                dir="ltr"
                placeholder="gemma2:9b"
                value={settings.model}
                onChange={(e) => setEngine({ model: e.target.value })}
                className="v-field py-2.5 text-left font-mono text-sm"
              />
            </label>
          </div>
        </div>
      </section>
    </div>
  )
}
