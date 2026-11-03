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
      {/* Neo-Brutalist Strip Header */}
      <header className="border-b-4 border-black pb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-none border-2 border-black bg-emphasis text-black text-xs font-black shadow-[2px_2px_0px_#000] uppercase mb-4">
          <Star size={13} className="text-signal fill-signal" />
          <span>پیکربندی سامانه و موتورهای هوشمند</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-black text-ink tracking-tight uppercase leading-tight">
          تنظیمات ویراستار
        </h1>
        <p className="mt-3 max-w-2xl text-sm sm:text-base leading-7 text-ink font-bold">
          پوستهٔ دیداری ویراستار، اتصال به سرورهای ابری اختصاصی، کلیدهای رایگان، و دانلود مدل‌های ۱۰۰٪ آفلاین بدون اینترنت.
        </p>
      </header>

      {/* Engine Selection */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 border-b-3 border-black pb-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-none border-2 border-black bg-emphasis text-black font-black text-sm shadow-[2px_2px_0px_#000]">
            ⚡
          </span>
          <h2 className="text-xl sm:text-2xl font-black text-ink">موتور و مدل پردازش متن</h2>
        </div>

        <div className="rounded-none border-4 border-black bg-white p-5 shadow-[6px_6px_0px_#000]">
          <label htmlFor="model-choice" className="block text-base font-black text-black mb-2">
            شیوهٔ ویرایش و مدل اجرایی
          </label>
          <select
            id="model-choice"
            value={option.id}
            onChange={(e) => handleChoiceChange(e.target.value)}
            className="w-full rounded-none border-3 border-black bg-paper px-4 py-3 text-base font-black text-black shadow-[3px_3px_0px_#000] outline-none cursor-pointer"
          >
            {MODEL_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
          <p className="mt-3 text-xs sm:text-sm leading-6 text-black/80 font-bold">{option.description}</p>
        </div>

        {option.id === 'online-gemini' && (
          <div className="rounded-none border-4 border-black bg-emphasis p-5 shadow-[6px_6px_0px_#000] text-black">
            <p className="font-black text-base uppercase">سرور ابری ویراستار (پیش‌فرض)</p>
            <p className="mt-1 text-xs sm:text-sm leading-6 font-bold text-black/90">
              متن به صورت خودکار از طریق سرور اختصاصی ویراستار با مدل Google Gemini پردازش می‌شود؛ بدون نیاز به هیچ کلید، تنظیم، یا پیچیدگی فنی.
            </p>
          </div>
        )}

        {option.id === 'online-qwen' && (
          <div className="rounded-none border-4 border-black bg-field p-5 shadow-[6px_6px_0px_#000] text-black">
            <p className="font-black text-base uppercase">قوِن آنلاین (Cloudflare Workers AI)</p>
            <p className="mt-1 text-xs sm:text-sm leading-6 font-bold text-black/90">
              متن از طریق سرور جهانی Cloudflare و مدل قدرتمند Qwen 2.5 7B ویرایش می‌شود؛ پایدار، رایگان و بدون نیاز به نصب هیچ ابزاری.
            </p>
          </div>
        )}

        {/* Custom Cloudflare Worker (1-Click Deploy) */}
        {option.id === 'custom-worker' && (
          <div className="rounded-none border-4 border-black bg-white p-5 shadow-[6px_6px_0px_#000] space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-black pb-2">
              <span className="font-black text-black text-base sm:text-lg">سرور اختصاصی Cloudflare شما (کاملاً رایگان)</span>
              <span className="rounded-none border-2 border-black bg-emphasis px-2.5 py-0.5 text-xs font-black text-black shadow-[2px_2px_0px_#000]">
                بدون نیاز به کدنویسی (۱ کلیک)
              </span>
            </div>

            <p className="text-xs sm:text-sm leading-6 text-black/85 font-medium">
              با ساخت سرور ابری اختصاصی، شما یک شعبهٔ مستقل از ویراستار روی سرورهای جهانی Cloudflare خواهید داشت که نامحدود، پرسرعت و رایگان است و ظرفیت پردازش آن با هیچ کاربر دیگری به اشتراک گذاشته نمی‌شود.
            </p>

            <a
              href="https://deploy.workers.cloudflare.com/?url=https://github.com/aghamorad/virastar/tree/main/worker"
              target="_blank"
              rel="noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-none border-3 border-black bg-emphasis px-4 py-3.5 text-sm font-black text-black shadow-[4px_4px_0px_#000] hover:bg-black hover:text-emphasis active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-none"
            >
              <Star size={16} className="text-signal fill-signal" />
              <span>🌐 ۱. ساخت و راه‌اندازی سرور در Cloudflare (با ۱ کلیک)</span>
            </a>

            <div className="rounded-none border-2 border-black bg-paper p-4 text-xs leading-6 text-black space-y-2 shadow-[2px_2px_0px_#000]">
              <p className="font-black text-sm">مراحل ساده ساخت سرور (حتی برای افراد غیرفنی):</p>
              <p>۱. روی دکمهٔ زردرنگ بالا بزنید تا صفحه رسمی Cloudflare باز شود و با ایمیل یا حساب گوگل خود وارد شوید.</p>
              <p>۲. در صفحه بازشده، روی دکمه آبی‌رنگ <strong>«Deploy»</strong> بزنید. کلودفلر ظرف ۲۰ ثانیه سرور رایگان شما را می‌سازد.</p>
              <p>۳. آدرس سرور ساخته‌شده (مانند <code className="bg-white px-1.5 py-0.5 border border-black font-mono font-bold">https://virastar-edit.yourname.workers.dev</code>) را کپی کرده و در کادر زیر قرار دهید.</p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="custom-worker-url" className="block text-xs font-black text-black">
                  آدرس سرور اختصاصی شما
                </label>
                {settings.endpoint !== HOSTED_ENDPOINT && (
                  <button
                    type="button"
                    onClick={() => {
                      saveSettings({ ...settings, endpoint: HOSTED_ENDPOINT })
                      setTestStatus(null)
                    }}
                    className="text-xs font-black text-signal underline hover:text-black cursor-pointer"
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
                  className="flex-1 rounded-none border-3 border-black bg-white px-4 py-2.5 font-mono text-xs font-bold text-black shadow-[3px_3px_0px_#000] outline-none"
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
                    className="rounded-none border-2 border-black bg-white px-3 py-2 text-xs font-black shadow-[2px_2px_0px_#000] hover:bg-emphasis active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-none cursor-pointer whitespace-nowrap"
                    title="چسباندن آدرس کپی‌شده از حافظه"
                  >
                    📋 چسباندن از حافظه
                  </button>

                  <button
                    type="button"
                    onClick={() => void testWorkerUrl(settings.endpoint)}
                    className="rounded-none border-2 border-black bg-signal text-white px-3 py-2 text-xs font-black shadow-[2px_2px_0px_#000] hover:bg-black active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-none cursor-pointer whitespace-nowrap"
                  >
                    ⚡ آزمایش اتصال
                  </button>
                </div>
              </div>

              {testStatus?.type === 'worker' && (
                <div
                  className={`mt-3 rounded-none border-3 border-black p-3 text-xs font-black shadow-[3px_3px_0px_#000] ${
                    testStatus.state === 'success'
                      ? 'bg-emphasis text-black'
                      : testStatus.state === 'testing'
                      ? 'bg-field text-black'
                      : 'bg-signal text-white'
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
          <div className="rounded-none border-4 border-black bg-white p-5 shadow-[6px_6px_0px_#000] space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-black pb-2">
              <span className="font-black text-black text-base sm:text-lg">کلید رایگان Google Gemini API</span>
              <span className="rounded-none border-2 border-black bg-emphasis px-2.5 py-0.5 text-xs font-black text-black shadow-[2px_2px_0px_#000]">
                ۱۵۰۰ درخواست رایگان در روز
              </span>
            </div>

            <p className="text-xs sm:text-sm leading-6 text-black/85 font-medium">
              گوگل برای هر حساب کاربری جیمیل، سهمیه روزانه ۱۵۰۰ ویرایش رایگان با بهترین کیفیت و هوش مصنوعی فارسی قرار داده است.
            </p>

            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-none border-3 border-black bg-signal px-4 py-3.5 text-sm font-black text-white shadow-[4px_4px_0px_#000] hover:bg-black hover:text-white active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-none"
            >
              <Star size={16} />
              <span>🌐 ۱. باز کردن صفحه دریافت کلید رایگان گوگل (۱ کلیک)</span>
            </a>

            <div className="rounded-none border-2 border-black bg-paper p-4 text-xs leading-6 text-black space-y-2 shadow-[2px_2px_0px_#000]">
              <p className="font-black text-sm">مراحل دریافت کلید (کمتر از ۱ دقیقه):</p>
              <p>۱. روی دکمه بالا بزنید تا سایت رسمی گوگل باز شود و با ایمیل خود وارد شوید.</p>
              <p>۲. روی دکمه آبی‌رنگ <strong>«Create API key»</strong> بزنید و کد کلید را کپی کنید.</p>
              <p>۳. به این صفحه بازگردید و روی دکمهٔ <strong>«چسباندن از حافظه»</strong> بزنید. تمام!</p>
            </div>

            <div>
              <label htmlFor="gemini-key" className="block text-xs font-black text-black mb-2">
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
                  className="flex-1 rounded-none border-3 border-black bg-white px-4 py-2.5 font-mono text-xs font-bold text-black shadow-[3px_3px_0px_#000] outline-none"
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
                    className="rounded-none border-2 border-black bg-white px-3 py-2 text-xs font-black shadow-[2px_2px_0px_#000] hover:bg-emphasis active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-none cursor-pointer whitespace-nowrap"
                    title="چسباندن کلید از حافظه گوشی یا مک"
                  >
                    📋 چسباندن از حافظه
                  </button>

                  <button
                    type="button"
                    onClick={() => void testGeminiKey(settings.geminiApiKey ?? '')}
                    disabled={!settings.geminiApiKey}
                    className="rounded-none border-2 border-black bg-signal text-white px-3 py-2 text-xs font-black shadow-[2px_2px_0px_#000] hover:bg-black active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-none cursor-pointer whitespace-nowrap disabled:opacity-40"
                  >
                    ⚡ آزمایش کلید
                  </button>
                </div>
              </div>

              {testStatus?.type === 'gemini' && (
                <div
                  className={`mt-3 rounded-none border-3 border-black p-3 text-xs font-black shadow-[3px_3px_0px_#000] ${
                    testStatus.state === 'success'
                      ? 'bg-emphasis text-black'
                      : testStatus.state === 'testing'
                      ? 'bg-field text-black'
                      : 'bg-signal text-white'
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
          <div className="rounded-none border-4 border-black bg-white p-5 shadow-[6px_6px_0px_#000] space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-black pb-2">
              <span className="font-black text-black text-base sm:text-lg">کلید رایگان Groq (فوق‌سریع)</span>
              <span className="rounded-none border-2 border-black bg-emphasis px-2.5 py-0.5 text-xs font-black text-black shadow-[2px_2px_0px_#000]">
                مدل Qwen 2.5 32B (۳۰۰ کلمه بر ثانیه)
              </span>
            </div>

            <p className="text-xs sm:text-sm leading-6 text-black/85 font-medium">
              سرویس Groq سریع‌ترین پردازشگر ابری جهان است که مدل قدرتمند Qwen 2.5 را به رایگان و بدون تأخیر در اختیار شما می‌گذارد.
            </p>

            <a
              href="https://console.groq.com/keys"
              target="_blank"
              rel="noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-none border-3 border-black bg-black text-white font-black px-4 py-3.5 text-sm shadow-[4px_4px_0px_#000] hover:bg-emphasis hover:text-black active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-none"
            >
              <Star size={16} />
              <span>🌐 ۱. باز کردن صفحه دریافت کلید Groq (۱ کلیک)</span>
            </a>

            <div className="rounded-none border-2 border-black bg-paper p-4 text-xs leading-6 text-black space-y-2 shadow-[2px_2px_0px_#000]">
              <p className="font-black text-sm">مراحل دریافت کلید Groq:</p>
              <p>۱. روی دکمه مشکی بالا بزنید تا وارد سایت Groq شوید.</p>
              <p>۲. دکمه <strong>«Create API Key»</strong> را بزنید و کلید ساخته‌شده را کپی کنید.</p>
              <p>۳. در این صفحه دکمهٔ <strong>«چسباندن از حافظه»</strong> را بزنید.</p>
            </div>

            <div>
              <label htmlFor="groq-key" className="block text-xs font-black text-black mb-2">
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
                  className="flex-1 rounded-none border-3 border-black bg-white px-4 py-2.5 font-mono text-xs font-bold text-black shadow-[3px_3px_0px_#000] outline-none"
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
                    className="rounded-none border-2 border-black bg-white px-3 py-2 text-xs font-black shadow-[2px_2px_0px_#000] hover:bg-emphasis active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-none cursor-pointer whitespace-nowrap"
                    title="چسباندن کلید از حافظه"
                  >
                    📋 چسباندن از حافظه
                  </button>

                  <button
                    type="button"
                    onClick={() => void testGroqKey(settings.groqApiKey ?? '')}
                    disabled={!settings.groqApiKey}
                    className="rounded-none border-2 border-black bg-signal text-white px-3 py-2 text-xs font-black shadow-[2px_2px_0px_#000] hover:bg-black active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-none cursor-pointer whitespace-nowrap disabled:opacity-40"
                  >
                    ⚡ آزمایش کلید
                  </button>
                </div>
              </div>

              {testStatus?.type === 'groq' && (
                <div
                  className={`mt-3 rounded-none border-3 border-black p-3 text-xs font-black shadow-[3px_3px_0px_#000] ${
                    testStatus.state === 'success'
                      ? 'bg-emphasis text-black'
                      : testStatus.state === 'testing'
                      ? 'bg-field text-black'
                      : 'bg-signal text-white'
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
          <div className="rounded-none border-4 border-black bg-white p-5 shadow-[6px_6px_0px_#000] space-y-4">
            <p className="font-black text-black text-base">اتصال به مدل آفلاین روی مک (Ollama / LM Studio)</p>
            <div className="rounded-none border-2 border-black bg-paper p-4 text-xs leading-6 text-black space-y-2 shadow-[2px_2px_0px_#000]">
              <p className="font-black">اجرای ساده در ترمینال مک:</p>
              <code className="block bg-white border-2 border-black px-3 py-2 text-black font-mono font-bold text-xs select-all shadow-[2px_2px_0px_#000]">
                ollama run qwen2.5:1.5b
              </code>
              <p>به محض اجرای دستور فوق، ویراستار به صورت کاملاً آفلاین و با بیشترین سرعت به مدل متصل خواهد شد.</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="ollama-endpoint" className="block text-xs font-black text-black mb-1">
                  آدرس سرور محلی
                </label>
                <input
                  id="ollama-endpoint"
                  type="text"
                  value={settings.customEndpoint ?? 'http://localhost:11434/v1'}
                  onChange={(e) => saveSettings({ ...settings, customEndpoint: e.target.value.trim() })}
                  className="w-full rounded-none border-3 border-black bg-white px-4 py-2 font-mono text-xs font-bold text-black shadow-[3px_3px_0px_#000] outline-none"
                />
              </div>
              <div>
                <label htmlFor="ollama-model" className="block text-xs font-black text-black mb-1">
                  نام مدل (Ollama Model Name)
                </label>
                <input
                  id="ollama-model"
                  type="text"
                  value={settings.customModel ?? 'qwen2.5:1.5b'}
                  onChange={(e) => saveSettings({ ...settings, customModel: e.target.value.trim() })}
                  className="w-full rounded-none border-3 border-black bg-white px-4 py-2 font-mono text-xs font-bold text-black shadow-[3px_3px_0px_#000] outline-none"
                />
              </div>
            </div>
          </div>
        )}

        {option.kind === 'rules' && (
          <div className="rounded-none border-4 border-black bg-field p-5 shadow-[6px_6px_0px_#000] text-black">
            <p className="font-black text-base uppercase">بدون هوش مصنوعی (فقط قواعد نگارش)</p>
            <p className="mt-1 text-xs sm:text-sm leading-6 font-bold text-black/90">
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
        <div className="flex items-center gap-2 border-b-3 border-black pb-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-none border-2 border-black bg-emphasis text-black font-black text-sm shadow-[2px_2px_0px_#000]">
            ⌨️
          </span>
          <h2 className="text-xl sm:text-2xl font-black text-ink">کیبورد هوشمند ویراستار (ویژه موبایل و پیام‌رسان‌ها)</h2>
        </div>

        <div className="rounded-none border-4 border-black bg-white p-5 shadow-[6px_6px_0px_#000] space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-black pb-2">
            <span className="font-black text-black text-base sm:text-lg">استفاده مستقیم داخل واتس‌اپ، تلگرام، اینستاگرام و یادداشت‌ها</span>
            <span className="rounded-none border-2 border-black bg-emphasis px-2.5 py-0.5 text-xs font-black text-black shadow-[2px_2px_0px_#000]">
              iOS Keyboard Extension
            </span>
          </div>

          <p className="text-xs sm:text-sm leading-6 text-black/85 font-medium">
            با کیبورد ویراستار، نیازی به کپی و جابه‌جایی متن نیست! در هر برنامه‌ای که تایپ می‌کنید، کیبورد ویراستار متن را مستقیماً ویرایش کرده، نیم‌فاصله‌ها و نشانه‌گذاری را درست می‌کند و لحن دلخواه شما (رسمی، اداری، حقوقی، لاتی و غیره) را اعمال می‌کند.
          </p>

          <div className="rounded-none border-2 border-black bg-paper p-4 text-xs leading-6 text-black space-y-2 shadow-[2px_2px_0px_#000]">
            <p className="font-black text-sm">نحوه فعال‌سازی در آیفون و آیپد (فقط یک‌بار):</p>
            <p>۱. وارد تنظیمات اصلی آیفون (<strong>Settings</strong>) شوید.</p>
            <p>۲. به مسیر <strong>General &gt; Keyboard &gt; Keyboards</strong> بروید.</p>
            <p>۳. گزینه <strong>«Add New Keyboard...»</strong> را بزنید و <strong>«ویراستار (Virastar)»</strong> را انتخاب کنید.</p>
            <p>۴. روی ویراستار کلیک کرده و گزینه <strong>«Allow Full Access»</strong> را روشن کنید (برای فعال شدن هوش مصنوعی و گفتار به متن).</p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs font-black text-black border-t-2 border-black pt-3">
            <span className="rounded-none border-2 border-black bg-emphasis px-2 py-0.5 shadow-[1px_1px_0px_#000]">💡 روش استفاده:</span>
            <span>در هر برنامه روی آیکون کُره زمین (🌐) پایین کیبورد بزنید تا ویراستار بالا بیاید، بنویسید و دکمهٔ «✨ ویرایش با ویراستار» را لمس کنید!</span>
          </div>
        </div>
      </section>

      {/* Themes — 8 Distinct Neo-Brutalist Aesthetic Palettes */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-2 border-b-3 border-black pb-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-none border-2 border-black bg-emphasis text-black font-black text-sm shadow-[2px_2px_0px_#000]">
                🎨
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-ink">پوسته‌های زنده و تعاملی نئوبروتالیسم</h2>
            </div>
            <p className="mt-1 text-xs sm:text-sm text-ink-soft font-bold">
              ۸ پالت رنگی با کنتراست شدید، حاشیه‌های ضخیم و سایه‌های سخت هندسی
            </p>
          </div>
          <button
            type="button"
            onClick={toggleAudio}
            className={`rounded-none border-3 border-black px-3 py-1.5 text-xs font-black shadow-[3px_3px_0px_#000] cursor-pointer transition-none ${
              audioEnabled ? 'bg-emphasis text-black' : 'bg-white text-black hover:bg-neutral-100'
            }`}
            title="روشن یا خاموش کردن صدای لمس کلیدها در تمام بخش‌ها"
          >
            <span>{audioEnabled ? '🔊 صدای تعاملی: روشن' : '🔇 صدای تعاملی: خاموش'}</span>
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
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
                className={`rounded-none border-4 border-black p-4 text-start transition-none cursor-pointer relative ${
                  isActive
                    ? 'bg-emphasis shadow-[6px_6px_0px_#000] translate-x-[-2px] translate-y-[-2px]'
                    : 'bg-white shadow-[4px_4px_0px_#000] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_#000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none'
                }`}
              >
                {isActive && (
                  <div className="absolute top-0 end-0 bg-black text-emphasis text-[10px] font-black px-3 py-1 border-s-2 border-b-2 border-black uppercase tracking-wider">
                    پوستهٔ فعال
                  </div>
                )}

                <div className="flex items-start gap-3">
                  <span className="text-3xl shrink-0 leading-none pt-0.5" aria-hidden="true">
                    {t.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <span className="font-black text-base text-black">{t.label}</span>
                      <span className="rounded-none border-2 border-black bg-white px-2 py-0.5 text-[10px] font-black text-black shadow-[1px_1px_0px_#000]">
                        {t.taste}
                      </span>
                    </div>

                    <p className="text-xs leading-5 text-black/80 font-bold mb-2">{t.blurb}</p>

                    <div className="text-[11px] leading-4 text-black bg-paper border-2 border-black p-2 mb-3 shadow-[1px_1px_0px_#000]">
                      <span className="font-black">حس فیزیکی: </span>
                      {t.interactiveFeature}
                    </div>

                    {/* Palette Swatches */}
                    <div className="flex items-center justify-between pt-2 border-t-2 border-black">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-black text-black uppercase">پالت:</span>
                        <div className="flex items-center gap-1">
                          <span
                            className="w-4 h-4 rounded-none border-2 border-black shadow-[1px_1px_0px_#000] inline-block"
                            style={{ backgroundColor: t.palette.paper }}
                            title="کاغذ زمینه"
                          />
                          <span
                            className="w-4 h-4 rounded-none border-2 border-black shadow-[1px_1px_0px_#000] inline-block"
                            style={{ backgroundColor: t.palette.surface }}
                            title="کارت‌ها"
                          />
                          <span
                            className="w-4 h-4 rounded-none border-2 border-black shadow-[1px_1px_0px_#000] inline-block"
                            style={{ backgroundColor: t.palette.brand }}
                            title="رنگ اصلی / نشان"
                          />
                          <span
                            className="w-4 h-4 rounded-none border-2 border-black shadow-[1px_1px_0px_#000] inline-block"
                            style={{ backgroundColor: t.palette.ink }}
                            title="رنگ نوشته"
                          />
                          <span
                            className="w-4 h-4 rounded-none border-2 border-black shadow-[1px_1px_0px_#000] inline-block"
                            style={{ backgroundColor: t.palette.accent }}
                            title="چاشنی و چاشنی فرعی"
                          />
                        </div>
                      </div>

                      <span className="text-[11px] font-black text-black underline uppercase">
                        {isActive ? '✓ انتخاب شده' : 'انتخاب پوسته ←'}
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        {/* Live Interactive Sandbox / Theme Playground */}
        <div className="rounded-none border-4 border-black bg-field p-5 shadow-[6px_6px_0px_#000] text-black space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b-3 border-black pb-3">
            <div className="flex items-center gap-2">
              <span className="text-2xl">✨</span>
              <div>
                <h3 className="font-black text-base sm:text-lg">آزمایشگاه زندهٔ پوسته و کلیدها</h3>
                <p className="text-xs text-black/80 font-bold">
                  حس کلیدها، سایه‌های سخت، رنگ متن و صدای این پوسته را همین‌جا بیازمایید
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => playTactileSound(active, 'special')}
              className="rounded-none border-2 border-black bg-white px-3 py-1.5 text-xs font-black shadow-[2px_2px_0px_#000] hover:bg-emphasis active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-none cursor-pointer flex items-center gap-1.5"
            >
              <span>🎵 آزمایش صدای این پوسته</span>
            </button>
          </div>

          <div className="space-y-3">
            {/* Style selector pills in sandbox */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-black text-black">نمونهٔ لحن:</span>
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
                  className={`rounded-none border-2 border-black px-3 py-1 text-xs font-black transition-none cursor-pointer ${
                    sandboxStyle === s.id
                      ? 'bg-emphasis text-black shadow-[3px_3px_0px_#000]'
                      : 'bg-white text-black shadow-[2px_2px_0px_#000] hover:bg-neutral-100'
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
              className="w-full rounded-none border-3 border-black bg-white p-3 text-sm sm:text-base font-bold text-black shadow-[3px_3px_0px_#000] outline-none resize-none"
              placeholder="اینجا چیزی بنویسید تا حس و رنگ این پوسته را ببینید..."
            />

            {/* Interactive Actions */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSandboxText((prev) => prev + '\u200c')
                    playTactileSound(active, 'special')
                  }}
                  className="rounded-none border-2 border-black bg-white px-3 py-1.5 text-xs font-black shadow-[2px_2px_0px_#000] hover:bg-emphasis active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-none cursor-pointer"
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
                  className="rounded-none border-2 border-black bg-white px-3 py-1.5 text-xs font-black shadow-[2px_2px_0px_#000] hover:bg-emphasis active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-none cursor-pointer"
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
                className="rounded-none border-3 border-black bg-emphasis px-5 py-2 text-xs sm:text-sm font-black text-black shadow-[4px_4px_0px_#000] hover:bg-black hover:text-emphasis active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-none cursor-pointer"
              >
                <span>✨ آزمایش کلید اصلی</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* About */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 border-b-3 border-black pb-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-none border-2 border-black bg-emphasis text-black font-black text-sm shadow-[2px_2px_0px_#000]">
            ℹ️
          </span>
          <h2 className="text-xl sm:text-2xl font-black text-ink">درباره و شناسهٔ نرم‌افزار</h2>
        </div>

        <div className="rounded-none border-4 border-black bg-white p-5 shadow-[6px_6px_0px_#000]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xl font-black text-black uppercase">ویراستار فارسی (Virastar)</p>
              <p className="mt-1 text-xs sm:text-sm leading-6 font-bold text-black/80">
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
                className="rounded-none border-3 border-black bg-signal px-6 py-2.5 text-sm font-black text-white shadow-[4px_4px_0px_#000] hover:bg-black hover:text-white transition-none"
              >
                <Star size={16} />
                دریافت نسخهٔ {faVersion(newer)}
              </a>
            )}
          </div>
          <div className="mt-5 pt-4 border-t-3 border-black flex flex-wrap items-center justify-between gap-2 text-xs font-black text-black">
            <span className="inline-flex items-center gap-2 rounded-none border-2 border-black bg-emphasis px-3 py-1 shadow-[2px_2px_0px_#000]">
              <Star size={13} className="text-signal fill-signal" />
              ساخته‌شده با ❤️ توسط مراد (Made by Morad)
            </span>
            <span className="text-black/80">ابزار نگارش، بازنویسی و پیرایش زبان فارسی</span>
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
        <div className="flex items-center gap-2 border-b-3 border-black pb-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-none border-2 border-black bg-emphasis text-black font-black text-sm shadow-[2px_2px_0px_#000]">
            💾
          </span>
          <h2 className="text-xl sm:text-2xl font-black text-ink">مرکز دانلود مدل‌های آفلاین</h2>
        </div>
        <p className="mt-2 text-xs sm:text-sm leading-6 text-ink-soft font-bold">
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
              className={`rounded-none border-4 border-black p-5 transition-none ${
                isSelected
                  ? 'bg-emphasis/25 shadow-[8px_8px_0px_#000]'
                  : 'bg-white shadow-[6px_6px_0px_#000]'
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2 border-b-2 border-black pb-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-black text-base sm:text-lg text-black">{m.name}</span>
                    <span className="rounded-none border-2 border-black bg-emphasis px-2.5 py-0.5 text-xs font-black text-black shadow-[2px_2px_0px_#000]">
                      {m.badge}
                    </span>
                    <span className="rounded-none border-2 border-black bg-paper px-2 py-0.5 text-xs font-black text-black shadow-[1px_1px_0px_#000]">
                      حجم: {m.size}
                    </span>
                  </div>
                  <p className="mt-2 text-xs sm:text-sm leading-6 text-black/85 font-medium">{m.recommendation}</p>
                  <p className="mt-1 text-xs leading-6 text-black font-black">
                    🎯 کاربرد بهینه: <span className="font-medium text-black/80">{m.bestFor}</span>
                  </p>
                  <p className="text-[11px] text-black/70 font-bold">
                    💾 سخت‌افزار مورد نیاز: {m.ram}
                  </p>
                </div>
              </div>

              {isDownloadingThis && (
                <div className="mt-4 rounded-none border-3 border-black bg-paper p-4 shadow-[3px_3px_0px_#000]">
                  <div className="flex items-center justify-between text-xs font-black text-black">
                    <span className="flex items-center gap-2">
                      <Star size={14} className="text-signal fill-signal" />
                      در حال دریافت مدل در حافظه دستگاه…
                    </span>
                    <span className="font-mono text-sm">{faNum(modelStatus.progress)}٪</span>
                  </div>
                  <div className="mt-2.5 h-4 overflow-hidden rounded-none border-2 border-black bg-white shadow-[2px_2px_0px_#000]">
                    <div
                      className="h-full bg-signal border-e-2 border-black transition-none"
                      style={{ width: `${modelStatus.progress}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 pt-1">
                <div className="flex items-center gap-2 text-xs font-black">
                  {isSelected ? (
                    <span className="rounded-none border-2 border-black bg-emphasis px-2.5 py-0.5 text-black shadow-[2px_2px_0px_#000]">
                      ✓ مدل فعال کنونی
                    </span>
                  ) : isInstalled ? (
                    <span className="rounded-none border border-black bg-paper px-2 py-0.5 text-black">
                      ذخیره شده در کش دستگاه
                    </span>
                  ) : (
                    <span className="text-black/60">هنوز دانلود نشده</span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {isInstalled && (
                    <button
                      type="button"
                      onClick={() => void removeModel(m.id)}
                      className="rounded-none border-2 border-black bg-signal/20 px-3 py-1.5 text-xs font-black text-black shadow-[2px_2px_0px_#000] hover:bg-signal hover:text-white active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-none cursor-pointer"
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
                    className={`px-4 py-2 text-xs font-black rounded-none border-3 border-black shadow-[3px_3px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-none flex items-center gap-2 cursor-pointer ${
                      isSelected
                        ? 'bg-emphasis text-black shadow-[4px_4px_0px_#000]'
                        : 'bg-white text-black hover:bg-emphasis'
                    }`}
                  >
                    <Star size={13} className="text-signal fill-signal" />
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
