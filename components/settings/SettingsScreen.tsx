'use client'

import { useEffect } from 'react'
import { THEMES } from '@/domain/themes'
import { MODEL_SIZE_MB, downloadModel, removeModel, restoreModel } from '@/domain/engines/browser'
import { useModelStatus } from '@/hooks/useModelStatus'
import { applyTheme, useActiveTheme } from '@/hooks/useActiveTheme'
import { Star } from '../Star'

function faNum(n: number): string {
  return n.toLocaleString('fa-IR')
}

export function SettingsScreen() {
  const active = useActiveTheme()
  const model = useModelStatus()

  useEffect(() => {
    restoreModel()
  }, [])

  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-3xl font-black">تنظیمات</h1>
        <p className="mt-2 text-sm leading-7 text-ink-soft">
          پوستهٔ ویراستار و اینکه ویرایش آنلاین باشد یا کاملاً آفلاین.
        </p>
      </header>

      {/* Engine */}
      <section className="space-y-4">
        <h2 className="text-xl font-black">موتور ویرایش</h2>

        <div className="v-card shadow-soft p-5">
          <p className="font-black">ویرایش آنلاین (پیش‌فرض)</p>
          <p className="mt-1 text-xs leading-5 text-ink-soft">
            به‌صورت پیش‌فرض، ویرایش با هوش مصنوعی روی سرور ویراستار انجام می‌شود — بدون نصب،
            بدون کلید و بدون هیچ تنظیمی. متن برای ویرایش به سرور فرستاده می‌شود.
          </p>
        </div>

        <div className="v-card shadow-soft p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-black">مدل محلی گوگل (Gemma) — اختیاری</p>
              <p className="mt-1 text-xs leading-5 text-ink-soft">
                برای ویرایشِ کاملاً آفلاین و خصوصی — بدون اینکه متن از دستگاه خارج شود — این
                مدل کوچک را یک بار نصب کن. بعد از نصب، ویرایش‌ها به‌طور خودکار روی همین دستگاه
                انجام می‌شود.
              </p>
            </div>
            {model.state === 'ready' && (
              <button
                type="button"
                onClick={() => void removeModel()}
                className="v-btn-ghost px-4 py-2 text-sm"
              >
                حذف مدل
              </button>
            )}
          </div>

          {model.state === 'idle' && (
            <div className="mt-4">
              <button
                type="button"
                onClick={() => void downloadModel()}
                className="v-btn-primary mt-3 px-6 py-2.5 text-sm"
              >
                <Star size={16} />
                نصب مدل محلی (حدود {faNum(MODEL_SIZE_MB)} مگابایت)
              </button>
            </div>
          )}

          {model.state === 'downloading' && (
            <div className="mt-4">
              <div className="flex items-center justify-between text-xs font-bold text-ink-soft">
                <span>در حال نصب…</span>
                <span>{faNum(model.progress)}٪</span>
              </div>
              <div
                role="progressbar"
                aria-valuenow={model.progress}
                aria-valuemin={0}
                aria-valuemax={100}
                className="mt-2 h-2 overflow-hidden rounded-full bg-paper-deep"
              >
                <div
                  className="h-full rounded-full bg-brand transition-all"
                  style={{ width: `${model.progress}%` }}
                />
              </div>
              <p className="mt-2 text-xs leading-5 text-ink-soft">
                فقط یک بار — بعد از آن همهٔ ویرایش‌ها آفلاین انجام می‌شود.
              </p>
            </div>
          )}

          {model.state === 'ready' && (
            <p className="mt-4 text-sm leading-7 text-ink-soft">
              مدل آماده است؛ ویرایش‌ها روی همین دستگاه انجام می‌شود، آفلاین و خصوصی.
            </p>
          )}

          {model.state === 'error' && (
            <div className="mt-4">
              <p className="text-sm leading-7 text-ink-soft">
                دانلود ناموفق بود. اتصال اینترنت را بررسی کن و دوباره تلاش کن.
              </p>
              <button
                type="button"
                onClick={() => void downloadModel()}
                className="v-btn-ghost mt-3 px-4 py-2 text-sm"
              >
                تلاش دوباره
              </button>
            </div>
          )}
        </div>
      </section>

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
    </div>
  )
}
