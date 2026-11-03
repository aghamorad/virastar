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

const SAMPLE =
  'امروز میخوام این نامه رو برای استادم بفرستم ولی خیلی خشک شده و من اصلا نمیدونم چطور بنویسمش. لطفا یه کاریش کنین که رسمی تر بشه. ممنون'

function faNum(n: number): string {
  return n.toLocaleString('fa-IR')
}

function countWords(s: string): number {
  const m = s.match(/[؀-ۿ][؀-ۿ‌]*/g)
  return m ? m.length : 0
}

export function EditorScreen({ initialMode }: { initialMode?: string }) {
  const [modeId, setModeId] = useState<string>(initialMode ?? 'tashih')
  const [activeCategory, setActiveCategory] = useState<'all' | 'practical' | 'playful'>('practical')
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<EditResult | null>(null)
  const [liveOutput, setLiveOutput] = useState('')
  const [copied, setCopied] = useState(false)
  const [saved, setSaved] = useState(false)
  const [showDiff, setShowDiff] = useState(false)
  const [showKeyboard, setShowKeyboard] = useState(false)
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
      setActiveCategory(getMode(initialMode).group)
    }
  }, [initialMode])

  // Global keyboard shortcuts (⌘+Enter for edit, ⌘+⇧+C for copy)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault()
        const text = input.trim()
        if (text && !busy) void handleEdit()
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'c' || e.key === 'C')) {
        if (result?.output) {
          e.preventDefault()
          void handleCopy()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [input, busy, result, modeId, settings])

  // Reuse a previously-downloaded model from the browser cache.
  useEffect(() => {
    if (settings.localModel) restoreModel(settings.localModel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.localModel])

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
    const res = await runEdit(text, modeId, settings, (partial) => setLiveOutput(partial))
    setResult(res)
    setBusy(false)
    setLiveOutput('')
    requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }))
  }

  async function handleCopy() {
    if (!result) return
    const ok = await copyText(result.output)
    if (ok) {
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    }
  }

  function handleSave() {
    if (!result) return
    add({ input: input.trim(), output: result.output, modeId, engine: result.engine })
    setSaved(true)
    setTimeout(() => setSaved(false), 1800)
  }

  async function handleShare() {
    if (!result) return
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: `ویراستار — متن به سبک ${mode.label}`,
          text: result.output,
        })
        return
      } catch {
        /* user dismissed share dialog or not permitted */
      }
    }
    await handleCopy()
  }

  function handleClear() {
    setInput('')
    setResult(null)
  }

  async function handlePaste() {
    try {
      const text = await navigator.clipboard.readText()
      if (text) setInput((prev) => (prev ? `${prev}\n${text}` : text))
    } catch {
      /* clipboard read not permitted */
    }
  }

  // Dictation replaces the current selection (or appends at the end) with what
  // is heard, so the anchor is fixed when the mic opens and stays stable while
  // interim results stream in.
  function toggleDictation() {
    if (dictation.listening) {
      dictation.stop()
      return
    }
    const ta = inputRef.current
    const start = ta ? ta.selectionStart : input.length
    const end = ta ? ta.selectionEnd : input.length
    anchorRef.current = { before: input.slice(0, start), after: input.slice(end) }
    dictation.start(
      (text) => {
        const anchor = anchorRef.current
        if (!anchor) return
        setInput(anchor.before + text + anchor.after)
      },
      () => {
        anchorRef.current = null
      },
    )
  }

  return (
    <div className="space-y-6">
      {/* سبک selection */}
      <section>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <h2 className="text-sm font-black text-ink-soft">سبک بازنویسی:</h2>
            <div className="flex rounded-lg bg-paper-deep p-0.5 border border-border text-xs font-bold">
              <button
                type="button"
                onClick={() => setActiveCategory('practical')}
                className={`rounded-md px-2.5 py-1 transition-colors ${
                  activeCategory === 'practical' ? 'bg-brand text-on-brand shadow-xs' : 'text-ink-soft hover:text-ink'
                }`}
              >
                کاربردی و اداری
              </button>
              <button
                type="button"
                onClick={() => setActiveCategory('playful')}
                className={`rounded-md px-2.5 py-1 transition-colors ${
                  activeCategory === 'playful' ? 'bg-brand text-on-brand shadow-xs' : 'text-ink-soft hover:text-ink'
                }`}
              >
                بازی با زبان و لحن
              </button>
              <button
                type="button"
                onClick={() => setActiveCategory('all')}
                className={`rounded-md px-2 py-1 transition-colors ${
                  activeCategory === 'all' ? 'bg-brand text-on-brand shadow-xs' : 'text-ink-soft hover:text-ink'
                }`}
              >
                همه
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setInput(SAMPLE)}
            className="v-btn-ghost px-3 py-1 text-xs"
            title="جای‌گذاری متن نمونه برای آزمایش"
          >
            متن نمونه
          </button>
        </div>

        <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1">
          {MODES.filter((m) => activeCategory === 'all' || m.group === activeCategory).map((m) => (
            <ModeChip
              key={m.id}
              mode={m}
              active={m.id === modeId}
              onSelect={() => {
                setModeId(m.id)
                playTactileSound(activeTheme, 'tap')
              }}
            />
          ))}
        </div>
        <p className="mt-3 text-sm leading-6 text-ink-soft">
          <span className="font-extrabold text-ink">{mode.label}</span> — {mode.description}
        </p>
      </section>

      <div className="grid gap-5 md:grid-cols-2">
        {/* Original */}
        <section className="md:order-1">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <label htmlFor="virastar-input" className="block text-sm font-black text-ink-soft">
              متن تو
            </label>
            <div className="flex flex-wrap items-center gap-1.5">
              {input.trim() && (
                <button
                  type="button"
                  onClick={handleEdit}
                  disabled={busy}
                  className="v-btn-primary px-3 py-1 text-xs md:hidden"
                >
                  {busy ? 'در حال ویرایش…' : 'ویرایش کن'}
                </button>
              )}
              {input && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="v-btn-ghost px-2.5 py-1 text-xs text-ink-soft hover:text-ink"
                  title="پاک کردن متن"
                >
                  پاک کردن
                </button>
              )}
              <button
                type="button"
                onClick={handlePaste}
                className="v-btn-ghost px-2.5 py-1 text-xs text-ink-soft hover:text-ink"
                title="جای‌گذاری از کلیپ‌بورد"
              >
                جای‌گذاری
              </button>
              {dictation.supported && (
                <button
                  type="button"
                  onClick={toggleDictation}
                  aria-pressed={dictation.listening}
                  aria-label={dictation.listening ? 'توقف گفتار' : 'گفتار به متن'}
                  className={`v-btn-ghost px-3 py-1 text-xs ${dictation.listening ? 'rec-live' : ''}`}
                >
                  <MicGlyph size={16} />
                  {dictation.listening ? 'گوش میکنم…' : 'گفتار'}
                </button>
              )}
            </div>
          </div>
          <textarea
            id="virastar-input"
            ref={inputRef}
            dir="rtl"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="بنویس… هر نوشته‌ای، از پیام تا نامه"
            className="v-field min-h-64 resize-y text-lg leading-8 md:min-h-80"
          />

          {/* Persian Smart Quick Bar (Toolbar) */}
          <div className="mt-2 flex flex-wrap items-center justify-between gap-1.5 rounded-xl bg-paper-deep p-2 border border-border">
            <div className="flex flex-wrap items-center gap-1">
              <button
                type="button"
                onClick={() => insertAtCursor('\u200c')}
                className="rounded-lg bg-paper px-2.5 py-1 text-xs font-black text-brand border border-border hover:bg-brand/10 transition-colors shadow-xs"
                title="نیم‌فاصله استاندارد فارسی"
              >
                نیم‌فاصله
              </button>
              <button
                type="button"
                onClick={() => insertAtCursor('«»')}
                className="rounded-lg bg-paper px-2 py-1 text-xs font-black text-ink border border-border hover:border-brand"
                title="گیومه فارسی"
              >
                « »
              </button>
              <button
                type="button"
                onClick={() => insertAtCursor('،')}
                className="rounded-lg bg-paper px-2 py-1 text-xs font-black text-ink border border-border hover:border-brand"
                title="ویرگول فارسی"
              >
                ،
              </button>
              <button
                type="button"
                onClick={() => insertAtCursor('؛')}
                className="rounded-lg bg-paper px-2 py-1 text-xs font-black text-ink border border-border hover:border-brand"
                title="نقطه‌ویرگول فارسی"
              >
                ؛
              </button>
              <button
                type="button"
                onClick={() => insertAtCursor('؟')}
                className="rounded-lg bg-paper px-2 py-1 text-xs font-black text-ink border border-border hover:border-brand"
                title="علامت سوال فارسی"
              >
                ؟
              </button>
              <button
                type="button"
                onClick={() => insertAtCursor('.')}
                className="rounded-lg bg-paper px-2 py-1 text-xs font-black text-ink border border-border hover:border-brand"
                title="نقطه پایان جمله"
              >
                .
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowKeyboard(!showKeyboard)}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold transition-all border ${
                showKeyboard
                  ? 'bg-brand text-on-brand border-brand shadow-xs'
                  : 'bg-paper text-ink border-border hover:border-brand shadow-xs'
              }`}
            >
              <span>⌨️</span>
              <span>{showKeyboard ? 'بستن کیبورد' : 'صفحه‌کلید فارسی'}</span>
            </button>
          </div>

          {showKeyboard && (
            <PersianKeyboard
              onInsert={insertAtCursor}
              onBackspace={backspaceAtCursor}
              onHalfSpace={() => insertAtCursor('\u200c')}
              onNewLine={() => insertAtCursor('\n')}
              onClose={() => setShowKeyboard(false)}
            />
          )}
          {dictation.listening ? (
            <p className="mt-2 text-xs font-bold text-brand">
              در حال گوش دادن… برای تمام کردن دوباره روی «گفتار» بزن.
            </p>
          ) : dictation.error ? (
            <div className="mt-2 flex items-center justify-between rounded-lg bg-brand/10 px-3 py-2 text-xs font-bold text-brand">
              <span>{dictation.error}</span>
              <button
                type="button"
                onClick={dictation.clearError}
                className="mr-2 text-sm text-ink-soft hover:text-ink"
                title="بستن پیام"
              >
                ✕
              </button>
            </div>
          ) : (
            <p className="mt-2 text-xs text-ink-soft">
              {faNum(words)} کلمه · {faNum(input.length)} کاراکتر
            </p>
          )}
        </section>

        {/* Action + result */}
        <section className="md:order-2">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleEdit}
              disabled={busy || !input.trim()}
              className="v-btn-primary w-full px-8 text-lg md:w-auto"
            >
              {busy ? (
                <>
                  <Star size={18} className="animate-star-busy" />
                  در حال ویرایش…
                </>
              ) : (
                <>
                  <Star size={18} />
                  ویرایش کن
                  <span className="hidden md:inline-block mr-2 text-xs opacity-60 font-mono">⌘↵</span>
                </>
              )}
            </button>
            <span className="text-xs font-bold text-ink-soft">
              {settings.engine === 'online' ? 'ویرایش هوشمند' : 'ویرایش آفلاین'}
            </span>
          </div>

          <div ref={resultRef} className="mt-4">
            {result ? (
              <div className="v-card shadow-card animate-fade-up overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Star size={15} className="text-brand" />
                    <span className="font-black">نتیجه</span>
                    <span className="rounded-full bg-brand/10 px-2.5 py-0.5 text-xs font-bold text-brand">
                      {mode.label}
                    </span>
                    <span className="rounded-full bg-paper-deep px-2.5 py-0.5 text-xs font-bold text-ink-soft">
                      {result.engine === 'online' ? 'آنلاین' : 'آفلاین'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowDiff((v) => !v)}
                      className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition-colors ${
                        showDiff
                          ? 'bg-brand/15 border-brand text-brand'
                          : 'bg-paper-deep border-border text-ink-soft hover:text-ink'
                      }`}
                    >
                      {showDiff ? 'متن یکدست' : 'نمایش تفاوت‌ها'}
                    </button>
                    <span className="text-xs font-bold text-ink-soft">
                      {faNum(result.changed)} تغییر
                    </span>
                  </div>
                </div>

                <div className="px-4 py-4">
                  {showDiff ? (
                    <DiffText original={input} modified={result.output} />
                  ) : (
                    <p dir="rtl" className="whitespace-pre-wrap font-serif text-lg leading-8">
                      {result.output}
                    </p>
                  )}

                  {result.notes.length > 0 && (
                    <ul className="mt-4 space-y-1 border-t border-border pt-3">
                      {result.notes.map((n, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs leading-5 text-ink-soft">
                          <Star size={9} className="mt-1.5 shrink-0 text-brand" />
                          {n}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 border-t border-border px-4 py-3">
                  <button type="button" onClick={handleCopy} className="v-btn-ghost flex-1">
                    {copied ? <CheckGlyph size={17} className="text-success" /> : <CopyGlyph size={17} />}
                    {copied ? 'کپی شد' : 'کپی'}
                    <span className="hidden md:inline-block mr-1 text-xs opacity-50 font-mono">⌘⇧C</span>
                  </button>
                  <button type="button" onClick={handleShare} className="v-btn-ghost flex-1" title="اشتراک‌گذاری در پیام‌رسان‌ها">
                    <ShareGlyph size={17} />
                    ارسال
                  </button>
                  <button type="button" onClick={handleSave} className="v-btn-ghost flex-1">
                    {saved ? <CheckGlyph size={17} className="text-success" /> : <SaveGlyph size={17} />}
                    {saved ? 'ذخیره شد' : 'ذخیره در نوشته‌ها'}
                  </button>
                </div>
              </div>
            ) : busy && liveOutput ? (
              <div className="v-card shadow-card animate-fade-up overflow-hidden">
                <div className="flex items-center gap-2 border-b border-border px-4 py-3">
                  <Star size={15} className="animate-star-busy text-brand" />
                  <span className="font-black">نتیجه</span>
                  <span className="rounded-full bg-brand/10 px-2.5 py-0.5 text-xs font-bold text-brand">
                    {mode.label}
                  </span>
                </div>
                <div className="px-4 py-4">
                  <p dir="rtl" className="whitespace-pre-wrap font-serif text-lg leading-8">
                    {liveOutput}
                  </p>
                  <p className="mt-3 text-xs font-bold text-ink-soft">در حال ویرایش…</p>
                </div>
              </div>
            ) : (
              <div className="v-card flex flex-col items-center gap-3 border-dashed px-6 py-10 text-center">
                <Star size={36} className="text-brand opacity-45" hollow />
                <div>
                  <p className="text-base font-extrabold text-ink">
                    آماده برای ویرایش به سبک «{mode.label}»
                  </p>
                  <p className="mt-1.5 text-xs leading-6 text-ink-soft max-w-sm mx-auto">
                    {mode.description}
                  </p>
                </div>
                <div className="mt-2 flex flex-wrap justify-center gap-2">
                  <span className="rounded-full bg-paper-deep px-3 py-1 text-xs font-bold text-ink-soft border border-border">
                    ✓ نشانه‌گذاری و نقطه خودکار
                  </span>
                  <span className="rounded-full bg-paper-deep px-3 py-1 text-xs font-bold text-ink-soft border border-border">
                    ✓ نیم‌فاصله‌های هوشمند
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

function ModeChip({
  mode,
  active,
  onSelect,
}: {
  mode: WritingMode
  active: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={`v-chip ${active ? 'v-chip-active' : ''}`}
    >
      <ModeGlyph modeId={mode.id} size={16} className={active ? 'text-on-brand' : 'text-brand'} />
      {mode.label}
    </button>
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

function DiffText({ original, modified }: { original: string; modified: string }) {
  const origTokens = new Set(
    original
      .split(/\s+/)
      .map((s) => s.trim().replace(/[.,!؟،؛]/g, ''))
      .filter(Boolean),
  )
  const tokens = modified.split(/(\s+)/)
  return (
    <p dir="rtl" className="whitespace-pre-wrap font-serif text-lg leading-8">
      {tokens.map((token, idx) => {
        if (!token.trim()) return <span key={idx}>{token}</span>
        const cleanToken = token.trim().replace(/[.,!؟،؛]/g, '')
        const isChanged = !origTokens.has(cleanToken)
        return isChanged ? (
          <mark key={idx} className="rounded bg-brand/15 px-1 font-bold text-brand not-italic">
            {token}
          </mark>
        ) : (
          <span key={idx}>{token}</span>
        )
      })}
    </p>
  )
}
