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
    <div className={`space-y-6 max-w-6xl mx-auto ${zenMode ? 'max-w-4xl' : ''}`}>
      {/* Top Banner & Zen Mode Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b-4 border-black pb-3 bg-white p-3 shadow-[4px_4px_0px_#000]">
        <div className="flex items-center gap-2">
          <span className="bg-black text-[#ffed00] font-black px-2.5 py-1 text-sm border-2 border-black">
            میز تحریر نئوبروتال
          </span>
          <span className="text-xs font-black text-black hidden sm:inline-block">
            کارگاه پیرایش زبان فارسی بدون لکنت و غلط املایی
          </span>
        </div>

        <button
          type="button"
          onClick={() => {
            setZenMode(!zenMode)
            playTactileSound(activeTheme, 'tap')
          }}
          className={`border-3 border-black px-3.5 py-1 text-xs font-black transition-all cursor-pointer ${
            zenMode
              ? 'bg-[#ffed00] text-black shadow-[3px_3px_0px_#000]'
              : 'bg-white text-black shadow-[2px_2px_0px_#000] hover:bg-[#ffed00]'
          }`}
        >
          <span>{zenMode ? '🪶 خروج از حالت خلوت' : '🪶 حالت تمرکز و خلوت'}</span>
        </button>
      </div>

      {/* Stylus Chest (قلم‌دان سبک‌ها) */}
      {!zenMode && (
        <section className="border-4 border-black bg-white p-4 sm:p-5 shadow-[6px_6px_0px_#000] space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b-3 border-black pb-3">
            <div className="flex items-center gap-2">
              <span className="bg-[#ff4332] text-white px-2 py-0.5 text-xs font-black border-2 border-black shadow-[2px_2px_0px_#000]">
                سبک‌ها
              </span>
              <span className="font-black text-sm sm:text-base text-black">
                قلم‌دان سیزده لحن زبان فارسی
              </span>
            </div>

            {/* Drawer Tabs */}
            <div className="flex items-center gap-1.5 bg-[#fff5d6] p-1 border-2 border-black shadow-[2px_2px_0px_#000]">
              <button
                type="button"
                onClick={() => {
                  setQalamdanCategory('divan')
                  playTactileSound(activeTheme, 'tap')
                }}
                className={`px-3 py-1 text-xs font-black border-2 transition-all cursor-pointer ${
                  qalamdanCategory === 'divan'
                    ? 'bg-[#ffed00] text-black border-black shadow-[2px_2px_0px_#000]'
                    : 'bg-white text-black border-transparent hover:border-black'
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
                className={`px-3 py-1 text-xs font-black border-2 transition-all cursor-pointer ${
                  qalamdanCategory === 'adab'
                    ? 'bg-[#ffed00] text-black border-black shadow-[2px_2px_0px_#000]'
                    : 'bg-white text-black border-transparent hover:border-black'
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
                className={`px-3 py-1 text-xs font-black border-2 transition-all cursor-pointer ${
                  qalamdanCategory === 'kooche'
                    ? 'bg-[#ffed00] text-black border-black shadow-[2px_2px_0px_#000]'
                    : 'bg-white text-black border-transparent hover:border-black'
                }`}
              >
                کوچه و بازار (طنز)
              </button>
            </div>
          </div>

          {/* Drawer Modes Grid */}
          <div className="grid gap-2.5 grid-cols-2 sm:grid-cols-3 md:grid-cols-5">
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
                  className={`flex flex-col items-start p-3 text-start transition-all cursor-pointer border-3 border-black ${
                    isActive
                      ? 'bg-[#ffed00] text-black shadow-[4px_4px_0px_#000] translate-x-[-2px] translate-y-[-2px]'
                      : 'bg-white text-black hover:bg-[#d4bdff] shadow-[2px_2px_0px_#000]'
                  }`}
                >
                  <div className="flex items-center gap-1.5 w-full mb-1">
                    <ModeGlyph modeId={m.id} size={18} className="text-black" />
                    <span className="font-black text-xs sm:text-sm truncate text-black">{m.label}</span>
                  </div>
                  <span className="text-[10px] leading-4 text-black/80 font-bold line-clamp-1">
                    {m.tagline}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Active Style Strip */}
          <div className="border-t-3 border-black pt-3 flex flex-wrap items-center justify-between gap-2 text-xs font-black bg-[#d4bdff] p-3 border-2 border-black shadow-[3px_3px_0px_#000]">
            <p className="text-black">
              لحن فعال: <span className="bg-black text-white px-2 py-0.5">{mode.label}</span> — {mode.description}
            </p>
            <button
              type="button"
              onClick={() => {
                const sample = PROMPT_SUGGESTIONS.find((s) => s.modeId === modeId) ?? PROMPT_SUGGESTIONS[0]
                setInput(sample.text)
                playTactileSound(activeTheme, 'special')
              }}
              className="bg-white text-black border-2 border-black px-2.5 py-1 hover:bg-[#ffed00] shadow-[2px_2px_0px_#000] cursor-pointer"
            >
              <span>✨ درج متن نمونه</span>
            </button>
          </div>
        </section>
      )}

      {/* The Dual Neo-Brutalist Panels */}
      <div className="grid gap-6 lg:grid-cols-2 items-start">
        {/* Panel 1: Raw Draft */}
        <section className="border-4 border-black bg-white shadow-[6px_6px_0px_#000] flex flex-col">
          {/* Header Strip */}
          <div className="flex items-center justify-between px-4 py-3 border-b-3 border-black bg-[#fff5d6]">
            <div className="flex items-center gap-2">
              <span className="bg-black text-white px-2 py-0.5 text-xs font-black">۰۱</span>
              <span className="font-black text-sm text-black uppercase">برگ پیش‌نویس</span>
              <span className="text-xs font-black bg-white px-2 py-0.5 border border-black shadow-[1px_1px_0px_#000]">
                {faNum(words)} واژه
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePaste}
                className="v-btn-ghost text-xs px-2.5 py-1"
                title="جای‌گذاری متن از حافظه"
              >
                📋 چسباندن
              </button>
              {input && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="v-btn-ghost text-xs px-2 py-1 bg-[#ff4332] text-white hover:bg-black"
                  title="پاک کردن متن"
                >
                  پاک کردن
                </button>
              )}
            </div>
          </div>

          {/* Textarea Area */}
          <div className="p-4 sm:p-5 min-h-[300px] flex flex-col justify-between">
            <textarea
              id="virastar-input"
              ref={inputRef}
              dir="rtl"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="اینجا بنویسید… هر نوشته‌ای، از پیام کاری تا مقاله یا نامه رسمی"
              className="w-full flex-1 bg-transparent text-base sm:text-lg leading-8 outline-none resize-none text-black font-bold placeholder:text-black/40 min-h-[220px]"
            />

            {!input && (
              <div className="mt-4 pt-4 border-t-3 border-black border-dashed">
                <p className="text-xs font-black text-black mb-2 uppercase">
                  نمونه‌های شروع سریع:
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
                      className="p-2.5 text-start bg-[#fff5d6] border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-[#ffed00] hover:shadow-[3px_3px_0px_#000] transition-all cursor-pointer"
                    >
                      <span className="block text-xs font-black text-black">{item.title}</span>
                      <span className="block text-[11px] font-bold text-black/70 truncate">{item.text}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Drafting Ruler Toolbar */}
          <div className="v-ruler-toolbar p-3 border-t-3 border-black flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => insertAtCursor('\u200c')}
                className="bg-white text-black border-2 border-black px-3 py-1 text-xs font-black shadow-[2px_2px_0px_#000] hover:bg-black hover:text-white transition-all cursor-pointer"
                title="نیم‌فاصله استاندارد فارسی"
              >
                نیم‌فاصله
              </button>
              <button
                type="button"
                onClick={() => insertAtCursor('«»')}
                className="bg-white text-black border-2 border-black px-2.5 py-1 text-xs font-black shadow-[2px_2px_0px_#000] hover:bg-black hover:text-white cursor-pointer"
              >
                « »
              </button>
              <button
                type="button"
                onClick={() => insertAtCursor('،')}
                className="bg-white text-black border-2 border-black px-2.5 py-1 text-xs font-black shadow-[2px_2px_0px_#000] hover:bg-black hover:text-white cursor-pointer"
              >
                ،
              </button>
              <button
                type="button"
                onClick={() => insertAtCursor('؛')}
                className="bg-white text-black border-2 border-black px-2.5 py-1 text-xs font-black shadow-[2px_2px_0px_#000] hover:bg-black hover:text-white cursor-pointer"
              >
                ؛
              </button>
              <button
                type="button"
                onClick={() => insertAtCursor('؟')}
                className="bg-white text-black border-2 border-black px-2.5 py-1 text-xs font-black shadow-[2px_2px_0px_#000] hover:bg-black hover:text-white cursor-pointer"
              >
                ؟
              </button>
              <button
                type="button"
                onClick={() => insertAtCursor('.')}
                className="bg-white text-black border-2 border-black px-2.5 py-1 text-xs font-black shadow-[2px_2px_0px_#000] hover:bg-black hover:text-white cursor-pointer"
              >
                .
              </button>
            </div>

            <div className="flex items-center gap-2">
              {dictation.supported && (
                <button
                  type="button"
                  onClick={toggleDictation}
                  className={`border-2 border-black px-3 py-1 text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-[2px_2px_0px_#000] ${
                    dictation.listening ? 'bg-[#ff4332] text-white animate-pulse' : 'bg-white text-black hover:bg-black hover:text-white'
                  }`}
                >
                  <MicGlyph size={14} />
                  <span>{dictation.listening ? 'در حال ضبط…' : 'تقریر'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setShowKeyboard(!showKeyboard)
                  playTactileSound(activeTheme, 'special')
                }}
                className={`border-2 border-black px-3 py-1 text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-[2px_2px_0px_#000] ${
                  showKeyboard ? 'bg-black text-white' : 'bg-white text-black hover:bg-black hover:text-white'
                }`}
              >
                <span>⌨️</span>
                <span>{showKeyboard ? 'بستن' : 'کیبورد'}</span>
              </button>
            </div>
          </div>

          {/* Virtual Keyboard */}
          {showKeyboard && (
            <div className="p-3 border-t-3 border-black bg-[#fff5d6]">
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

        {/* Panel 2: Master Output Desk */}
        <section className="flex flex-col gap-4">
          {/* Master Seal Action Button */}
          <button
            type="button"
            onClick={handleEdit}
            disabled={busy || !input.trim()}
            className="v-seal-master w-full justify-center bg-[#ff4332] text-white hover:bg-black shadow-[6px_6px_0px_#000] text-lg font-black"
          >
            {busy ? (
              <>
                <Star size={22} className="animate-spin text-yellow-300" />
                <span>در حال پیرایش متن…</span>
              </>
            ) : (
              <>
                <span>⚡</span>
                <span>مهر و پیرایش متن ({mode.label})</span>
                <span className="hidden sm:inline-block mr-2 text-xs bg-black text-white px-2 py-0.5 border border-white font-mono">
                  ⌘↵
                </span>
              </>
            )}
          </button>

          {/* Refined Master Card */}
          <div ref={resultRef} className="border-4 border-black bg-white shadow-[6px_6px_0px_#000] min-h-[340px] flex flex-col justify-between">
            {result ? (
              <div className="flex flex-col h-full">
                {/* Result Header */}
                <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b-3 border-black bg-[#d4bdff]">
                  <div className="flex items-center gap-2">
                    <span className="bg-black text-white px-2 py-0.5 text-xs font-black">۰۲</span>
                    <span className="font-black text-sm text-black uppercase">نسخه پیراسته</span>
                    <span className="bg-[#ffed00] text-black text-xs px-2 py-0.5 font-black border border-black shadow-[1px_1px_0px_#000]">
                      {mode.label}
                    </span>
                    <span className="text-xs font-black text-black">
                      ({faNum(result.changed)} تغییر)
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setShowDiff(!showDiff)
                      playTactileSound(activeTheme, 'tap')
                    }}
                    className={`border-2 border-black px-3 py-1 text-xs font-black shadow-[2px_2px_0px_#000] transition-all cursor-pointer ${
                      showDiff ? 'bg-black text-white' : 'bg-white text-black hover:bg-[#ffed00]'
                    }`}
                  >
                    {showDiff ? 'متن یکدست' : 'نمایش تفاوت‌ها'}
                  </button>
                </div>

                {/* Result Text */}
                <div className="p-5 flex-1 min-h-[200px]">
                  {showDiff ? (
                    <DiffText original={input} modified={result.output} />
                  ) : (
                    <p dir="rtl" className="whitespace-pre-wrap text-base sm:text-lg leading-8 font-black text-black select-text">
                      {result.output}
                    </p>
                  )}

                  {result.notes.length > 0 && (
                    <div className="mt-4 pt-3 border-t-3 border-black">
                      <p className="text-xs font-black text-black mb-1.5 uppercase">
                        یادداشت‌های ویراستار:
                      </p>
                      <ul className="space-y-1">
                        {result.notes.map((n, i) => (
                          <li key={i} className="text-xs font-bold text-black/80 flex items-start gap-1.5">
                            <span className="text-[#ff4332] font-black">▪</span>
                            <span>{n}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Action Buttons Ribbon */}
                <div className="flex flex-wrap items-center gap-2 p-3 border-t-3 border-black bg-[#fff5d6]">
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="v-btn-ghost flex-1 py-2 text-xs font-black flex items-center justify-center gap-1.5"
                  >
                    {copied ? <CheckGlyph size={16} className="text-green-700" /> : <CopyGlyph size={16} />}
                    <span>{copied ? 'رونویسی شد!' : 'رونویسی (کپی)'}</span>
                    <span className="hidden sm:inline-block text-[10px] opacity-60 font-mono">⌘⇧C</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSave}
                    className="v-btn-ghost flex-1 py-2 text-xs font-black flex items-center justify-center gap-1.5"
                  >
                    {saved ? <CheckGlyph size={16} className="text-green-700" /> : <SaveGlyph size={16} />}
                    <span>{saved ? 'ثبت شد!' : 'ثبت در نوشته‌ها'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleShare}
                    className="v-btn-ghost py-2 px-3 text-xs font-black flex items-center justify-center gap-1.5"
                    title="فرستادن به پیام‌رسان‌ها"
                  >
                    <ShareGlyph size={16} />
                    <span className="hidden sm:inline">ارسال</span>
                  </button>
                </div>

                {/* Fast Re-Style Ribbon */}
                <div className="p-3 bg-[#ffed00] border-t-3 border-black flex flex-wrap items-center gap-2 text-xs font-black">
                  <span className="text-black">پیرایش سریع به لحنی دیگر:</span>
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
                        className="px-2.5 py-1 bg-white text-black border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-black hover:text-white cursor-pointer font-black"
                      >
                        {s.label}
                      </button>
                    ))}
                </div>
              </div>
            ) : busy && liveOutput ? (
              <div className="p-6 flex flex-col items-center justify-center text-center h-full min-h-[300px]">
                <span className="text-3xl font-black mb-3">⚡</span>
                <p className="font-black text-xl text-black mb-2">در حال بازآفرینی متن…</p>
                <div className="w-full p-4 border-3 border-black bg-[#fff5d6] text-start shadow-[3px_3px_0px_#000]">
                  <p className="text-sm font-mono font-bold text-black">{liveOutput}</p>
                </div>
              </div>
            ) : (
              <div className="p-8 flex flex-col items-center justify-center text-center h-full min-h-[300px]">
                <div className="w-16 h-16 bg-[#ffed00] border-3 border-black flex items-center justify-center text-2xl font-black shadow-[4px_4px_0px_#000] mb-4">
                  ⚡
                </div>
                <h3 className="font-black text-xl text-black mb-2">
                  برگ دوم در انتظار متن شما
                </h3>
                <p className="text-xs sm:text-sm font-bold text-black/80 max-w-sm mb-4">
                  متن خود را در برگ یکم بنویسید و دکمهٔ «مهر و پیرایش متن» را بزنید تا نسخه اصلاح‌شده پدیدار شود.
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  <span className="border-2 border-black bg-[#fff5d6] px-3 py-1 text-xs font-black shadow-[2px_2px_0px_#000]">
                    ✓ تصحیح نشانه‌گذاری و ویرگول
                  </span>
                  <span className="border-2 border-black bg-[#d4bdff] px-3 py-1 text-xs font-black shadow-[2px_2px_0px_#000]">
                    ✓ نیم‌فاصله‌های استاندارد
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
    <p dir="rtl" className="whitespace-pre-wrap text-base sm:text-lg leading-8 text-black font-black">
      {tokens.map((token, idx) => {
        if (!token.trim()) return <span key={idx}>{token}</span>
        const cleanToken = token.trim().replace(/[.,!؟،؛]/g, '')
        const isChanged = !origTokens.has(cleanToken)
        return isChanged ? (
          <mark key={idx} className="v-marginalia-diff-add not-italic font-black">
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
