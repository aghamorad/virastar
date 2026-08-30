'use client'

import { useEffect, useRef, useState } from 'react'
import { MODES, getMode, type WritingMode } from '@/domain/modes'
import { runEdit, type EditResult } from '@/domain/engine'
import { restoreModel } from '@/domain/engines/browser'
import { useSettings } from '@/hooks/useSettings'
import { useHistory } from '@/hooks/useHistory'
import { useDictation } from '@/hooks/useDictation'
import { clearDraft, readDraft } from '@/services/draft'
import { Star } from '../Star'
import { ModeGlyph } from './ModeGlyph'
import { CheckGlyph, CopyGlyph, MicGlyph, SaveGlyph } from '../Glyphs'

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
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<EditResult | null>(null)
  const [liveOutput, setLiveOutput] = useState('')
  const [copied, setCopied] = useState(false)
  const [saved, setSaved] = useState(false)
  const [settings] = useSettings()
  const { add } = useHistory()
  const resultRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const dictation = useDictation('fa-IR')
  const anchorRef = useRef<{ before: string; after: string } | null>(null)

  const mode = getMode(modeId)
  const words = countWords(input)

  useEffect(() => {
    if (initialMode && getMode(initialMode)) setModeId(initialMode)
  }, [initialMode])

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
          <h2 className="text-sm font-black text-ink-soft">انتخاب سبک</h2>
          <button
            type="button"
            onClick={() => setInput(SAMPLE)}
            className="v-btn-ghost px-3 py-1 text-xs"
          >
            مثال
          </button>
        </div>

        <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1">
          {MODES.map((m) => (
            <ModeChip key={m.id} mode={m} active={m.id === modeId} onSelect={() => setModeId(m.id)} />
          ))}
        </div>
        <p className="mt-3 text-sm leading-6 text-ink-soft">
          <span className="font-extrabold text-ink">{mode.label}</span> — {mode.description}
        </p>
      </section>

      <div className="grid gap-5 md:grid-cols-2">
        {/* Original */}
        <section className="md:order-1">
          <div className="mb-2 flex items-center justify-between gap-2">
            <label htmlFor="virastar-input" className="block text-sm font-black text-ink-soft">
              متن تو
            </label>
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
          <textarea
            id="virastar-input"
            ref={inputRef}
            dir="rtl"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="بنویس… هر نوشته‌ای، از پیام تا نامه"
            className="v-field min-h-64 resize-y text-lg leading-8 md:min-h-80"
          />
          {dictation.listening ? (
            <p className="mt-2 text-xs font-bold text-brand">
              در حال گوش دادن… برای تمام کردن دوباره روی «گفتار» بزن.
            </p>
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
                </>
              )}
            </button>
            <span className="text-xs font-bold text-ink-soft">
              {settings.engine === 'online' && settings.endpoint ? 'ویرایش آنلاین' : 'ویرایش آفلاین'}
            </span>
          </div>

          <div ref={resultRef} className="mt-4">
            {result ? (
              <div className="v-card shadow-card animate-fade-up overflow-hidden">
                <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
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
                  <span className="text-xs font-bold text-ink-soft">
                    {faNum(result.changed)} تغییر
                  </span>
                </div>

                <div className="px-4 py-4">
                  <p dir="rtl" className="whitespace-pre-wrap text-lg leading-8">
                    {result.output}
                  </p>

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

                <div className="flex gap-2 border-t border-border px-4 py-3">
                  <button type="button" onClick={handleCopy} className="v-btn-ghost flex-1">
                    {copied ? <CheckGlyph size={17} className="text-success" /> : <CopyGlyph size={17} />}
                    {copied ? 'کپی شد' : 'کپی'}
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
                  <p dir="rtl" className="whitespace-pre-wrap text-lg leading-8">
                    {liveOutput}
                  </p>
                  <p className="mt-3 text-xs font-bold text-ink-soft">در حال ویرایش…</p>
                </div>
              </div>
            ) : (
              <div className="v-card flex flex-col items-center gap-3 border-dashed px-6 py-12 text-center">
                <Star size={34} className="text-brand opacity-40" hollow />
                <p className="text-sm leading-7 text-ink-soft">
                  نتیجهٔ ویرایش اینجا می‌آید.
                  <br />
                  بنویس و «ویرایش کن» را بزن.
                </p>
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
