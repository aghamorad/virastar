'use client'

import { useEffect } from 'react'
import { THEMES } from '@/domain/themes'
import {
  MODEL_OPTIONS,
  modelChoiceFromSettings,
  settingsForModelChoice,
  type ModelOption,
} from '@/domain/engine'
import {
  LOCAL_MODELS,
  downloadModel,
  removeModel,
  restoreModel,
  wasModelInstalled,
} from '@/domain/engines/browser'
import { useModelStatus } from '@/hooks/useModelStatus'
import { useSettings } from '@/hooks/useSettings'
import { applyTheme, useActiveTheme } from '@/hooks/useActiveTheme'
import { Star } from '../Star'

function faNum(n: number): string {
  return n.toLocaleString('fa-IR')
}

export function SettingsScreen() {
  const active = useActiveTheme()
  const model = useModelStatus()
  const [settings, saveSettings] = useSettings()
  const option = MODEL_OPTIONS.find((o) => o.id === modelChoiceFromSettings(settings)) ?? MODEL_OPTIONS[0]
  const localId = option.localModel

  useEffect(() => {
    if (localId) restoreModel(localId)
  }, [localId])

  function handleChoiceChange(value: string) {
    saveSettings(settingsForModelChoice(value, settings.endpoint))
  }

  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-3xl font-black">تنظیمات</h1>
        <p className="mt-2 text-sm leading-7 text-ink-soft">
          پوستهٔ ویراستار و اینکه ویرایش با کدام مدل هوش مصنوعی انجام شود.
        </p>
      </header>

      {/* Engine */}
      <section className="space-y-4">
        <h2 className="text-xl font-black">موتور ویرایش</h2>

        <div className="v-card shadow-soft p-5">
          <label htmlFor="model-choice" className="block font-black">
            مدل ویرایش
          </label>
          <select
            id="model-choice"
            value={option.id}
            onChange={(e) => handleChoiceChange(e.target.value)}
            className="mt-3 w-full rounded-xl border border-border bg-paper-deep px-4 py-3 text-base font-bold text-ink outline-none focus:ring-2 focus:ring-brand"
          >
            {MODEL_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
          <p className="mt-3 text-sm leading-7 text-ink-soft">{option.description}</p>
        </div>

        {option.kind === 'online' && (
          <div className="v-card shadow-soft p-5">
            <p className="font-black">بدون نصب</p>
            <p className="mt-1 text-xs leading-5 text-ink-soft">
              همین الان آماده است. متن برای ویرایش به سرور ویراستار فرستاده می‌شود و با
              {option.id === 'online-qwen' ? ' قوِن ' : ' گوگل‌جمینی '}
              ویرایش برمی‌گردد — بدون نصب، بدون کلید و بدون هیچ تنظیمی.
            </p>
          </div>
        )}

        {option.kind === 'rules' && (
          <div className="v-card shadow-soft p-5">
            <p className="font-black">بدون هوش مصنوعی</p>
            <p className="mt-1 text-xs leading-5 text-ink-soft">
              ویرایش فقط با قواعد نوشتاری فارسی انجام می‌شود؛ هیچ درخواستی به سرور نمی‌رود
              و هیچ داده‌ای از دستگاه خارج نمی‌شود.
            </p>
          </div>
        )}

        {option.kind === 'local' && localId && (
          <LocalModelCard
            option={option}
            modelState={model.state}
            modelId={model.modelId}
            progress={model.progress}
            onDownload={() => void downloadModel(localId)}
            onRemove={() => void removeModel(localId)}
          />
        )}
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

function LocalModelCard({
  option,
  modelState,
  modelId,
  progress,
  onDownload,
  onRemove,
}: {
  option: ModelOption
  modelState: string
  modelId?: string
  progress: number
  onDownload: () => void
  onRemove: () => void
}) {
  const localId = option.localModel!
  const sizeMB = LOCAL_MODELS[localId].sizeMB
  const thisReady = modelState === 'ready' && modelId === localId
  const thisDownloading = modelState === 'downloading'
  const thisError = modelState === 'error'
  const installed = wasModelInstalled(localId)

  return (
    <div className="v-card shadow-soft p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-black">دانلود روی همین دستگاه — آفلاین و خصوصی</p>
          <p className="mt-1 text-xs leading-5 text-ink-soft">
            این مدل را یک بار نصب کن (حدود {faNum(sizeMB)} مگابایت)؛ بعد از آن، ویرایش‌ها
            بدون اینترنت و بدون اینکه متن از دستگاه خارج شود انجام می‌شود.
          </p>
        </div>
        {thisReady && (
          <button type="button" onClick={onRemove} className="v-btn-ghost px-4 py-2 text-sm">
            حذف مدل
          </button>
        )}
      </div>

      {!thisReady && !thisDownloading && !thisError && !installed && (
        <button type="button" onClick={onDownload} className="v-btn-primary mt-4 px-6 py-2.5 text-sm">
          <Star size={16} />
          نصب مدل محلی (حدود {faNum(sizeMB)} مگابایت)
        </button>
      )}

      {thisDownloading && (
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs font-bold text-ink-soft">
            <span>در حال نصب…</span>
            <span>{faNum(progress)}٪</span>
          </div>
          <div
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            className="mt-2 h-2 overflow-hidden rounded-full bg-paper-deep"
          >
            <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-2 text-xs leading-5 text-ink-soft">فقط یک بار — بعد از آن همهٔ ویرایش‌ها آفلاین انجام می‌شود.</p>
        </div>
      )}

      {thisReady && (
        <p className="mt-4 text-sm leading-7 text-ink-soft">
          مدل آماده است؛ ویرایش‌ها روی همین دستگاه انجام می‌شود، آفلاین و خصوصی.
        </p>
      )}

      {thisError && (
        <div className="mt-4">
          <p className="text-sm leading-7 text-ink-soft">
            دانلود ناموفق بود. اتصال اینترنت را بررسی کن و دوباره تلاش کن.
          </p>
          <button type="button" onClick={onDownload} className="v-btn-ghost mt-3 px-4 py-2 text-sm">
            تلاش دوباره
          </button>
        </div>
      )}
    </div>
  )
}
