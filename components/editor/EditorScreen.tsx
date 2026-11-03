'use client'

import { useEffect, useRef, useState } from 'react'
import { MODES, getMode, type WritingMode } from '@/domain/modes'
import { runEdit, type EditResult } from '@/domain/engine'
import { restoreModel } from '@/domain/engines/browser'
import { useSettings } from '@/hooks/useSettings'
import { useHistory } from '@/hooks/useHistory'
import { useDictation } from '@/hooks/useDictation'
import { useActiveTheme } from '@/hooks/useActiveTheme'
import { playTactileSound } from '@/domain/audioFeedback'
import { clearDraft, readDraft } from '@/services/draft'
import { Star } from '../Star'
import { ModeGlyph } from './ModeGlyph'
import { CheckGlyph, CopyGlyph, MicGlyph, SaveGlyph, ShareGlyph } from '../Glyphs'
import { PersianKeyboard } from './PersianKeyboard'

const PROMPT_SUGGESTIONS = [
  {
    title: 'نامه به مدیریت',
    modeId: 'edari',
    text: 'سلام آقای مدیر میخواستم برای هفته بعد سه شنبه و چهارشنبه مرخصی بگیرم کار شخصی دارم اگه ممکنه موافقت کنین ممنون.',
  },
  {
    title: 'پیام رسمی به استاد',
    modeId: 'rasmi',
    text: 'استاد سلام خسته نباشین من پروژه درسیتون رو ایمیل کردم دیدینش؟ کی نمره‌ها رو میدین؟ مرسی.',
  },
  {
    title: 'لایحه اعتراضی حقوقی',
    modeId: 'hoghooghi',
    text: 'رای دادگاه اصلا عادلانه نیست مدارک من دیده نشده و من به این حکم اعتراض دارم لطفا پرونده دوباره بررسی بشه.',
  },
  {
    title: 'چت دوستانه با رفیق',
    modeId: 'khodemani',
    text: 'سلام کجایی پسر خبری ازت نیست بیا فردا بریم بیرون یه قهوه‌ای بخوریم حرف بزنیم دلم برات تنگ شده.',
  },
]

function faNum(n: number): string {
  return n.toLocaleString('fa-IR')
}

function countWords(s: string): number {
  const m = s.match(/[؀-ۿ][؀-ۿ‌]*/g)
  return m ? m.length : 0
}

