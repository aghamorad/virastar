'use client'

import { useEffect, useRef, useState } from 'react'
import { MODES, getMode, type WritingMode } from '@/domain/modes'
import { runEdit, type EditResult } from '@/domain/engine'
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

  // Pick up handed-off text
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
      <div className="flex flex-wrap items-center justify-between gap-3 border border-border bg-surface p-3 rounded-[10px_4px_12px_6px] shadow-soft">
        <div className="flex items-center gap-2">
          <span className="sketch-bracket text-base">[</span>
          <span className="text-sm font-bold text-ink">
            میز نگارش و یادداشت‌برداری ویراستار
          </span>
          <span className="sketch-bracket text-base">]</span>
          <span className="text-xs text-ink-soft hidden sm:inline-block">
            · پیرایش روان، درست‌نویسی و بازآفرینی زبان فارسی
          </span>
        </div>

        <button
          type="button"
          onClick={() => {
            setZenMode(!zenMode)
            playTactileSound(activeTheme, 'tap')
          }}
          className={`v-btn-ghost text-xs px-3 py-1 font-bold ${
            zenMode ? 'bg-highlight border-ink font-extrabold' : ''
          }`}
        >
          <span>{zenMode ? '🪶 خروج از حالت خلوت' : '🪶 حالت تمرکز و خلوت'}</span>
        </button>
      </div>

      {/* Stylus Chest (قلم‌دان سبک‌ها) */}
      {!zenMode && (
        <section className="v-card p-4 sm:p-5 space-y-4 relative">
          <div className="sketch-tape" aria-hidden="true" />

          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <span className="sketch-blue-note text-xs font-bold">
                قلم‌دان
              </span>
              <span className="font-bold text-sm sm:text-base text-ink">
                سیزده لحن و آوای زبان فارسی
              </span>
            </div>

            {/* Drawer Tabs */}
            <div className="flex items-center gap-1.5 bg-paper p-1 border border-border rounded-[8px_4px_10px_4px]">
              <button
                type="button"
                onClick={() => {
                  setQalamdanCategory('divan')
                  playTactileSound(activeTheme, 'tap')
                }}
                className={`px-3 py-1 text-xs font-bold rounded-[6px_3px_8px_3px] transition-all cursor-pointer ${
                  qalamdanCategory === 'divan'
                    ? 'bg-highlight text-ink border border-ink shadow-soft font-extrabold'
                    : 'text-ink-soft hover:text-ink'
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
                className={`px-3 py-1 text-xs font-bold rounded-[6px_3px_8px_3px] transition-all cursor-pointer ${
                  qalamdanCategory === 'adab'
                    ? 'bg-highlight text-ink border border-ink shadow-soft font-extrabold'
                    : 'text-ink-soft hover:text-ink'
                }`}
              >
                ادبستان و اندیشه
              </button>
              <button
                type="button"
                onClick={() => {
                  setQalamdanCategory('kooche')
                  playTactileSound(activeTheme, 'tap')
                }}
                className={`px-3 py-1 text-xs font-bold rounded-[6px_3px_8px_3px] transition-all cursor-pointer ${
                  qalamdanCategory === 'kooche'
                    ? 'bg-highlight text-ink border border-ink shadow-soft font-extrabold'
                    : 'text-ink-soft hover:text-ink'
                }`}
              >
                کوچه و بازار (صمیمانه)
              </button>
            </div>
          </div>

          {/* Drawer Modes Grid */}
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
                  className={`flex flex-col items-start p-2.5 text-start transition-all cursor-pointer border rounded-[8px_4px_10px_4px] ${
                    isActive
                      ? 'bg-highlight text-ink border-ink shadow-soft font-extrabold'
                      : 'bg-paper text-ink border-border hover:border-ink/60 hover:bg-paper-deep'
                  }`}
                >
                  <div className="flex items-center gap-1.5 w-full mb-1">
                    <ModeGlyph modeId={m.id} size={16} className="text-brand" />
                    <span className="font-bold text-xs sm:text-sm truncate text-ink">{m.label}</span>
                  </div>
                  <span className="text-[10px] leading-4 text-ink-soft line-clamp-1 font-normal">
                    {m.tagline}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Active Style Strip */}
          <div className="border-t border-border pt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-ink bg-paper p-2.5 rounded-[8px_4px_10px_4px] border border-border">
            <p className="flex items-center gap-1.5">
              <span className="text-brand font-bold">لحن انتخابی:</span>
              <span className="sketch-highlight font-bold">{mode.label}</span>
              <span className="text-ink-soft">— {mode.description}</span>
            </p>
            <button
              type="button"
              onClick={() => {
                const sample = PROMPT_SUGGESTIONS.find((s) => s.modeId === modeId) ?? PROMPT_SUGGESTIONS[0]
                setInput(sample.text)
                playTactileSound(activeTheme, 'special')
              }}
              className="v-btn-ghost text-xs px-2.5 py-1"
            >
              <span>✎ درج متن نمونه</span>
            </button>
          </div>
        </section>
      )}

      {/* The Dual Sketch Sheets */}
      <div className="grid gap-6 lg:grid-cols-2 items-start">
        {/* Panel 1: Raw Draft Sheet */}
        <section className="v-card flex flex-col relative">
          <div className="sketch-tape" aria-hidden="true" />

          {/* Header Strip */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-paper/60 rounded-t-[14px_6px_0px_0px]">
            <div className="flex items-center gap-2">
              <span className="sketch-bracket text-sm">[</span>
              <span className="font-bold text-sm text-ink">برگ پیش‌نویس</span>
              <span className="sketch-bracket text-sm">]</span>
              <span className="text-xs text-ink-soft bg-surface px-2 py-0.5 border border-border rounded-[4px]">
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
                  className="v-btn-ghost text-xs px-2 py-1 text-brand hover:border-brand"
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
              className="w-full flex-1 bg-transparent text-base sm:text-lg leading-relaxed outline-none resize-none text-ink font-medium placeholder:text-ink-soft/40 min-h-[220px]"
            />

            {!input && (
              <div className="mt-4 pt-4 border-t border-dashed border-border">
                <p className="text-xs font-bold text-accent mb-2">
                  ✎ نمونه‌های شروع سریع برای امتحان:
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
                      className="p-2.5 text-start bg-paper border border-border rounded-[8px_4px_10px_4px] hover:border-ink hover:bg-highlight/30 transition-all cursor-pointer"
                    >
                      <span className="block text-xs font-bold text-ink">{item.title}</span>
                      <span className="block text-[11px] text-ink-soft truncate font-normal">{item.text}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Drafting Ruler Toolbar */}
          <div className="v-ruler-toolbar p-3 border-t border-border flex flex-wrap items-center justify-between gap-2 rounded-b-[0px_0px_18px_8px]">
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => insertAtCursor('\u200c')}
                className="bg-surface text-ink border border-border px-3 py-1 text-xs font-bold rounded-[6px_3px_8px_3px] shadow-soft hover:bg-highlight hover:border-ink transition-all cursor-pointer"
                title="نیم‌فاصله استاندارد فارسی"
              >
                [نیم‌فاصله]
              </button>
              <button
                type="button"
                onClick={() => insertAtCursor('«»')}
                className="bg-surface text-ink border border-border px-2.5 py-1 text-xs font-bold rounded-[6px_3px_8px_3px] shadow-soft hover:bg-highlight hover:border-ink cursor-pointer"
              >
                « »
              </button>
              <button
                type="button"
                onClick={() => insertAtCursor('،')}
                className="bg-surface text-ink border border-border px-2.5 py-1 text-xs font-bold rounded-[6px_3px_8px_3px] shadow-soft hover:bg-highlight hover:border-ink cursor-pointer"
              >
                ،
              </button>
              <button
                type="button"
                onClick={() => insertAtCursor('؛')}
                className="bg-surface text-ink border border-border px-2.5 py-1 text-xs font-bold rounded-[6px_3px_8px_3px] shadow-soft hover:bg-highlight hover:border-ink cursor-pointer"
              >
                ؛
              </button>
              <button
                type="button"
                onClick={() => insertAtCursor('؟')}
                className="bg-surface text-ink border border-border px-2.5 py-1 text-xs font-bold rounded-[6px_3px_8px_3px] shadow-soft hover:bg-highlight hover:border-ink cursor-pointer"
              >
                ؟
              </button>
              <button
                type="button"
                onClick={() => insertAtCursor('.')}
                className="bg-surface text-ink border border-border px-2.5 py-1 text-xs font-bold rounded-[6px_3px_8px_3px] shadow-soft hover:bg-highlight hover:border-ink cursor-pointer"
              >
                .
              </button>
            </div>

            <div className="flex items-center gap-2">
              {dictation.supported && (
                <button
                  type="button"
                  onClick={toggleDictation}
                  className={`border px-3 py-1 text-xs font-bold rounded-[6px_3px_8px_3px] flex items-center gap-1.5 cursor-pointer shadow-soft ${
                    dictation.listening
                      ? 'bg-brand text-white border-brand animate-pulse'
                      : 'bg-surface text-ink border-border hover:border-ink'
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
                className={`border px-3 py-1 text-xs font-bold rounded-[6px_3px_8px_3px] flex items-center gap-1.5 cursor-pointer shadow-soft ${
                  showKeyboard
                    ? 'bg-ink text-paper border-ink'
                    : 'bg-surface text-ink border-border hover:border-ink'
                }`}
              >
                <span>⌨️</span>
                <span>{showKeyboard ? 'بستن' : 'کیبورد'}</span>
              </button>
            </div>
          </div>

          {/* Virtual Keyboard */}
          {showKeyboard && (
            <div className="p-3 border-t border-border bg-paper">
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

        {/* Panel 2: Refined Output Desk */}
        <section className="flex flex-col gap-4">
          {/* Master Action Button */}
          <button
            type="button"
            onClick={handleEdit}
            disabled={busy || !input.trim()}
            className="v-seal-master w-full justify-center text-base sm:text-lg"
          >
            {busy ? (
              <>
                <Star size={20} className="animate-spin text-highlight" />
                <span>در حال پیرایش متن…</span>
              </>
            ) : (
              <>
                <span>✎</span>
                <span>مهر و پیرایش متن ({mode.label})</span>
                <span className="hidden sm:inline-block mr-2 text-xs bg-black/20 text-white px-2 py-0.5 rounded-[4px] font-mono">
                  ⌘↵
                </span>
              </>
            )}
          </button>

          {/* Refined Master Card */}
          <div ref={resultRef} className="v-card min-h-[340px] flex flex-col justify-between relative">
            <div className="sketch-tape" aria-hidden="true" />

            {result ? (
              <div className="flex flex-col h-full">
                {/* Result Header */}
                <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-border bg-paper/60 rounded-t-[14px_6px_0px_0px]">
                  <div className="flex items-center gap-2">
                    <span className="sketch-bracket text-sm">[</span>
                    <span className="font-bold text-sm text-ink">نسخهٔ پیراسته</span>
                    <span className="sketch-bracket text-sm">]</span>
                    <span className="sketch-highlight text-xs font-bold">
                      {mode.label}
                    </span>
                    <span className="text-xs text-ink-soft">
                      ({faNum(result.changed)} دگرگونی)
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setShowDiff(!showDiff)
                      playTactileSound(activeTheme, 'tap')
                    }}
                    className={`v-btn-ghost text-xs px-2.5 py-1 ${
                      showDiff ? 'bg-highlight border-ink font-extrabold' : ''
                    }`}
                  >
                    {showDiff ? 'متن یکدست' : 'نمایش خط‌خوردگی‌ها'}
                  </button>
                </div>

                {/* Result Text */}
                <div className="p-5 flex-1 min-h-[200px]">
                  {showDiff ? (
                    <DiffText original={input} modified={result.output} />
                  ) : (
                    <p dir="rtl" className="whitespace-pre-wrap text-base sm:text-lg leading-relaxed font-bold text-ink select-text">
                      {result.output}
                    </p>
                  )}

                  {result.notes.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-border">
                      <p className="text-xs font-bold text-accent mb-1.5 flex items-center gap-1">
                        <span>✎</span> یادداشت‌های پیرایشگر:
                      </p>
                      <ul className="space-y-1">
                        {result.notes.map((n, i) => (
                          <li key={i} className="text-xs text-ink-soft flex items-start gap-1.5 font-normal">
                            <span className="text-brand font-bold">·</span>
                            <span>{n}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Action Buttons Ribbon */}
                <div className="flex flex-wrap items-center gap-2 p-3 border-t border-border bg-paper/60">
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="v-btn-ghost flex-1 py-2 text-xs font-bold flex items-center justify-center gap-1.5"
                  >
                    {copied ? <CheckGlyph size={15} className="text-success" /> : <CopyGlyph size={15} />}
                    <span>{copied ? 'رونویسی شد!' : 'رونویسی (کپی)'}</span>
                    <span className="hidden sm:inline-block text-[10px] opacity-60 font-mono">⌘⇧C</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSave}
                    className="v-btn-ghost flex-1 py-2 text-xs font-bold flex items-center justify-center gap-1.5"
                  >
                    {saved ? <CheckGlyph size={15} className="text-success" /> : <SaveGlyph size={15} />}
                    <span>{saved ? 'ثبت شد!' : 'ثبت در دفترچه'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleShare}
                    className="v-btn-ghost py-2 px-3 text-xs font-bold flex items-center justify-center gap-1.5"
                    title="فرستادن به پیام‌رسان‌ها"
                  >
                    <ShareGlyph size={15} />
                    <span className="hidden sm:inline">ارسال</span>
                  </button>
                </div>

                {/* Fast Re-Style Ribbon */}
                <div className="p-3 bg-highlight/30 border-t border-border flex flex-wrap items-center gap-2 text-xs font-bold rounded-b-[0px_0px_18px_8px]">
                  <span className="text-ink-soft">پیرایش سریع به لحنی دیگر:</span>
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
                        className="px-2.5 py-1 bg-surface text-ink border border-border rounded-[6px_3px_8px_3px] shadow-soft hover:bg-highlight hover:border-ink cursor-pointer font-bold"
                      >
                        {s.label}
                      </button>
                    ))}
                </div>
              </div>
            ) : busy && liveOutput ? (
              <div className="p-6 flex flex-col items-center justify-center text-center h-full min-h-[300px]">
                <span className="text-3xl mb-3">✎</span>
                <p className="font-bold text-lg text-ink mb-2">در حال بازآفرینی متن بر برگه…</p>
                <div className="w-full p-4 border border-border bg-paper rounded-[10px_5px_12px_6px] text-start shadow-soft">
                  <p className="text-sm font-sans leading-relaxed text-ink font-medium">{liveOutput}</p>
                </div>
              </div>
            ) : (
              <div className="p-8 flex flex-col items-center justify-center text-center h-full min-h-[300px]">
                <div className="w-14 h-14 bg-highlight/60 border border-border rounded-[10px_5px_12px_6px] flex items-center justify-center text-xl font-bold shadow-soft mb-3 text-brand">
                  ✎
                </div>
                <h3 className="font-bold text-lg text-ink mb-1.5">
                  برگ دوم در انتظار متن شماست
                </h3>
                <p className="text-xs sm:text-sm text-ink-soft max-w-sm mb-4 leading-relaxed font-normal">
                  متن خود را در برگ پیش‌نویس بنویسید و دکمهٔ «مهر و پیرایش متن» را بزنید تا نسخه پیراسته پدیدار شود.
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  <span className="border border-border bg-paper px-2.5 py-1 text-xs text-ink-soft rounded-[6px_3px_8px_3px] shadow-soft">
                    ✓ رفع غلط‌های املایی و تایپی
                  </span>
                  <span className="border border-border bg-paper px-2.5 py-1 text-xs text-ink-soft rounded-[6px_3px_8px_3px] shadow-soft">
                    ✓ تنظیم نیم‌فاصله‌ها و ویرگول
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
    <p dir="rtl" className="whitespace-pre-wrap text-base sm:text-lg leading-relaxed text-ink font-medium">
      {tokens.map((token, idx) => {
        if (!token.trim()) return <span key={idx}>{token}</span>
        const cleanToken = token.trim().replace(/[.,!؟،؛]/g, '')
        const isChanged = !origTokens.has(cleanToken)
        return isChanged ? (
          <mark key={idx} className="v-marginalia-diff-add not-italic">
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
