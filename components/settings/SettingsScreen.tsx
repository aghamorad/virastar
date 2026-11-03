'use client'

import { useEffect, useState } from 'react'
import { THEMES } from '@/domain/themes'
import {
  playTactileSound,
  isAudioFeedbackEnabled,
  setAudioFeedbackEnabled,
} from '@/domain/audioFeedback'
import {
  HOSTED_ENDPOINT,
  MODEL_OPTIONS,
  modelChoiceFromSettings,
  settingsForModelChoice,
  type EngineSettings,
} from '@/domain/engine'
import {
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

  const [audioEnabled, setAudioEnabled] = useState(false)
  const [sandboxText, setSandboxText] = useState('بهار آمد و گلزار پر از نغمه شد.')
  const [sandboxStyle, setSandboxStyle] = useState('rasmi')

  useEffect(() => {
    setAudioEnabled(isAudioFeedbackEnabled())
  }, [])

  function toggleAudio() {
    const next = !audioEnabled
    setAudioEnabled(next)
    setAudioFeedbackEnabled(next)
    if (next) {
      playTactileSound(active, 'special')
    }
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
    <div className="space-y-10 max-w-5xl mx-auto pb-12">
      {/* Sketch Header Scrap */}
      <header className="v-card p-6 sm:p-8 relative">
        <div className="sketch-tape" aria-hidden="true" />
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="sketch-blue-note text-xs">
            ✎ تنظیمات دفترچهٔ ویراستار
          </span>
          <span className="sketch-highlight text-xs font-bold">
            پوسته‌ها و موتورهای هوشمند
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-ink tracking-tight">
          پیکربندی و تنظیمات
        </h1>
        <p className="mt-2 max-w-2xl text-xs sm:text-sm leading-relaxed text-ink-soft font-normal">
          پوستهٔ دیداری ویراستار، اتصال به سرورهای ابری اختصاصی، کلیدهای رایگان، و دانلود مدل‌های ۱۰۰٪ آفلاین بدون نیاز به اینترنت.
        </p>
      </header>

      {/* Engine Selection */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 border-b border-border/80 pb-2">
          <span className="sketch-bracket text-base">[</span>
          <h2 className="text-lg sm:text-xl font-bold text-ink">موتور و شیوهٔ ویرایش</h2>
          <span className="sketch-bracket text-base">]</span>
        </div>

        <div className="v-card p-5 space-y-3">
          <label htmlFor="model-choice" className="block text-sm font-bold text-ink">
            مدل و شیوهٔ پردازش متن
          </label>
          <select
            id="model-choice"
            value={option.id}
            onChange={(e) => handleChoiceChange(e.target.value)}
            className="w-full rounded-[8px_4px_10px_4px] border border-border bg-paper px-4 py-2.5 text-sm font-bold text-ink outline-none cursor-pointer shadow-soft focus:border-ink"
          >
            {MODEL_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-ink-soft leading-relaxed font-normal">{option.description}</p>
        </div>

        {option.id === 'online-gemini' && (
          <div className="v-card p-4 bg-highlight/40 border border-ink/30 space-y-1">
            <p className="font-bold text-sm text-ink flex items-center gap-1.5">
              <span>✨</span> سرور ابری ویراستار (پیش‌فرض)
            </p>
            <p className="text-xs text-ink-soft leading-relaxed font-normal">
              متن به صورت خودکار از طریق سرور اختصاصی ویراستار با مدل Google Gemini پردازش می‌شود؛ بدون نیاز به هیچ کلید یا تنظیمی.
            </p>
          </div>
        )}

        {option.id === 'online-qwen' && (
          <div className="v-card p-4 bg-paper space-y-1">
            <p className="font-bold text-sm text-ink flex items-center gap-1.5">
              <span>⚡</span> قوِن آنلاین (Cloudflare Workers AI)
            </p>
            <p className="text-xs text-ink-soft leading-relaxed font-normal">
              متن از طریق سرور جهانی Cloudflare و مدل Qwen 2.5 7B ویرایش می‌شود؛ نیازی به نصب یا کلید ندارد.
            </p>
          </div>
        )}

        {/* Custom Cloudflare Worker (1-Click Deploy) */}
        {option.id === 'custom-worker' && (
          <div className="v-card p-5 space-y-4 relative">
            <div className="sketch-tape" aria-hidden="true" />
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2">
              <span className="font-bold text-ink text-sm sm:text-base">سرور اختصاصی Cloudflare شما (کاملاً رایگان)</span>
              <span className="sketch-highlight text-xs font-bold">
                بدون نیاز به کدنویسی (۱ کلیک)
              </span>
            </div>

            <p className="text-xs text-ink-soft leading-relaxed font-normal">
              با ساخت سرور ابری اختصاصی، شما یک شعبهٔ مستقل از ویراستار روی سرورهای جهانی Cloudflare خواهید داشت که نامحدود، پرسرعت و رایگان است و ظرفیت آن با هیچ کاربر دیگری به اشتراک گذاشته نمی‌شود.
            </p>

            <a
              href="https://deploy.workers.cloudflare.com/?url=https://github.com/aghamorad/virastar/tree/main/worker"
              target="_blank"
              rel="noreferrer"
              className="v-btn-primary w-full text-xs sm:text-sm py-2.5 flex items-center justify-center gap-2"
            >
              <Star size={15} />
              <span>🌐 ۱. ساخت و راه‌اندازی سرور در Cloudflare (با ۱ کلیک)</span>
            </a>

            <div className="bg-paper p-3.5 rounded-[8px_4px_10px_4px] border border-border text-xs leading-relaxed text-ink-soft space-y-1.5 font-normal">
              <p className="font-bold text-ink">مراحل ساده ساخت سرور (حتی برای افراد غیرفنی):</p>
              <p>۱. روی دکمه بالا بزنید تا صفحه رسمی Cloudflare باز شود و با ایمیل یا حساب گوگل خود وارد شوید.</p>
              <p>۲. در صفحه بازشده، روی دکمه آبی‌رنگ <strong>«Deploy»</strong> بزنید. کلودفلر ظرف ۲۰ ثانیه سرور رایگان شما را می‌سازد.</p>
              <p>۳. آدرس سرور ساخته‌شده (مانند <code className="bg-surface px-1.5 py-0.5 rounded border border-border text-brand font-mono">https://virastar-edit.yourname.workers.dev</code>) را کپی کرده و در کادر زیر قرار دهید.</p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="custom-worker-url" className="block text-xs font-bold text-ink">
                  آدرس سرور اختصاصی شما
                </label>
                {settings.endpoint !== HOSTED_ENDPOINT && (
                  <button
                    type="button"
                    onClick={() => {
                      saveSettings({ ...settings, endpoint: HOSTED_ENDPOINT })
                      setTestStatus(null)
                    }}
                    className="text-xs text-brand underline hover:text-ink cursor-pointer font-bold"
                  >
                    بازنشانی به سرور پیش‌فرض ویراستار
                  </button>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  id="custom-worker-url"
                  type="url"
                  placeholder="https://virastar-edit.yourname.workers.dev"
                  value={settings.endpoint}
                  onChange={(e) => {
                    saveSettings({ ...settings, endpoint: e.target.value.trim() })
                    setTestStatus(null)
                  }}
                  className="v-field font-mono text-xs flex-1"
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
                    className="v-btn-ghost px-3 py-2 text-xs font-bold whitespace-nowrap"
                    title="چسباندن آدرس کپی‌شده از حافظه"
                  >
                    📋 چسباندن
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
                  className={`mt-2.5 rounded-[6px_3px_8px_3px] p-2.5 text-xs font-bold border ${
                    testStatus.state === 'success'
                      ? 'bg-success/10 border-success/30 text-success'
                      : testStatus.state === 'testing'
                      ? 'bg-accent/10 border-accent/30 text-accent'
                      : 'bg-brand/10 border-brand/30 text-brand'
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
          <div className="v-card p-5 space-y-4 relative">
            <div className="sketch-tape" aria-hidden="true" />
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2">
              <span className="font-bold text-ink text-sm sm:text-base">کلید رایگان Google Gemini API</span>
              <span className="sketch-highlight text-xs font-bold">
                ۱۵۰۰ درخواست رایگان در روز
              </span>
            </div>

            <p className="text-xs text-ink-soft leading-relaxed font-normal">
              گوگل برای هر حساب کاربری جیمیل، سهمیه روزانه ۱۵۰۰ ویرایش رایگان با بهترین کیفیت و هوش مصنوعی فارسی قرار داده است.
            </p>

            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noreferrer"
              className="v-btn-primary w-full text-xs sm:text-sm py-2.5 flex items-center justify-center gap-2"
            >
              <Star size={15} />
              <span>🌐 ۱. باز کردن صفحه دریافت کلید رایگان گوگل (۱ کلیک)</span>
            </a>

            <div className="bg-paper p-3.5 rounded-[8px_4px_10px_4px] border border-border text-xs leading-relaxed text-ink-soft space-y-1.5 font-normal">
              <p className="font-bold text-ink">مراحل دریافت کلید (کمتر از ۱ دقیقه):</p>
              <p>۱. روی دکمه بالا بزنید تا سایت رسمی گوگل باز شود و با ایمیل خود وارد شوید.</p>
              <p>۲. روی دکمه آبی‌رنگ <strong>«Create API key»</strong> بزنید و کد کلید را کپی کنید.</p>
              <p>۳. به این صفحه بازگردید و روی دکمهٔ <strong>«چسباندن از حافظه»</strong> بزنید. تمام!</p>
            </div>

            <div>
              <label htmlFor="gemini-key" className="block text-xs font-bold text-ink mb-1.5">
                کد کلید API گوگل (Gemini API Key)
              </label>

              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  id="gemini-key"
                  type="password"
                  placeholder="AIzaSy..."
                  value={settings.geminiApiKey ?? ''}
                  onChange={(e) => {
                    saveSettings({ ...settings, geminiApiKey: e.target.value.trim() })
                    setTestStatus(null)
                  }}
                  className="v-field font-mono text-xs flex-1"
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
                    className="v-btn-ghost px-3 py-2 text-xs font-bold whitespace-nowrap"
                    title="چسباندن کلید از حافظه"
                  >
                    📋 چسباندن
                  </button>

                  <button
                    type="button"
                    onClick={() => void testGeminiKey(settings.geminiApiKey ?? '')}
                    disabled={!settings.geminiApiKey}
                    className="v-btn-primary px-3 py-2 text-xs font-bold whitespace-nowrap disabled:opacity-40"
                  >
                    ⚡ آزمایش کلید
                  </button>
                </div>
              </div>

              {testStatus?.type === 'gemini' && (
                <div
                  className={`mt-2.5 rounded-[6px_3px_8px_3px] p-2.5 text-xs font-bold border ${
                    testStatus.state === 'success'
                      ? 'bg-success/10 border-success/30 text-success'
                      : testStatus.state === 'testing'
                      ? 'bg-accent/10 border-accent/30 text-accent'
                      : 'bg-brand/10 border-brand/30 text-brand'
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
          <div className="v-card p-5 space-y-4 relative">
            <div className="sketch-tape" aria-hidden="true" />
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2">
              <span className="font-bold text-ink text-sm sm:text-base">کلید رایگان Groq (فوق‌سریع)</span>
              <span className="sketch-highlight text-xs font-bold">
                مدل Qwen 2.5 32B (۳۰۰ کلمه بر ثانیه)
              </span>
            </div>

            <p className="text-xs text-ink-soft leading-relaxed font-normal">
              سرویس Groq سریع‌ترین پردازشگر ابری جهان است که مدل قدرتمند Qwen 2.5 را به رایگان و بدون تأخیر در اختیار شما می‌گذارد.
            </p>

            <a
              href="https://console.groq.com/keys"
              target="_blank"
              rel="noreferrer"
              className="v-btn-primary w-full text-xs sm:text-sm py-2.5 flex items-center justify-center gap-2"
            >
              <Star size={15} />
              <span>🌐 ۱. باز کردن صفحه دریافت کلید Groq (۱ کلیک)</span>
            </a>

            <div className="bg-paper p-3.5 rounded-[8px_4px_10px_4px] border border-border text-xs leading-relaxed text-ink-soft space-y-1.5 font-normal">
              <p className="font-bold text-ink">مراحل دریافت کلید Groq:</p>
              <p>۱. روی دکمه بالا بزنید تا وارد سایت Groq شوید.</p>
              <p>۲. دکمه <strong>«Create API Key»</strong> را بزنید و کلید ساخته‌شده را کپی کنید.</p>
              <p>۳. در این صفحه دکمهٔ <strong>«چسباندن از حافظه»</strong> را بزنید.</p>
            </div>

            <div>
              <label htmlFor="groq-key" className="block text-xs font-bold text-ink mb-1.5">
                کد کلید API گروک (Groq API Key)
              </label>

              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  id="groq-key"
                  type="password"
                  placeholder="gsk_..."
                  value={settings.groqApiKey ?? ''}
                  onChange={(e) => {
                    saveSettings({ ...settings, groqApiKey: e.target.value.trim() })
                    setTestStatus(null)
                  }}
                  className="v-field font-mono text-xs flex-1"
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
                    className="v-btn-ghost px-3 py-2 text-xs font-bold whitespace-nowrap"
                    title="چسباندن کلید از حافظه"
                  >
                    📋 چسباندن
                  </button>

                  <button
                    type="button"
                    onClick={() => void testGroqKey(settings.groqApiKey ?? '')}
                    disabled={!settings.groqApiKey}
                    className="v-btn-primary px-3 py-2 text-xs font-bold whitespace-nowrap disabled:opacity-40"
                  >
                    ⚡ آزمایش کلید
                  </button>
                </div>
              </div>

              {testStatus?.type === 'groq' && (
                <div
                  className={`mt-2.5 rounded-[6px_3px_8px_3px] p-2.5 text-xs font-bold border ${
                    testStatus.state === 'success'
                      ? 'bg-success/10 border-success/30 text-success'
                      : testStatus.state === 'testing'
                      ? 'bg-accent/10 border-accent/30 text-accent'
                      : 'bg-brand/10 border-brand/30 text-brand'
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
          <div className="v-card p-5 space-y-4">
            <p className="font-bold text-ink text-sm sm:text-base">اتصال به مدل آفلاین روی مک (Ollama / LM Studio)</p>
            <div className="bg-paper p-3.5 rounded-[8px_4px_10px_4px] border border-border text-xs leading-relaxed text-ink-soft space-y-1.5 font-normal">
              <p className="font-bold text-ink">اجرای ساده در ترمینال مک:</p>
              <code className="block bg-surface border border-border px-3 py-1.5 rounded text-ink font-mono font-bold text-xs select-all">
                ollama run qwen2.5:1.5b
              </code>
              <p>به محض اجرای دستور فوق، ویراستار به صورت کاملاً آفلاین و با بیشترین سرعت به مدل متصل خواهد شد.</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="ollama-endpoint" className="block text-xs font-bold text-ink mb-1">
                  آدرس سرور محلی
                </label>
                <input
                  id="ollama-endpoint"
                  type="text"
                  value={settings.customEndpoint ?? 'http://localhost:11434/v1'}
                  onChange={(e) => saveSettings({ ...settings, customEndpoint: e.target.value.trim() })}
                  className="v-field font-mono text-xs"
                />
              </div>
              <div>
                <label htmlFor="ollama-model" className="block text-xs font-bold text-ink mb-1">
                  نام مدل (Ollama Model Name)
                </label>
                <input
                  id="ollama-model"
                  type="text"
                  value={settings.customModel ?? 'qwen2.5:1.5b'}
                  onChange={(e) => saveSettings({ ...settings, customModel: e.target.value.trim() })}
                  className="v-field font-mono text-xs"
                />
              </div>
            </div>
          </div>
        )}

        {option.kind === 'rules' && (
          <div className="v-card p-4 bg-paper space-y-1">
            <p className="font-bold text-sm text-ink">بدون هوش مصنوعی (فقط قواعد دستوری و املایی)</p>
            <p className="text-xs text-ink-soft leading-relaxed font-normal">
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

      {/* Smart Keyboard Integration Guide */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 border-b border-border/80 pb-2">
          <span className="sketch-bracket text-base">[</span>
          <h2 className="text-lg sm:text-xl font-bold text-ink">کیبورد هوشمند ویراستار (ویژه موبایل و پیام‌رسان‌ها)</h2>
          <span className="sketch-bracket text-base">]</span>
        </div>

        <div className="v-card p-5 space-y-3 relative">
          <div className="sketch-tape" aria-hidden="true" />
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2">
            <span className="font-bold text-ink text-sm sm:text-base">استفاده مستقیم داخل واتس‌اپ، تلگرام، اینستاگرام و یادداشت‌ها</span>
            <span className="sketch-highlight text-xs font-bold">
              iOS Keyboard Extension
            </span>
          </div>

          <p className="text-xs text-ink-soft leading-relaxed font-normal">
            با کیبورد ویراستار، نیازی به کپی و جابه‌جایی متن نیست! در هر برنامه‌ای که تایپ می‌کنید، کیبورد ویراستار متن را مستقیماً ویرایش کرده، نیم‌فاصله‌ها و نشانه‌گذاری را درست می‌کند و لحن دلخواه شما را اعمال می‌کند.
          </p>

          <div className="bg-paper p-3.5 rounded-[8px_4px_10px_4px] border border-border text-xs leading-relaxed text-ink-soft space-y-1.5 font-normal">
            <p className="font-bold text-ink">نحوه فعال‌سازی در آیفون و آیپد (فقط یک‌بار):</p>
            <p>۱. وارد تنظیمات اصلی آیفون (<strong>Settings</strong>) شوید.</p>
            <p>۲. به مسیر <strong>General &gt; Keyboard &gt; Keyboards</strong> بروید.</p>
            <p>۳. گزینه <strong>«Add New Keyboard...»</strong> را بزنید و <strong>«ویراستار (Virastar)»</strong> را انتخاب کنید.</p>
            <p>۴. روی ویراستار کلیک کرده و گزینه <strong>«Allow Full Access»</strong> را روشن کنید (برای فعال شدن هوش مصنوعی و گفتار به متن).</p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-ink-soft border-t border-border pt-2.5 font-normal">
            <span className="text-brand font-bold">💡 روش استفاده:</span>
            <span>در هر برنامه روی آیکون کُره زمین (🌐) پایین کیبورد بزنید تا ویراستار بالا بیاید، بنویسید و دکمهٔ «✨ ویرایش با ویراستار» را لمس کنید!</span>
          </div>
        </div>
      </section>

      {/* Themes — 8 Sketchbook Palettes */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-2 border-b border-border/80 pb-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="sketch-bracket text-base">[</span>
              <h2 className="text-lg sm:text-xl font-bold text-ink">پوسته‌های زنده و برگه‌های یادداشت</h2>
              <span className="sketch-bracket text-base">]</span>
            </div>
            <p className="mt-1 text-xs text-ink-soft font-normal">
              ۸ پالت رنگی با حس طبیعی کاغذ، دست‌خط، گرافیت مداد و بازخورد صوتی آرامش‌بخش
            </p>
          </div>
          <button
            type="button"
            onClick={toggleAudio}
            className={`v-chip text-xs ${audioEnabled ? 'v-chip-active' : ''}`}
            title="روشن یا خاموش کردن صدای لمس کلیدها"
          >
            <span>{audioEnabled ? '🔊 صدای تعاملی: روشن' : '🔇 صدای تعاملی: خاموش'}</span>
          </button>
        </div>

        <div className="grid gap-3.5 sm:grid-cols-2">
          {THEMES.map((t) => {
            const isActive = t.id === active
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  applyTheme(t.id)
                  playTactileSound(t.id, 'special')
                }}
                aria-pressed={isActive}
                className={`v-card p-4 text-start transition-all cursor-pointer relative ${
                  isActive
                    ? 'bg-highlight/50 border-ink shadow-card scale-[1.01]'
                    : 'hover:border-ink/70 hover:rotate-[-0.3deg]'
                }`}
              >
                {isActive && (
                  <div className="absolute top-0 end-0 bg-brand text-white text-[10px] font-bold px-2.5 py-0.5 rounded-bl-[6px] shadow-xs">
                    فعال
                  </div>
                )}

                <div className="flex items-start gap-3">
                  <span className="text-2xl shrink-0 leading-none pt-0.5" aria-hidden="true">
                    {t.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5 mb-1">
                      <span className="font-bold text-sm sm:text-base text-ink">{t.label}</span>
                      <span className="text-[10px] px-2 py-0.5 bg-paper rounded-[4px] border border-border text-ink-soft font-medium">
                        {t.taste}
                      </span>
                    </div>

                    <p className="text-xs leading-relaxed text-ink-soft mb-2 font-normal">{t.blurb}</p>

                    <div className="text-[11px] leading-relaxed text-ink-soft bg-paper/70 border border-border rounded-[6px] p-2 mb-2 font-normal">
                      <span className="font-bold text-ink">حس تعاملی: </span>
                      {t.interactiveFeature}
                    </div>

                    {/* Palette Dots */}
                    <div className="flex items-center justify-between pt-1 border-t border-border/60">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-ink-soft">پالت:</span>
                        <div className="flex items-center gap-1">
                          <span
                            className="w-3.5 h-3.5 rounded-full border border-black/15 shadow-xs inline-block"
                            style={{ backgroundColor: t.palette.paper }}
                            title="کاغذ"
                          />
                          <span
                            className="w-3.5 h-3.5 rounded-full border border-black/15 shadow-xs inline-block"
                            style={{ backgroundColor: t.palette.surface }}
                            title="کارت‌ها"
                          />
                          <span
                            className="w-3.5 h-3.5 rounded-full border border-black/15 shadow-xs inline-block"
                            style={{ backgroundColor: t.palette.brand }}
                            title="نشان"
                          />
                          <span
                            className="w-3.5 h-3.5 rounded-full border border-black/15 shadow-xs inline-block"
                            style={{ backgroundColor: t.palette.ink }}
                            title="جوهر"
                          />
                          <span
                            className="w-3.5 h-3.5 rounded-full border border-black/15 shadow-xs inline-block"
                            style={{ backgroundColor: t.palette.accent }}
                            title="چاشنی"
                          />
                        </div>
                      </div>

                      <span className="text-[10px] font-bold text-brand underline">
                        {isActive ? 'پوستهٔ شما' : 'لمس برای انتخاب'}
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        {/* Live Interactive Sandbox / Theme Playground */}
        <div className="v-card p-5 space-y-4 relative">
          <div className="sketch-tape" aria-hidden="true" />
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2.5">
            <div className="flex items-center gap-2">
              <span className="text-xl">✏️</span>
              <div>
                <h3 className="font-bold text-sm sm:text-base text-ink">آزمایشگاه زندهٔ پوسته و قلم</h3>
                <p className="text-[11px] text-ink-soft font-normal">
                  حس کلیدها، بافت کاغذ، صدای نگارش و رنگ این پوسته را همین‌جا بیازمایید
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => playTactileSound(active, 'special')}
              className="v-btn-ghost text-xs px-2.5 py-1 flex items-center gap-1.5"
            >
              <span>🎵 آزمایش صدای این پوسته</span>
            </button>
          </div>

          <div className="space-y-3">
            {/* Style selector pills in sandbox */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-bold text-ink">نمونهٔ لحن:</span>
              {[
                { id: 'rasmi', label: 'رسمی' },
                { id: 'edari', label: 'اداری' },
                { id: 'hoghooghi', label: 'حقوقی' },
                { id: 'divani', label: 'دیوانی' },
                { id: 'khodemani', label: 'خودمانی' },
              ].map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    setSandboxStyle(s.id)
                    playTactileSound(active, 'tap')
                  }}
                  className={`v-chip text-xs px-2.5 py-1 ${
                    sandboxStyle === s.id ? 'v-chip-active' : ''
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {/* Live Text Area in sandbox */}
            <textarea
              rows={2}
              value={sandboxText}
              onChange={(e) => {
                setSandboxText(e.target.value)
                playTactileSound(active, 'tap')
              }}
              className="v-field text-sm leading-relaxed resize-none"
              placeholder="اینجا چیزی بنویسید تا حس و رنگ این پوسته را ببینید..."
            />

            {/* Interactive Actions */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setSandboxText((prev) => prev + '\u200c')
                    playTactileSound(active, 'special')
                  }}
                  className="v-btn-ghost text-xs px-2.5 py-1"
                  title="افزودن نیم‌فاصله"
                >
                  [نیم‌فاصله]
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSandboxText((prev) => prev + ' «»')
                    playTactileSound(active, 'tap')
                  }}
                  className="v-btn-ghost text-xs px-2.5 py-1"
                >
                  «گیومه»
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  playTactileSound(active, 'action')
                  const t = sandboxText
                  setSandboxText('✨ در حال ویراستاری...')
                  setTimeout(() => setSandboxText(t), 400)
                }}
                className="v-btn-primary text-xs sm:text-sm px-4 py-2"
              >
                <span>✨ آزمایش کلید اصلی</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* About */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 border-b border-border/80 pb-2">
          <span className="sketch-bracket text-base">[</span>
          <h2 className="text-lg sm:text-xl font-bold text-ink">درباره و شناسهٔ نرم‌افزار</h2>
          <span className="sketch-bracket text-base">]</span>
        </div>

        <div className="v-card p-5 space-y-3 relative">
          <div className="sketch-tape" aria-hidden="true" />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-lg font-bold text-ink">ویراستار فارسی (Virastar)</p>
              <p className="mt-0.5 text-xs text-ink-soft font-normal">
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
                className="v-btn-primary px-5 py-2 text-xs font-bold"
              >
                <Star size={14} />
                دریافت نسخهٔ {faVersion(newer)}
              </a>
            )}
          </div>
          <div className="mt-3 pt-3 border-t border-border flex flex-wrap items-center justify-between gap-2 text-xs text-ink-soft">
            <span className="inline-flex items-center gap-1.5 font-bold text-ink">
              <Star size={12} className="text-brand" />
              ساخته‌شده با ❤️ توسط مراد (Made by Morad)
            </span>
            <span className="font-normal">ابزار نگارش، بازنویسی و پیرایش زبان فارسی</span>
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
        <div className="flex items-center gap-2 border-b border-border/80 pb-2">
          <span className="sketch-bracket text-base">[</span>
          <h2 className="text-lg sm:text-xl font-bold text-ink">مرکز دانلود مدل‌های آفلاین</h2>
          <span className="sketch-bracket text-base">]</span>
        </div>
        <p className="mt-1 text-xs text-ink-soft font-normal">
          مدل‌های زیر مستقیماً داخل حافظه مرورگر دستگاه شما دانلود و ذخیره می‌شوند. پس از یک‌بار دانلود، تمام ویرایش‌ها کاملاً آفلاین، بدون اینترنت و با حریم خصوصی ۱۰۰٪ انجام می‌گردد.
        </p>
      </div>

      <div className="grid gap-3.5 sm:grid-cols-1">
        {localModelsList.map((m) => {
          const isSelected = settings.localModel === m.id
          const isInstalled = wasModelInstalled(m.id)
          const isDownloadingThis = modelStatus.state === 'downloading' && modelStatus.modelId === m.id
          const isReadyThis = modelStatus.state === 'ready' && modelStatus.modelId === m.id

          return (
            <div
              key={m.id}
              className={`v-card p-5 space-y-3 transition-all ${
                isSelected ? 'border-ink bg-highlight/30 shadow-card' : ''
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2 border-b border-border pb-2.5">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-sm sm:text-base text-ink">{m.name}</span>
                    <span className="sketch-highlight text-xs font-bold">
                      {m.badge}
                    </span>
                    <span className="bg-paper px-2 py-0.5 rounded-[4px] border border-border text-xs text-ink-soft">
                      حجم: {m.size}
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs text-ink-soft font-normal leading-relaxed">{m.recommendation}</p>
                  <p className="mt-1 text-xs text-ink font-bold">
                    🎯 کاربرد بهینه: <span className="font-normal text-ink-soft">{m.bestFor}</span>
                  </p>
                  <p className="text-[11px] text-ink-soft/80 font-normal">
                    💾 سخت‌افزار مورد نیاز: {m.ram}
                  </p>
                </div>
              </div>

              {isDownloadingThis && (
                <div className="bg-paper p-3 rounded-[8px_4px_10px_4px] border border-border">
                  <div className="flex items-center justify-between text-xs font-bold text-ink">
                    <span className="flex items-center gap-1.5">
                      <Star size={13} className="animate-spin text-brand" />
                      در حال دریافت مدل در حافظه دستگاه…
                    </span>
                    <span className="font-mono">{faNum(modelStatus.progress)}٪</span>
                  </div>
                  <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-surface border border-border">
                    <div
                      className="h-full bg-brand transition-all duration-300"
                      style={{ width: `${modelStatus.progress}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <div className="flex items-center gap-2 text-xs">
                  {isSelected ? (
                    <span className="sketch-highlight font-bold text-xs">
                      ✓ مدل فعال کنونی
                    </span>
                  ) : isInstalled ? (
                    <span className="text-ink-soft text-xs">ذخیره شده در کش دستگاه</span>
                  ) : (
                    <span className="text-ink-soft/70 text-xs">هنوز دانلود نشده</span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {isInstalled && (
                    <button
                      type="button"
                      onClick={() => void removeModel(m.id)}
                      className="v-btn-ghost px-2.5 py-1 text-xs text-brand hover:border-brand"
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
                    className={`v-btn-primary px-3.5 py-1.5 text-xs font-bold ${
                      isSelected ? 'bg-ink text-paper' : ''
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