export function EditorScreen({ initialMode }: { initialMode?: string }) {
  const [modeId, setModeId] = useState<string>(initialMode ?? 'tashih')
  const [qalamdanCategory, setQalamdanCategory] = useState<'divan' | 'adab' | 'kooche'>('divan')
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<EditResult | null>(null)
  const [liveOutput, setLiveOutput] = useState('')
  const [copied, setCopied] = useState(false)
  const [saved, setSaved] = useState(false)
  const [showDiff, setShowDiff] = useState(false)
  const [showKeyboard, setShowKeyboard] = useState(false)
  const [zenMode, setZenMode] = useState(false)
  const activeTheme = useActiveTheme()
  const [settings] = useSettings()
  const { add } = useHistory()
  const resultRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const dictation = useDictation('fa-IR')
  const anchorRef = useRef<{ before: string; after: string } | null>(null)

  function insertAtCursor(text: string) {
    playTactileSound(activeTheme, text === '\u200c' ? 'special' : 'tap')
    const el = inputRef.current
    if (!el) {
      setInput((prev) => prev + text)
      return
    }
    const start = el.selectionStart
    const end = el.selectionEnd
    const val = el.value
    const next = val.substring(0, start) + text + val.substring(end)
    setInput(next)
    requestAnimationFrame(() => {
      el.focus()
      const newPos = start + text.length
      el.setSelectionRange(newPos, newPos)
    })
  }

  function backspaceAtCursor() {
    playTactileSound(activeTheme, 'tap')
    const el = inputRef.current
    if (!el) {
      setInput((prev) => prev.slice(0, -1))
      return
    }
    const start = el.selectionStart
    const end = el.selectionEnd
    const val = el.value
    if (start === end) {
      if (start > 0) {
        const next = val.substring(0, start - 1) + val.substring(end)
        setInput(next)
        requestAnimationFrame(() => {
          el.focus()
          el.setSelectionRange(start - 1, start - 1)
        })
      }
    } else {
      const next = val.substring(0, start) + val.substring(end)
      setInput(next)
      requestAnimationFrame(() => {
        el.focus()
        el.setSelectionRange(start, start)
      })
    }
  }

  const mode = getMode(modeId)
  const words = countWords(input)
  const readTimeMinutes = Math.max(1, Math.ceil(words / 200))

  useEffect(() => {
    if (initialMode && getMode(initialMode)) {
      setModeId(initialMode)
    }
  }, [initialMode])

  // Global keyboard shortcuts (⌘+Enter for edit, ⌘+⇧+C for copy)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault()
        handleEdit()
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'c' || e.key === 'C')) {
        if (result?.output) {
          e.preventDefault()
          handleCopy()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // Pick up a handed-off text (from history) when the editor opens fresh.
  useEffect(() => {
    const draft = readDraft()
    if (draft && !input) {
      setInput(draft.input)
      setModeId(draft.modeId)
      clearDraft()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleEdit() {
    const text = input.trim()
    if (!text || busy) return
    playTactileSound(activeTheme, 'action')
    setBusy(true)
    setCopied(false)
    setSaved(false)
    setLiveOutput('')

    try {
      const res = await runEdit(text, modeId, settings, (chunk) => {
        setLiveOutput((prev) => prev + chunk)
      })
      setResult(res)
      playTactileSound(activeTheme, 'special')
      requestAnimationFrame(() => {
        resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      })
    } catch (err) {
      console.error('Edit error:', err)
    } finally {
      setBusy(false)
    }
  }

  function handleClear() {
    playTactileSound(activeTheme, 'tap')
    setInput('')
    setResult(null)
    setLiveOutput('')
  }

  async function handlePaste() {
    try {
      const text = await navigator.clipboard.readText()
      if (text) {
        insertAtCursor(text)
        playTactileSound(activeTheme, 'tap')
      }
    } catch {
      // Clipboard denied
    }
  }

  async function handleCopy() {
    if (!result?.output) return
    playTactileSound(activeTheme, 'special')
    const ok = await copyText(result.output)
    if (ok) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2200)
    }
  }

  function handleSave() {
    if (!result) return
    playTactileSound(activeTheme, 'special')
    add({
      input,
      output: result.output,
      modeId,
      engine: result.engine,
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2200)
  }

  function handleShare() {
    if (!result?.output) return
    playTactileSound(activeTheme, 'special')
    if (navigator.share) {
      navigator.share({
        title: `ویراستار — پیرایش به سبک ${mode.label}`,
        text: result.output,
      }).catch(() => {})
    } else {
      handleCopy()
    }
  }

  function toggleDictation() {
    playTactileSound(activeTheme, 'special')
    if (dictation.listening) {
      dictation.stop()
      anchorRef.current = null
      return
    }
    const el = inputRef.current
    if (el) {
      const start = el.selectionStart
      const end = el.selectionEnd
      const val = el.value
      anchorRef.current = {
        before: val.substring(0, start),
        after: val.substring(end),
      }
    } else {
      anchorRef.current = { before: input, after: '' }
    }
    dictation.start((transcript) => {
      const anchor = anchorRef.current
      if (!anchor) {
        setInput(transcript)
        return
      }
      const spacer = anchor.before && !anchor.before.endsWith(' ') ? ' ' : ''
      setInput(anchor.before + spacer + transcript + anchor.after)
    })
  }

  // Filter drawer modes
  const drawerModes = MODES.filter((m) => {
    if (qalamdanCategory === 'divan') {
      return ['tashih', 'rasmi', 'edari', 'hoghooghi', 'divani'].includes(m.id)
    }
    if (qalamdanCategory === 'adab') {
      return ['adabi', 'daneshgahi', 'shaerane'].includes(m.id)
    }
    return ['khodemani', 'lati', 'taarofi', 'pachekhari', 'genz'].includes(m.id)
  })

  return (
    <div className={`space-y-6 transition-all duration-300 ${zenMode ? 'max-w-4xl mx-auto' : ''}`}>
      {/* Zen Mode Bar */}
      <div className="flex items-center justify-between border-b border-border/50 pb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-black text-ink">میز تحریر ویراستار</span>
          <span className="text-xs text-ink-soft hidden sm:inline-block">· کارگاه پیرایش و بازآفرینی زبان فارسی</span>
        </div>

        <button
          type="button"
          onClick={() => {
            setZenMode(!zenMode)
            playTactileSound(activeTheme, 'tap')
          }}
          className={`v-btn-ghost text-xs px-3 py-1 flex items-center gap-1.5 transition-all ${
            zenMode ? 'bg-brand text-on-brand border-brand' : ''
          }`}
          title="حالت خلوت: کم‌رنگ کردن عناصر اضافی برای تمرکز صددرصدی بر نوشتن"
        >
          <span>{zenMode ? '🪶 خروج از خلوت' : '🪶 حالت خلوت و تمرکز'}</span>
        </button>
      </div>

      {/* The Calligrapher's Stylus Chest (قلم‌دان سبک‌های نگارش) */}
      {!zenMode && (
        <section className="v-qalamdan p-4 sm:p-5 animate-fade-up">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <span className="text-lg">🎨</span>
              <span className="font-black text-sm sm:text-base text-ink">
                قلم‌دان سبک‌های نگارش ({faNum(MODES.length)} لحنِ زنده)
              </span>
            </div>

            {/* Qalamdan Drawer Tabs */}
            <div className="flex items-center gap-1 bg-paper p-1 rounded-xl border border-border">
              <button
                type="button"
                onClick={() => {
                  setQalamdanCategory('divan')
                  playTactileSound(activeTheme, 'tap')
                }}
                className={`px-3 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                  qalamdanCategory === 'divan' ? 'bg-brand text-on-brand shadow-xs' : 'text-ink-soft hover:text-ink'
                }`}
              >
                دیوان و دفتر (اداری)
              </button>
              <button
                type="button"
                onClick={() => {
                  setQalamdanCategory('adab')
                  playTactileSound(activeTheme, 'tap')
                }}
                className={`px-3 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                  qalamdanCategory === 'adab' ? 'bg-brand text-on-brand shadow-xs' : 'text-ink-soft hover:text-ink'
                }`}
              >
                ادبستان و شعر
              </button>
              <button
                type="button"
                onClick={() => {
                  setQalamdanCategory('kooche')
                  playTactileSound(activeTheme, 'tap')
                }}
                className={`px-3 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                  qalamdanCategory === 'kooche' ? 'bg-brand text-on-brand shadow-xs' : 'text-ink-soft hover:text-ink'
                }`}
              >
                کوچه و بازار (طنز)
              </button>
            </div>
          </div>

          {/* Drawer Grid */}
          <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 md:grid-cols-5">
            {drawerModes.map((m) => {
              const isActive = m.id === modeId
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    setModeId(m.id)
                    playTactileSound(activeTheme, 'tap')
                  }}
                  className={`flex flex-col items-start p-2.5 rounded-xl text-start transition-all cursor-pointer border ${
                    isActive
                      ? 'bg-brand text-on-brand border-brand shadow-md scale-[1.02]'
                      : 'bg-paper text-ink border-border/80 hover:border-brand/40 hover:bg-paper-deep/60'
                  }`}
                >
                  <div className="flex items-center gap-1.5 w-full mb-1">
                    <ModeGlyph modeId={m.id} size={16} className={isActive ? 'text-on-brand' : 'text-brand'} />
                    <span className="font-black text-xs truncate">{m.label}</span>
                  </div>
                  <span className={`text-[10px] leading-4 line-clamp-1 ${isActive ? 'text-on-brand/80' : 'text-ink-soft'}`}>
                    {m.tagline}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Active Style Explainer Banner */}
          <div className="mt-3 pt-3 border-t border-border/60 flex flex-wrap items-center justify-between gap-2 text-xs">
            <p className="text-ink-soft">
              لحن فعال: <strong className="text-ink font-black">{mode.label}</strong> — {mode.description}
            </p>
            <button
              type="button"
              onClick={() => {
                const sample = PROMPT_SUGGESTIONS.find((s) => s.modeId === modeId) ?? PROMPT_SUGGESTIONS[0]
                setInput(sample.text)
                playTactileSound(activeTheme, 'special')
              }}
              className="text-brand font-black hover:underline cursor-pointer flex items-center gap-1"
            >
              <span>✨ درج متن نمونه برای این لحن</span>
            </button>
          </div>
        </section>
      )}

      {/* The Dual-Leaf Writing Desk (میز دوبرگی نگارش) */}
      <div className="grid gap-6 lg:grid-cols-2 items-start">
        {/* Leaf 1: Author's Draft (برگ یکم: پیش‌نویس مؤلف) */}
        <section className="v-folio flex flex-col overflow-hidden shadow-card">
          {/* Folio Masthead */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-border/70 bg-paper/50">
            <div className="flex items-center gap-2">
              <span className="text-base">📜</span>
              <span className="font-black text-xs sm:text-sm text-ink">برگ یکم: پیش‌نویس مؤلف</span>
              <span className="text-[11px] font-bold text-ink-soft">
                ({faNum(words)} واژه · {faNum(input.length)} نویسه)
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handlePaste}
                className="v-btn-ghost px-2.5 py-1 text-xs"
                title="جای‌گذاری متن از حافظه"
              >
                📋 چسباندن
              </button>
              {input && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="v-btn-ghost px-2 py-1 text-xs text-red-700 hover:text-red-800"
                  title="پاک کردن تمام متن"
                >
                  پاک کردن
                </button>
              )}
            </div>
          </div>

          {/* Text Area */}
          <div className="relative p-4 sm:p-5 flex-1 min-h-[280px] sm:min-h-[340px] flex flex-col">
            <textarea
              id="virastar-input"
              ref={inputRef}
              dir="rtl"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="اینجا بنویسید… هر نوشته‌ای، از پیام‌های کاری تا مقالات، نامه‌های رسمی یا دست‌نوشته‌های شخصی"
              className="w-full flex-1 bg-transparent text-base sm:text-lg leading-8 sm:leading-9 outline-none resize-none text-ink font-medium placeholder:text-ink-soft/40"
            />

            {/* Empty Desk Quick Inspiration Prompts */}
            {!input && (
              <div className="mt-4 pt-4 border-t border-dashed border-border/70">
                <p className="text-[11px] font-extrabold text-ink-soft mb-2.5">
                  یا با یکی از این نمونه‌های واقعی آغاز کنید:
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {PROMPT_SUGGESTIONS.map((item, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setInput(item.text)
                        setModeId(item.modeId)
                        playTactileSound(activeTheme, 'special')
                      }}
                      className="p-2.5 rounded-xl bg-paper/60 border border-border/80 text-start hover:border-brand/50 hover:bg-paper transition-all cursor-pointer"
                    >
                      <span className="block text-xs font-black text-ink mb-0.5">{item.title}</span>
                      <span className="block text-[11px] text-ink-soft line-clamp-1">{item.text}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Drafting Ruler Toolbar Docked Seamlessly to Folio Foot */}
          <div className="v-ruler-toolbar p-2.5 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1">
              <button
                type="button"
                onClick={() => insertAtCursor('\u200c')}
                className="rounded-lg bg-paper px-3 py-1.5 text-xs font-black text-brand border border-brand/30 hover:bg-brand/10 transition-colors shadow-xs"
                title="نیم‌فاصله استاندارد فارسی (Shift+Space)"
              >
                نیم‌فاصله
              </button>
              <button
                type="button"
                onClick={() => insertAtCursor('«»')}
                className="rounded-lg bg-paper px-2.5 py-1.5 text-xs font-black text-ink border border-border hover:border-brand"
                title="گیومه فارسی"
              >
                « »
              </button>
              <button
                type="button"
                onClick={() => insertAtCursor('،')}
                className="rounded-lg bg-paper px-2 py-1.5 text-xs font-black text-ink border border-border hover:border-brand"
                title="ویرگول فارسی"
              >
                ،
              </button>
              <button
                type="button"
                onClick={() => insertAtCursor('؛')}
                className="rounded-lg bg-paper px-2 py-1.5 text-xs font-black text-ink border border-border hover:border-brand"
                title="نقطه‌ویرگول فارسی"
              >
                ؛
              </button>
              <button
                type="button"
                onClick={() => insertAtCursor('؟')}
                className="rounded-lg bg-paper px-2 py-1.5 text-xs font-black text-ink border border-border hover:border-brand"
                title="علامت سوال فارسی"
              >
                ؟
              </button>
              <button
                type="button"
                onClick={() => insertAtCursor('.')}
                className="rounded-lg bg-paper px-2 py-1.5 text-xs font-black text-ink border border-border hover:border-brand"
                title="نقطه پایان جمله"
              >
                .
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              {dictation.supported && (
                <button
                  type="button"
                  onClick={toggleDictation}
                  aria-pressed={dictation.listening}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-black flex items-center gap-1.5 transition-all border ${
                    dictation.listening
                      ? 'bg-red-600 text-white border-red-700 animate-pulse'
                      : 'bg-paper text-ink border-border hover:border-brand'
                  }`}
                  title="تقریر گفتاری با هوش مصنوعی"
                >
                  <MicGlyph size={15} />
                  <span>{dictation.listening ? 'گوش می‌کنم…' : 'تقریر'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setShowKeyboard(!showKeyboard)
                  playTactileSound(activeTheme, 'special')
                }}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-black flex items-center gap-1.5 transition-all border ${
                  showKeyboard
                    ? 'bg-brand text-on-brand border-brand'
                    : 'bg-paper text-ink border-border hover:border-brand'
                }`}
              >
                <span>⌨️</span>
                <span>{showKeyboard ? 'بستن' : 'کیبورد'}</span>
              </button>
            </div>
          </div>

          {/* Virtual Keyboard Drawer if opened */}
          {showKeyboard && (
            <div className="p-3 border-t border-border bg-paper-deep/80">
              <PersianKeyboard
                onInsert={insertAtCursor}
                onBackspace={backspaceAtCursor}
                onHalfSpace={() => insertAtCursor('\u200c')}
                onNewLine={() => insertAtCursor('\n')}
                onClose={() => setShowKeyboard(false)}
              />
            </div>
          )}
        </section>

        {/* Leaf 2: Refined Master Copy & Action Desk (برگ دوم: نسخهٔ پیراستهٔ ویراستار) */}
        <section className="flex flex-col gap-4">
          {/* Master Seal Action Button */}
          <div className="flex items-center justify-between gap-3 bg-paper p-3 rounded-2xl border border-border/80 shadow-xs">
            <button
              type="button"
              onClick={handleEdit}
              disabled={busy || !input.trim()}
              className="v-seal-master flex-1 justify-center"
            >
              {busy ? (
                <>
                  <Star size={20} className="animate-star-busy" />
                  <span>در حال پیرایش و بازآفرینی متن…</span>
                </>
              ) : (
                <>
                  <span className="text-xl">✒️</span>
                  <span>مهر و پیرایش متن ({mode.label})</span>
                  <span className="hidden sm:inline-block mr-2 text-[10px] bg-black/20 px-2 py-0.5 rounded-full font-mono">
                    ⌘↵
                  </span>
                </>
              )}
            </button>
          </div>

          {/* Refined Master Leaf */}
          <div ref={resultRef} className="v-folio flex flex-col overflow-hidden shadow-card min-h-[360px]">
            {result ? (
              <div className="flex flex-col h-full animate-fade-up">
                {/* Master Folio Header */}
                <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 border-b border-border/70 bg-brand/5">
                  <div className="flex items-center gap-2">
                    <span className="text-base text-brand">✨</span>
                    <span className="font-black text-xs sm:text-sm text-ink">
                      برگ دوم: نسخهٔ پیراسته و نهایی
                    </span>
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-brand/15 text-brand">
                      {mode.label}
                    </span>
                    <span className="text-[11px] font-bold text-ink-soft">
                      ({faNum(result.changed)} تغییر)
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setShowDiff(!showDiff)
                      playTactileSound(activeTheme, 'tap')
                    }}
                    className={`px-3 py-1 rounded-xl text-xs font-black transition-all border ${
                      showDiff
                        ? 'bg-brand text-on-brand border-brand shadow-xs'
                        : 'bg-paper text-ink border-border hover:border-brand'
                    }`}
                  >
                    {showDiff ? 'نمایش متن پاک‌نویس' : 'نمایش حاشیه‌نویسی تغییرات'}
                  </button>
                </div>

                {/* Master Text Output */}
                <div className="p-5 flex-1 min-h-[220px]">
                  {showDiff ? (
                    <DiffText original={input} modified={result.output} />
                  ) : (
                    <p dir="rtl" className="whitespace-pre-wrap text-base sm:text-lg leading-8 sm:leading-9 font-medium text-ink select-text">
                      {result.output}
                    </p>
                  )}

                  {/* Editorial notes */}
                  {result.notes.length > 0 && (
                    <div className="mt-5 pt-4 border-t border-dashed border-border/80">
                      <p className="text-xs font-black text-brand mb-2 flex items-center gap-1.5">
                        <Star size={12} />
                        <span>یادداشت‌های ویراستار بر این متن:</span>
                      </p>
                      <ul className="space-y-1.5">
                        {result.notes.map((n, i) => (
                          <li key={i} className="text-xs leading-5 text-ink-soft flex items-start gap-2">
                            <span className="text-brand shrink-0">▪</span>
                            <span>{n}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* 1-Tap Action Ribbon */}
                <div className="flex flex-wrap items-center justify-between gap-2 p-3 border-t border-border/70 bg-paper/50">
                  <div className="flex items-center gap-2 flex-1">
                    <button
                      type="button"
                      onClick={handleCopy}
                      className="v-btn-ghost flex-1 py-2 text-xs font-black flex items-center justify-center gap-1.5"
                    >
                      {copied ? <CheckGlyph size={16} className="text-success" /> : <CopyGlyph size={16} />}
                      <span>{copied ? 'رونویسی شد!' : 'رونویسی (کپی)'}</span>
                      <span className="hidden sm:inline-block text-[10px] opacity-40 font-mono">⌘⇧C</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleSave}
                      className="v-btn-ghost flex-1 py-2 text-xs font-black flex items-center justify-center gap-1.5"
                    >
                      {saved ? <CheckGlyph size={16} className="text-success" /> : <SaveGlyph size={16} />}
                      <span>{saved ? 'ثبت شد!' : 'ثبت در دفتر نگارش'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleShare}
                      className="v-btn-ghost py-2 px-3 text-xs font-black flex items-center justify-center gap-1.5"
                      title="فرستادن به واتس‌اپ و تلگرام"
                    >
                      <ShareGlyph size={16} />
                      <span className="hidden sm:inline">ارسال</span>
                    </button>
                  </div>
                </div>

                {/* Fast Tone Re-styling Ribbon */}
                <div className="p-3 bg-brand/5 border-t border-brand/10 flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-bold text-ink-soft">پیرایش سریع به لحنی دیگر:</span>
                  {[
                    { id: 'rasmi', label: 'رسمی' },
                    { id: 'edari', label: 'اداری' },
                    { id: 'hoghooghi', label: 'حقوقی' },
                    { id: 'khodemani', label: 'خودمانی' },
                    { id: 'divani', label: 'دیوانی' },
                  ]
                    .filter((s) => s.id !== modeId)
                    .map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          setModeId(s.id)
                          playTactileSound(activeTheme, 'special')
                          setTimeout(() => handleEdit(), 100)
                        }}
                        className="px-2.5 py-1 rounded-lg bg-paper text-ink font-bold border border-border hover:border-brand/40 cursor-pointer shadow-xs"
                      >
                        {s.label}
                      </button>
                    ))}
                </div>
              </div>
            ) : busy && liveOutput ? (
              <div className="p-6 flex flex-col items-center justify-center text-center h-full min-h-[300px]">
                <Star size={36} className="text-brand animate-star-busy mb-4" />
                <p className="font-black text-lg text-ink mb-2">در حال پیرایش قلم…</p>
                <p className="text-xs text-ink-soft max-w-sm mb-4">
                  هوش مصنوعی در حال بازآفرینی واژگان و هماهنگ‌سازی لحن به سبک «{mode.label}» است.
                </p>
                <div className="w-full max-w-md p-4 rounded-xl bg-paper border border-border text-start">
                  <p className="text-sm leading-7 text-ink/75 line-clamp-4 font-mono">
                    {liveOutput}
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-8 flex flex-col items-center justify-center text-center h-full min-h-[340px]">
                <div className="w-16 h-16 rounded-full bg-brand/10 flex items-center justify-center text-brand mb-4">
                  <Star size={36} hollow />
                </div>
                <h3 className="font-black text-lg text-ink mb-1.5">
                  برگ دوم منتظر متن شماست
                </h3>
                <p className="text-xs leading-6 text-ink-soft max-w-sm mb-4">
                  متن خود را در برگ یکم بنویسید و دکمهٔ «مهر و پیرایش متن» را لمس کنید تا نسخهٔ پیراسته در این بخش پدیدار شود.
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  <span className="px-3 py-1 rounded-full bg-paper-deep text-ink-soft text-xs font-bold border border-border/80">
                    ✓ تصحیح خودکار نقطه‌گذاری و ویرگول
                  </span>
                  <span className="px-3 py-1 rounded-full bg-paper-deep text-ink-soft text-xs font-bold border border-border/80">
                    ✓ تنظیم علمی نیم‌فاصله‌ها
                  </span>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

function DiffText({ original, modified }: { original: string; modified: string }) {
  const origTokens = new Set(
    original
      .split(/\s+/)
      .map((s) => s.trim().replace(/[.,!؟،؛]/g, ''))
      .filter(Boolean),
  )
  const tokens = modified.split(/(\s+)/)
  return (
    <p dir="rtl" className="whitespace-pre-wrap text-base sm:text-lg leading-8 sm:leading-9 text-ink font-medium">
      {tokens.map((token, idx) => {
        if (!token.trim()) return <span key={idx}>{token}</span>
        const cleanToken = token.trim().replace(/[.,!؟،؛]/g, '')
        const isChanged = !origTokens.has(cleanToken)
        return isChanged ? (
          <mark key={idx} className="v-marginalia-diff-add not-italic font-bold">
            {token}
          </mark>
        ) : (
          <span key={idx}>{token}</span>
        )
      })}
    </p>
  )
}

async function copyText(t: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(t)
    return true
  } catch {
    const ta = document.createElement('textarea')
    ta.value = t
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    ta.remove()
    return ok
  }
}
