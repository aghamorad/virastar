'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useHistory } from '@/hooks/useHistory'
import { getMode } from '@/domain/modes'
import { saveDraft } from '@/services/draft'
import { Star } from '../Star'
import { ModeGlyph } from '../editor/ModeGlyph'
import { CopyGlyph, CheckGlyph } from '../Glyphs'

function faDate(ts: number): string {
  try {
    return new Date(ts).toLocaleString('fa-IR', {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  } catch {
    return ''
  }
}

function countWords(s: string): number {
  const m = s.match(/[؀-ۿ][؀-ۿ‌]*/g)
  return m ? m.length : 0
}

export function HistoryScreen() {
  const { entries, remove, clear } = useHistory()
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [search, setSearch] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  function reopen(e: (typeof entries)[number]) {
    saveDraft({ input: e.input, modeId: e.modeId })
    router.push('/edit')
  }

  async function copyEntry(id: string, text: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch {
      // Ignored
    }
  }

  const filtered = entries.filter((e) => {
    if (!search.trim()) return true
    return (
      e.title.includes(search) ||
      e.output.includes(search) ||
      e.input.includes(search)
    )
  })

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center max-w-lg mx-auto">
        <div className="v-card p-8 shadow-card w-full text-center relative">
          <div className="sketch-tape" aria-hidden="true" />
          <div className="w-14 h-14 rounded-[10px_5px_12px_6px] border border-border bg-highlight/60 flex items-center justify-center text-brand mx-auto mb-4 shadow-soft">
            <Star size={28} />
          </div>
          <h1 className="text-2xl font-bold text-ink mb-2">دفترچهٔ نگارش خالی است</h1>
          <p className="text-xs sm:text-sm font-normal leading-relaxed text-ink-soft mb-6">
            هنوز متنی در این دفترچه ثبت نشده است. هر متنی را در میز ویرایش تحریر کنید، با دکمهٔ «ثبت در دفترچه» در اینجا ماندگار می‌شود.
          </p>
          <Link
            href="/edit"
            className="v-btn-primary text-sm inline-flex items-center gap-2"
          >
            <span>✒️ ورود به میز کار و آغاز نگارش</span>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header */}
      <header className="v-card p-6 flex flex-wrap items-center justify-between gap-4 relative">
        <div className="sketch-tape" aria-hidden="true" />
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="sketch-blue-note text-xs">
              ✎ بایگانی محلی دستگاه
            </span>
            <span className="sketch-highlight text-xs font-bold">
              حفظ ۱۰۰٪ حریم شخصی
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-ink tracking-tight">دفتر نگارش‌های من</h1>
          <p className="mt-1 text-xs sm:text-sm text-ink-soft font-normal">
            {entries.length.toLocaleString('fa-IR')} دست‌نوشتهٔ ثبت‌شده در حافظهٔ آفلاین مرورگر
          </p>
        </div>

        <div className="flex items-center gap-2">
          {confirming ? (
            <div className="flex items-center gap-2 p-1.5 bg-paper rounded-[8px_4px_10px_4px] border border-border">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="px-3 py-1 text-xs font-bold text-ink-soft hover:text-ink cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={() => {
                  clear()
                  setConfirming(false)
                }}
                className="v-btn-primary px-3 py-1 text-xs font-bold"
              >
                تأیید پاک‌کردن همه
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="v-btn-ghost px-3 py-1.5 text-xs font-bold text-brand hover:border-brand"
            >
              پاک کردن همه
            </button>
          )}
        </div>
      </header>

      {/* Search Filter */}
      {entries.length > 2 && (
        <div className="relative">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="جست‌وجو در متن یا عنوان دست‌نوشته‌ها…"
            className="v-field text-sm py-2.5 px-4"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute end-3 top-1/2 -translate-y-1/2 text-xs font-bold text-ink-soft hover:text-ink"
            >
              ✕ پاک کردن
            </button>
          )}
        </div>
      )}

      {/* Folios List */}
      <ul className="space-y-4">
        {filtered.map((e) => {
          const mode = getMode(e.modeId)
          const words = countWords(e.output)
          const isCopied = copiedId === e.id

          return (
            <li
              key={e.id}
              className="v-card p-5 hover:border-ink hover:rotate-[-0.3deg] transition-all flex flex-col justify-between"
            >
              {/* Header */}
              <div className="flex flex-wrap items-center justify-between gap-3 mb-3 pb-3 border-b border-border">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px_4px_10px_4px] bg-paper border border-border text-brand shadow-soft">
                    <ModeGlyph modeId={e.modeId} size={18} />
                  </span>
                  <div>
                    <h3 className="font-bold text-sm sm:text-base text-ink line-clamp-1">{e.title}</h3>
                    <p className="text-xs text-ink-soft font-normal">
                      لحن «{mode.label}» · {faDate(e.at)} · {words.toLocaleString('fa-IR')} واژه
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => copyEntry(e.id, e.output)}
                    className="v-btn-ghost text-xs px-2.5 py-1 font-bold flex items-center gap-1"
                  >
                    {isCopied ? <CheckGlyph size={14} className="text-success" /> : <CopyGlyph size={14} />}
                    <span>{isCopied ? 'کپی شد' : 'کپی'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => reopen(e)}
                    className="v-btn-ghost text-xs px-3 py-1 font-bold bg-highlight/50 hover:bg-highlight"
                  >
                    <span>✒️ ویرایش مجدد</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(e.id)}
                    className="v-btn-ghost text-xs px-2 py-1 text-brand hover:border-brand"
                    title="حذف این نوشته"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Text Snippet */}
              <p className="text-xs sm:text-sm leading-relaxed text-ink/90 font-normal line-clamp-3 bg-paper p-3 rounded-[8px_4px_10px_4px] border border-border">
                {e.output}
              </p>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
