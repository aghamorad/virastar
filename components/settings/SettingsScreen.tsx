'use client'

import { useEffect, useState } from 'react'
import { THEMES } from '@/domain/themes'
import {
  HOSTED_ENDPOINT,
  MODEL_OPTIONS,
  modelChoiceFromSettings,
  settingsForModelChoice,
  type EngineSettings,
  type ModelOption,
} from '@/domain/engine'
import {
  LOCAL_MODELS,
  downloadModel,
  removeModel,
  restoreModel,
  wasModelInstalled,
  type LocalModelId,
  type ModelStatus,
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

  const [testStatus, setTestStatus] = useState<{
    type: 'gemini' | 'groq' | 'worker'
    state: 'testing' | 'success' | 'error'
    message: string
  } | null>(null)

  async function pasteFromClipboard(onPaste: (text: string) => void) {
    try {
      const text = await navigator.clipboard.readText()
      if (text && text.trim()) onPaste(text.trim())
    } catch (err) {
      console.warn('Clipboard read error:', err)
    }
  }

  async function testGeminiKey(key: string) {
    if (!key.trim()) return
    setTestStatus({ type: 'gemini', state: 'testing', message: 'در حال بررسی اعتبار کلید گوگل…' })
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${key.trim()}`,
      )
      if (res.ok) {
        setTestStatus({
          type: 'gemini',
          state: 'success',
          message: '✓ کلید گوگل معتبر است! روزانه تا ۱۵۰۰ ویرایش رایگان برای شما فعال است.',
        })
      } else {
        setTestStatus({
          type: 'gemini',
          state: 'error',
          message: `خطای سرور گوگل (${res.status})؛ لطفاً کد کلید را مجدداً بررسی کنید.`,
        })
      }
    } catch {
      setTestStatus({
        type: 'gemini',
        state: 'error',
        message: 'عدم دسترسی به سرور گوگل؛ لطفاً اتصال اینترنت خود را چک کنید.',
      })
    }
  }

  async function testGroqKey(key: string) {
    if (!key.trim()) return
    setTestStatus({ type: 'groq', state: 'testing', message: 'در حال بررسی کلید گروک…' })
    try {
      const res = await fetch('https://api.groq.com/openai/v1/models', {
        headers: { Authorization: `Bearer ${key.trim()}` },
      })
      if (res.ok) {
        setTestStatus({
          type: 'groq',
          state: 'success',
          message: '✓ کلید Groq معتبر است! سرعت فوق‌سریع ۳۰۰ کلمه بر ثانیه فعال شد.',
        })
      } else {
        setTestStatus({
          type: 'groq',
          state: 'error',
          message: `خطای گروک (${res.status})؛ لطفاً کد کلید را مجدداً بررسی کنید.`,
        })
      }
    } catch {
      setTestStatus({
        type: 'groq',
        state: 'error',
        message: 'عدم دسترسی به سرور Groq؛ لطفاً اتصال اینترنت را چک کنید.',
      })
    }
  }

  async function testWorkerUrl(url: string) {
    const ep = url.trim().replace(/\/+$/, '')
    if (!ep) return
    setTestStatus({ type: 'worker', state: 'testing', message: 'در حال ارسال درخواست آزمایشی به سرور…' })
    try {
      const res = await fetch(ep, { method: 'OPTIONS' }).catch(() => null)
      if (res && (res.ok || res.status === 204 || res.status === 405 || res.status === 200)) {
        setTestStatus({
          type: 'worker',
          state: 'success',
          message: '✓ اتصال به سرور کلودفلر با موفقیت برقرار شد! سرور اختصاصی شما آماده است.',
        })
      } else {
        const postRes = await fetch(ep, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        }).catch(() => null)
        if (postRes && postRes.status < 500) {
          setTestStatus({
            type: 'worker',
            state: 'success',
            message: '✓ سرور کلودفلر فعال و پاسخگو است! آماده ویرایش متون.',
          })
        } else {
          setTestStatus({
            type: 'worker',
            state: 'error',
            message: 'سرور در دسترس نبود یا آدرس وارد شده نادرست است.',
          })
        }
      }
    } catch {
      setTestStatus({
        type: 'worker',
        state: 'error',
        message: 'خطا در برقراری ارتباط با سرور؛ لطفاً آدرس را بررسی کنید.',
      })
    }
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

        {/* Custom Cloudflare Worker (1-Click Deploy) */}
        {option.id === 'custom-worker' && (
          <div className="v-card shadow-soft space-y-4 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-black text-ink text-base">سرور اختصاصی Cloudflare شما (کاملاً رایگان)</span>
              <span className="rounded-full bg-orange-500/10 px-2.5 py-0.5 text-xs font-bold text-orange-600">
                بدون نیاز به کدنویسی (۱ کلیک)
              </span>
            </div>

            <p className="text-xs leading-6 text-ink-soft">
              با ساخت سرور ابری اختصاصی، شما یک شعبهٔ مستقل از ویراستار روی سرورهای جهانی Cloudflare خواهید داشت که نامحدود، پرسرعت و رایگان است و ظرفیت پردازش آن با هیچ کاربر دیگری به اشتراک گذاشته نمی‌شود.
            </p>

            <a
              href="https://deploy.workers.cloudflare.com/?url=https://github.com/aghamorad/virastar/tree/main/worker"
              target="_blank"
              rel="noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-600 px-4 py-3 text-sm font-bold text-white shadow-sm transition-all hover:bg-orange-700 active:scale-[0.99]"
            >
              <Star size={16} />
              <span>🌐 ۱. ساخت و راه‌اندازی سرور در Cloudflare (با ۱ کلیک)</span>
            </a>

            <div className="rounded-xl bg-paper-deep p-4 text-xs leading-6 text-ink-soft space-y-2 border border-border">
              <p className="font-bold text-ink">مراحل ساده ساخت سرور (حتی برای افراد غیرفنی):</p>
              <p>۱. روی دکمه نارنجی بالا بزنید تا صفحه رسمی Cloudflare باز شود و با ایمیل یا حساب گوگل خود وارد شوید.</p>
              <p>۲. در صفحه بازشده، روی دکمه آبی‌رنگ <strong>«Deploy»</strong> بزنید. کلودفلر ظرف ۲۰ ثانیه سرور رایگان شما را می‌سازد.</p>
              <p>۳. آدرس سرور ساخته‌شده (مانند <code className="bg-paper px-1.5 py-0.5 rounded text-brand font-mono">https://virastar-edit.yourname.workers.dev</code>) را کپی کرده و در کادر زیر قرار دهید.</p>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="custom-worker-url" className="block text-xs font-bold text-ink-soft">
                  آدرس سرور اختصاصی شما
                </label>
                {settings.endpoint !== HOSTED_ENDPOINT && (
                  <button
                    type="button"
                    onClick={() => {
                      saveSettings({ ...settings, endpoint: HOSTED_ENDPOINT })
                      setTestStatus(null)
                    }}
                    className="text-xs font-bold text-brand hover:underline"
                  >
                    بازنشانی به سرور پیش‌فرض ویراستار
                  </button>
                )}
              </div>

              <div className="mt-2 flex flex-col sm:flex-row gap-2">
                <input
                  id="custom-worker-url"
                  type="url"
                  placeholder="https://virastar-edit.yourname.workers.dev"
                  value={settings.endpoint}
                  onChange={(e) => {
                    saveSettings({ ...settings, endpoint: e.target.value.trim() })
                    setTestStatus(null)
                  }}
                  className="flex-1 rounded-xl border border-border bg-paper-deep px-4 py-2.5 font-mono text-xs text-ink outline-none focus:ring-2 focus:ring-brand"
                />

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      void pasteFromClipboard((val) => {
                        saveSettings({ ...settings, endpoint: val })
                        void testWorkerUrl(val)
                      })
                    }
                    className="v-btn-secondary px-3 py-2 text-xs font-bold whitespace-nowrap"
                    title="چسباندن آدرس کپی‌شده از حافظه"
                  >
                    📋 چسباندن از حافظه
                  </button>

                  <button
                    type="button"
                    onClick={() => void testWorkerUrl(settings.endpoint)}
                    className="v-btn-primary px-3 py-2 text-xs font-bold whitespace-nowrap"
                  >
                    ⚡ آزمایش اتصال
                  </button>
                </div>
              </div>

              {testStatus?.type === 'worker' && (
                <div
                  className={`mt-2 rounded-xl p-3 text-xs font-bold border ${
                    testStatus.state === 'success'
                      ? 'bg-success/10 border-success/30 text-success'
                      : testStatus.state === 'testing'
                      ? 'bg-brand/10 border-brand/30 text-brand'
                      : 'bg-red-500/10 border-red-500/30 text-red-600'
                  }`}
                >
                  {testStatus.message}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Direct Gemini API Key Guide & Input */}
        {(option.id === 'direct-gemini' || settings.geminiApiKey) && (
          <div className="v-card shadow-soft space-y-4 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-black text-ink text-base">کلید رایگان Google Gemini API</span>
              <span className="rounded-full bg-brand/10 px-2.5 py-0.5 text-xs font-bold text-brand">
                ۱۵۰۰ درخواست رایگان در روز
              </span>
            </div>

            <p className="text-xs leading-6 text-ink-soft">
              گوگل برای هر حساب کاربری جیمیل، سهمیه روزانه ۱۵۰۰ ویرایش رایگان با بهترین کیفیت و هوش مصنوعی فارسی قرار داده است.
            </p>

            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3 text-sm font-bold text-on-brand shadow-sm transition-all hover:bg-brand-deep active:scale-[0.99]"
            >
              <Star size={16} />
              <span>🌐 ۱. باز کردن صفحه دریافت کلید رایگان گوگل (۱ کلیک)</span>
            </a>

            <div className="rounded-xl bg-paper-deep p-4 text-xs leading-6 text-ink-soft space-y-2 border border-border">
              <p className="font-bold text-ink">مراحل دریافت کلید (کمتر از ۱ دقیقه):</p>
              <p>۱. روی دکمه بالا بزنید تا سایت رسمی گوگل باز شود و با ایمیل خود وارد شوید.</p>
              <p>۲. روی دکمه آبی‌رنگ <strong>«Create API key»</strong> بزنید و کد کلید را کپی کنید.</p>
              <p>۳. به این صفحه بازگردید و روی دکمه <strong>«چسباندن از حافظه»</strong> بزنید. تمام!</p>
            </div>

            <div>
              <label htmlFor="gemini-key" className="block text-xs font-bold text-ink-soft">
                کد کلید API گوگل (Gemini API Key)
              </label>

              <div className="mt-2 flex flex-col sm:flex-row gap-2">
                <input
                  id="gemini-key"
                  type="password"
                  placeholder="AIzaSy..."
                  value={settings.geminiApiKey ?? ''}
                  onChange={(e) => {
                    saveSettings({ ...settings, geminiApiKey: e.target.value.trim() })
                    setTestStatus(null)
                  }}
                  className="flex-1 rounded-xl border border-border bg-paper-deep px-4 py-2.5 font-mono text-xs text-ink outline-none focus:ring-2 focus:ring-brand"
                />

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      void pasteFromClipboard((val) => {
                        saveSettings({ ...settings, geminiApiKey: val })
                        void testGeminiKey(val)
                      })
                    }
                    className="v-btn-secondary px-3 py-2 text-xs font-bold whitespace-nowrap"
                    title="چسباندن کلید از حافظه گوشی یا مک"
                  >
                    📋 چسباندن از حافظه
                  </button>

                  <button
                    type="button"
                    onClick={() => void testGeminiKey(settings.geminiApiKey ?? '')}
                    disabled={!settings.geminiApiKey}
                    className="v-btn-primary px-3 py-2 text-xs font-bold whitespace-nowrap disabled:opacity-50"
                  >
                    ⚡ آزمایش کلید
                  </button>
                </div>
              </div>

              {testStatus?.type === 'gemini' && (
                <div
                  className={`mt-2 rounded-xl p-3 text-xs font-bold border ${
                    testStatus.state === 'success'
                      ? 'bg-success/10 border-success/30 text-success'
                      : testStatus.state === 'testing'
                      ? 'bg-brand/10 border-brand/30 text-brand'
                      : 'bg-red-500/10 border-red-500/30 text-red-600'
                  }`}
                >
                  {testStatus.message}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Direct Groq API Key Guide & Input */}
        {(option.id === 'direct-groq' || settings.groqApiKey) && (
          <div className="v-card shadow-soft space-y-4 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-black text-ink text-base">کلید رایگان Groq (فوق‌سریع)</span>
              <span className="rounded-full bg-brand/10 px-2.5 py-0.5 text-xs font-bold text-brand">
                مدل Qwen 2.5 32B (۳۰۰ کلمه بر ثانیه)
              </span>
            </div>

            <p className="text-xs leading-6 text-ink-soft">
              سرویس Groq سریع‌ترین پردازشگر ابری جهان است که مدل قدرتمند Qwen 2.5 را به رایگان و بدون تأخیر در اختیار شما می‌گذارد.
            </p>

            <a
              href="https://console.groq.com/keys"
              target="_blank"
              rel="noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-ink text-paper font-bold px-4 py-3 text-sm shadow-sm transition-all hover:bg-ink/80 active:scale-[0.99]"
            >
              <Star size={16} />
              <span>🌐 ۱. باز کردن صفحه دریافت کلید Groq (۱ کلیک)</span>
            </a>

            <div className="rounded-xl bg-paper-deep p-4 text-xs leading-6 text-ink-soft space-y-2 border border-border">
              <p className="font-bold text-ink">مراحل دریافت کلید Groq:</p>
              <p>۱. روی دکمه مشکی بالا بزنید تا وارد سایت Groq شوید.</p>
              <p>۲. دکمه <strong>«Create API Key»</strong> را بزنید و کلید ساخته‌شده را کپی کنید.</p>
              <p>۳. در این صفحه دکمه <strong>«چسباندن از حافظه»</strong> را بزنید.</p>
            </div>

            <div>
              <label htmlFor="groq-key" className="block text-xs font-bold text-ink-soft">
                کد کلید API گروک (Groq API Key)
              </label>

              <div className="mt-2 flex flex-col sm:flex-row gap-2">
                <input
                  id="groq-key"
                  type="password"
                  placeholder="gsk_..."
                  value={settings.groqApiKey ?? ''}
                  onChange={(e) => {
                    saveSettings({ ...settings, groqApiKey: e.target.value.trim() })
                    setTestStatus(null)
                  }}
                  className="flex-1 rounded-xl border border-border bg-paper-deep px-4 py-2.5 font-mono text-xs text-ink outline-none focus:ring-2 focus:ring-brand"
                />

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      void pasteFromClipboard((val) => {
                        saveSettings({ ...settings, groqApiKey: val })
                        void testGroqKey(val)
                      })
                    }
                    className="v-btn-secondary px-3 py-2 text-xs font-bold whitespace-nowrap"
                    title="چسباندن کلید از حافظه"
                  >
                    📋 چسباندن از حافظه
                  </button>

                  <button
                    type="button"
                    onClick={() => void testGroqKey(settings.groqApiKey ?? '')}
                    disabled={!settings.groqApiKey}
                    className="v-btn-primary px-3 py-2 text-xs font-bold whitespace-nowrap disabled:opacity-50"
                  >
                    ⚡ آزمایش کلید
                  </button>
                </div>
              </div>

              {testStatus?.type === 'groq' && (
                <div
                  className={`mt-2 rounded-xl p-3 text-xs font-bold border ${
                    testStatus.state === 'success'
                      ? 'bg-success/10 border-success/30 text-success'
                      : testStatus.state === 'testing'
                      ? 'bg-brand/10 border-brand/30 text-brand'
                      : 'bg-red-500/10 border-red-500/30 text-red-600'
                  }`}
                >
                  {testStatus.message}
                </div>
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
      </section>

      {/* Dedicated Offline Models Download Hub */}
      <OfflineModelsSection
        settings={settings}
        saveSettings={saveSettings}
        modelStatus={model}
      />

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

function OfflineModelsSection({
  settings,
  saveSettings,
  modelStatus,
}: {
  settings: EngineSettings
  saveSettings: (next: EngineSettings) => void
  modelStatus: ModelStatus
}) {
  const localModelsList: Array<{
    id: LocalModelId
    name: string
    size: string
    badge: string
    recommendation: string
    bestFor: string
    ram: string
  }> = [
    {
      id: 'qwen-0.5b',
      name: 'قوِن ۰.۵B فوق‌سبک (Qwen 2.5 0.5B)',
      size: '۳۸۰ مگابایت',
      badge: 'ویژه تمام گوشی‌ها',
      recommendation: 'سبک‌ترین مدل؛ سازگار با مرورگر همه آیفون‌ها و گوشی‌های اندروید بدون پر شدن رم یا بسته شدن تب.',
      bestFor: 'غلط‌گیری املایی، رفع ایرادات تایپی، ویرگول، نیم‌فاصله و نشانه‌گذاری',
      ram: 'حداقل ۲ گیگابایت رم (تمام موبایل‌ها)',
    },
    {
      id: 'qwen-1.5b',
      name: 'قوِن ۱.۵B استاندارد (Qwen 2.5 1.5B)',
      size: '۱.۰ گیگابایت',
      badge: 'پیشنهادی (موبایل قوی و لپ‌تاپ)',
      recommendation: 'بهترین تعادل سرعت و کیفیت؛ درک قوی گرامر و ساختار اداری و رسمی.',
      bestFor: 'بازنویسی ایمیل، نامه‌های اداری، نامه‌های دانشگاهی و متون رسمی',
      ram: 'حداقل ۴ گیگابایت رم',
    },
    {
      id: 'qwen-3b',
      name: 'قوِن ۳B پیشرفته (Qwen 2.5 3B)',
      size: '۱.۸ گیگابایت',
      badge: 'حرفه‌ای (آیپد و مک)',
      recommendation: 'بالاترین دایره واژگان؛ توانایی بازنویسی سبک‌های پیچیده، طنز و ادبی.',
      bestFor: 'سبک‌های دیوانی قدیم، حقوقی، لاتی، طنز و شعر',
      ram: 'حداقل ۶ تا ۸ گیگابایت رم (آیپد پرو و مک)',
    },
  ]

  return (
    <section className="space-y-4">
      <div>
        <div className="flex items-center gap-2">
          <Star size={20} className="text-brand" />
          <h2 className="text-xl font-black">مرکز دانلود مدل‌های آفلاین</h2>
        </div>
        <p className="mt-1 text-xs leading-6 text-ink-soft">
          مدل‌های زیر مستقیماً داخل حافظه مرورگر دستگاه شما دانلود و ذخیره می‌شوند. پس از یک‌بار دانلود، تمام ویرایش‌ها کاملاً آفلاین، بدون اینترنت و با حریم خصوصی ۱۰۰٪ انجام می‌گردد.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-1">
        {localModelsList.map((m) => {
          const isSelected = settings.localModel === m.id
          const isInstalled = wasModelInstalled(m.id)
          const isDownloadingThis = modelStatus.state === 'downloading' && modelStatus.modelId === m.id
          const isReadyThis = modelStatus.state === 'ready' && modelStatus.modelId === m.id

          return (
            <div
              key={m.id}
              className={`v-card shadow-soft p-5 transition-all ${
                isSelected ? 'ring-2 ring-brand bg-brand/5' : ''
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-black text-base text-ink">{m.name}</span>
                    <span className="rounded-full bg-brand/10 px-2 py-0.5 text-xs font-bold text-brand">
                      {m.badge}
                    </span>
                    <span className="rounded-full bg-paper-deep px-2.5 py-0.5 text-xs font-bold text-ink-soft border border-border">
                      حجم: {m.size}
                    </span>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-ink-soft">{m.recommendation}</p>
                  <p className="mt-1.5 text-xs leading-5 text-ink/90 font-bold">
                    🎯 کاربرد بهینه: <span className="font-normal text-ink-soft">{m.bestFor}</span>
                  </p>
                  <p className="text-[11px] text-ink-soft/70">
                    💾 سخت‌افزار مورد نیاز: {m.ram}
                  </p>
                </div>
              </div>

              {isDownloadingThis && (
                <div className="mt-4 rounded-xl bg-paper-deep p-3 border border-border">
                  <div className="flex items-center justify-between text-xs font-bold text-ink">
                    <span className="flex items-center gap-1.5">
                      <Star size={13} className="animate-star-busy text-brand" />
                      در حال دریافت مدل در حافظه دستگاه…
                    </span>
                    <span className="font-mono">{faNum(modelStatus.progress)}٪</span>
                  </div>
                  <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-paper border border-border">
                    <div
                      className="h-full rounded-full bg-brand transition-all duration-300"
                      style={{ width: `${modelStatus.progress}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
                <div className="flex items-center gap-2 text-xs font-bold">
                  {isSelected ? (
                    <span className="flex items-center gap-1 text-success font-black">
                      ✓ مدل فعال کنونی
                    </span>
                  ) : isInstalled ? (
                    <span className="text-ink-soft">ذخیره شده در کش دستگاه</span>
                  ) : (
                    <span className="text-ink-soft/60">هنوز دانلود نشده</span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {isInstalled && (
                    <button
                      type="button"
                      onClick={() => void removeModel(m.id)}
                      className="v-btn-ghost px-3 py-1.5 text-xs text-red-500 hover:text-red-700"
                      title="پاک کردن از حافظه برای خالی شدن فضای گوشی"
                    >
                      حذف از حافظه
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      saveSettings(settingsForModelChoice(`local-${m.id}`, settings))
                      if (!isInstalled && !isReadyThis) {
                        void downloadModel(m.id)
                      }
                    }}
                    disabled={isDownloadingThis}
                    className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-brand text-on-brand shadow-sm'
                        : 'bg-paper-deep border border-border text-ink hover:border-brand hover:text-brand'
                    }`}
                  >
                    <Star size={13} />
                    {isSelected
                      ? 'انتخاب شده'
                      : isInstalled
                      ? 'فعال‌سازی مدل'
                      : `دانلود و فعال‌سازی (${m.size})`}
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
