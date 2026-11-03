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
import { useUpdate } from '@/hooks/useUpdate'
import { APP_VERSION, DOWNLOAD, faVersion } from '@/domain/updates'
import { Star } from '../Star'

function faNum(n: number): string {
  return n.toLocaleString('fa-IR')
}

export function SettingsScreen() {
  const active = useActiveTheme()
  const model = useModelStatus()
  const { newer, checked } = useUpdate()
  const [settings, saveSettings] = useSettings()
  const option = MODEL_OPTIONS.find((o) => o.id === modelChoiceFromSettings(settings)) ?? MODEL_OPTIONS[0]
  const localId = option.localModel

  useEffect(() => {
    if (localId) restoreModel(localId)
  }, [localId])

  function handleChoiceChange(value: string) {
    saveSettings(settingsForModelChoice(value, settings))
  }

  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-3xl font-black">تنظیمات</h1>
        <p className="mt-2 text-sm leading-7 text-ink-soft">
          پوستهٔ ویراستار و اینکه ویرایش با کدام مدل هوش مصنوعی یا به صورت آفلاین انجام شود.
        </p>
      </header>

      {/* Engine */}
      <section className="space-y-4">
        <h2 className="text-xl font-black">موتور ویرایش</h2>

        <div className="v-card shadow-soft p-5">
          <label htmlFor="model-choice" className="block font-black">
            مدل و نحوهٔ ویرایش
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

        {option.id === 'online-gemini' && (
          <div className="v-card shadow-soft p-5">
            <p className="font-black text-brand">سرور ابری ویراستار (پیش‌فرض)</p>
            <p className="mt-1 text-xs leading-5 text-ink-soft">
              متن به صورت خودکار از طریق سرور اختصاصی ویراستار با مدل Google Gemini پردازش می‌شود؛ بدون نیاز به هیچ کلید یا تنظیمی.
            </p>
          </div>
        )}

        {option.id === 'online-qwen' && (
          <div className="v-card shadow-soft p-5">
            <p className="font-black text-brand">قوِن آنلاین (Cloudflare Workers AI)</p>
            <p className="mt-1 text-xs leading-5 text-ink-soft">
              متن از طریق سرور رایگان Cloudflare و مدل Qwen 2.5 7B ویرایش می‌شود؛ نیازی به نصب یا کلید ندارد.
            </p>
          </div>
        )}

        {/* Direct Gemini API Key Guide & Input */}
        {(option.id === 'direct-gemini' || settings.geminiApiKey) && (
          <div className="v-card shadow-soft space-y-4 p-5">
            <div className="flex items-center justify-between">
              <span className="font-black text-ink">کلید رایگان Google Gemini API</span>
              <span className="rounded-full bg-brand/10 px-2 py-0.5 text-xs font-bold text-brand">۱۵۰۰ درخواست رایگان در روز</span>
            </div>
            
            <div className="rounded-xl bg-paper-deep p-4 text-xs leading-6 text-ink-soft space-y-1.5 border border-border">
              <p className="font-bold text-ink">نحوه دریافت کلید رایگان (۱ دقیقه زمان می‌برد):</p>
              <p>۱. وارد سایت رسمی <a href="https://aistudio.google.com" target="_blank" rel="noreferrer" className="text-brand underline font-bold">Google AI Studio</a> شوید و با اکانت گوگل خود ورود کنید.</p>
              <p>۲. روی دکمه آبی‌رنگ <strong>«Get API key»</strong> در گوشه بالا کلیک کنید.</p>
              <p>۳. گزینه <strong>«Create API key»</strong> را بزنید و کد نمایش‌داده‌شده را کپی کنید.</p>
              <p>۴. کلید را در کادر زیر وارد کنید. (کاملاً رایگان، بدون نیاز به کارت اعتباری).</p>
            </div>

            <div>
              <label htmlFor="gemini-key" className="block text-xs font-bold text-ink-soft">
                کد کلید API گوگل (Gemini API Key)
              </label>
              <input
                id="gemini-key"
                type="password"
                placeholder="AIzaSy..."
                value={settings.geminiApiKey ?? ''}
                onChange={(e) => saveSettings({ ...settings, geminiApiKey: e.target.value.trim() })}
                className="mt-2 w-full rounded-xl border border-border bg-paper-deep px-4 py-2.5 font-mono text-sm text-ink outline-none focus:ring-2 focus:ring-brand"
              />
              {settings.geminiApiKey && (
                <p className="mt-1.5 text-xs text-success font-bold">✓ کلید ذخیره شد و در ویرایش‌ها مستقیماً استفاده می‌شود.</p>
              )}
            </div>
          </div>
        )}

        {/* Direct Groq API Key Guide & Input */}
        {(option.id === 'direct-groq' || settings.groqApiKey) && (
          <div className="v-card shadow-soft space-y-4 p-5">
            <div className="flex items-center justify-between">
              <span className="font-black text-ink">کلید رایگان Groq (فوق سریع)</span>
              <span className="rounded-full bg-brand/10 px-2 py-0.5 text-xs font-bold text-brand">مدل Qwen 2.5 32B</span>
            </div>
            
            <div className="rounded-xl bg-paper-deep p-4 text-xs leading-6 text-ink-soft space-y-1.5 border border-border">
              <p className="font-bold text-ink">نحوه دریافت کلید رایگان Groq:</p>
              <p>۱. وارد سایت <a href="https://console.groq.com" target="_blank" rel="noreferrer" className="text-brand underline font-bold">Groq Console</a> شوید.</p>
              <p>۲. در منوی سمت چپ به بخش <strong>«API Keys»</strong> رفته و کلید بسازید.</p>
              <p>۳. کلید را در کادر زیر قرار دهید. (سرعت بیش از ۳۰۰ کلمه بر ثانیه با کیفیت عالی فارسی).</p>
            </div>

            <div>
              <label htmlFor="groq-key" className="block text-xs font-bold text-ink-soft">
                کد کلید API گروک (Groq API Key)
              </label>
              <input
                id="groq-key"
                type="password"
                placeholder="gsk_..."
                value={settings.groqApiKey ?? ''}
                onChange={(e) => saveSettings({ ...settings, groqApiKey: e.target.value.trim() })}
                className="mt-2 w-full rounded-xl border border-border bg-paper-deep px-4 py-2.5 font-mono text-sm text-ink outline-none focus:ring-2 focus:ring-brand"
              />
              {settings.groqApiKey && (
                <p className="mt-1.5 text-xs text-success font-bold">✓ کلید ذخیره شد و ویرایش‌ها با سرعت فوق‌العاده انجام می‌شود.</p>
              )}
            </div>
          </div>
        )}

        {/* Local Ollama / Mac Guide & Input */}
        {option.id === 'local-ollama' && (
          <div className="v-card shadow-soft space-y-4 p-5">
            <p className="font-black text-ink">اتصال به مدل آفلاین روی مک (Ollama / LM Studio)</p>
            <div className="rounded-xl bg-paper-deep p-4 text-xs leading-6 text-ink-soft space-y-1.5 border border-border">
              <p className="font-bold text-ink">اجرای ساده در ترمینال مک:</p>
              <code className="block bg-paper px-3 py-2 rounded-lg text-brand font-mono text-xs select-all">
                ollama run qwen2.5:1.5b
              </code>
              <p>به محض اجرای دستور فوق، ویراستار به صورت کاملاً آفلاین و با بیشترین سرعت به مدل متصل خواهد شد.</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="ollama-endpoint" className="block text-xs font-bold text-ink-soft">
                  آدرس سرور محلی
                </label>
                <input
                  id="ollama-endpoint"
                  type="text"
                  value={settings.customEndpoint ?? 'http://localhost:11434/v1'}
                  onChange={(e) => saveSettings({ ...settings, customEndpoint: e.target.value.trim() })}
                  className="mt-2 w-full rounded-xl border border-border bg-paper-deep px-4 py-2 font-mono text-xs text-ink outline-none focus:ring-2 focus:ring-brand"
                />
              </div>
              <div>
                <label htmlFor="ollama-model" className="block text-xs font-bold text-ink-soft">
                  نام مدل (Ollama Model Name)
                </label>
                <input
                  id="ollama-model"
                  type="text"
                  value={settings.customModel ?? 'qwen2.5:1.5b'}
                  onChange={(e) => saveSettings({ ...settings, customModel: e.target.value.trim() })}
                  className="mt-2 w-full rounded-xl border border-border bg-paper-deep px-4 py-2 font-mono text-xs text-ink outline-none focus:ring-2 focus:ring-brand"
                />
              </div>
            </div>
          </div>
        )}

        {option.kind === 'rules' && (
          <div className="v-card shadow-soft p-5">
            <p className="font-black">بدون هوش مصنوعی</p>
            <p className="mt-1 text-xs leading-5 text-ink-soft">
              ویرایش فقط با قواعد دستوری، اصلاح نیم‌فاصله‌ها و غلط‌های املایی فارسی انجام می‌شود؛ هیچ داده‌ای از دستگاه خارج نمی‌شود.
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

      {/* About — the only place this copy says how old it is. */}
      <section>
        <h2 className="mb-3 text-xl font-black">درباره</h2>
        <div className="v-card shadow-soft p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-black">ویراستار</p>
              <p className="mt-1 text-xs leading-5 text-ink-soft">
                نسخهٔ {faVersion(APP_VERSION)}
                {newer && <> — نسخهٔ {faVersion(newer)} منتشر شده است.</>}
                {!newer && checked && <> — همین تازه‌ترین نسخه است.</>}
              </p>
            </div>
            {newer && (
              <a
                href={DOWNLOAD}
                target="_blank"
                rel="noreferrer"
                className="v-btn-primary px-6 py-2.5 text-sm"
              >
                <Star size={16} />
                دریافت نسخهٔ {faVersion(newer)}
              </a>
            )}
          </div>
          <div className="mt-4 pt-4 border-t border-border flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-ink-soft">
            <span className="flex items-center gap-1.5">
              <Star size={12} className="text-brand" />
              ساخته‌شده با ❤️ توسط مراد (Made by Morad)
            </span>
            <span>ابزار نگارش، بازنویسی و ویرایش زبان فارسی</span>
          </div>
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
