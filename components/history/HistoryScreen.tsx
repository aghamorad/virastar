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
      <div className="flex flex-col items-center justify-center py-20 text-center max-w-md mx-auto">
        <div className="w-16 h-16 rounded-full bg-brand/10 flex items-center justify-center text-brand mb-4">
          <Star size={36} hollow />
        </div>
        <h1 className="text-2xl font-black text-ink mb-2">دفتر نگارش خالی است</h1>
        <p className="text-sm leading-7 text-ink-soft mb-6">
          هنوز نوشته‌ای ذخیره نکرده‌اید. هر متنی را در میز ویرایش بنویسید، با دکمهٔ «ثبت در دفتر نگارش» اینجا ماندگار می‌شود.
        </p>
        <Link href="/edit" className="v-seal-master text-sm">
          <span>✒️ ورود به میز کار و نگارش اولین متن</span>
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border/70 pb-5">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand/10 text-brand text-xs font-black mb-2">
            <Star size={13} />
            <span>بایگانی محلی و امن اسناد</span>
          </div>
          <h1 className="text-3xl font-black text-ink">دفتر نگارش‌های من</h1>
          <p className="mt-1 text-xs sm:text-sm text-ink-soft">
            {entries.length.toLocaleString('fa-IR')} دست‌نوشتهٔ ثبت‌شده در حافظهٔ آفلاین دستگاه
          </p>
        </div>

        <div className="flex items-center gap-2">
          {confirming ? (
            <div className="flex items-center gap-2 p-1 bg-red-500/10 rounded-xl border border-red-500/20">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="px-3 py-1.5 text-xs font-bold text-ink-soft hover:text-ink cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={() => {
                  clear()
                  setConfirming(false)
                }}
                className="px-3 py-1.5 text-xs font-black bg-red-600 text-white rounded-lg cursor-pointer shadow-xs"
              >
                پاک کردن تمام نوشته‌ها
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="v-btn-ghost px-3 py-1.5 text-xs font-bold text-red-700 hover:border-red-400"
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
            placeholder="جست‌وجو در متن نوشته‌ها یا عنوان…"
            className="v-field text-sm py-2.5 px-4"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute end-3 top-1/2 -translate-y-1/2 text-xs font-bold text-ink-soft hover:text-ink"
            >
              ✕ پاک کردن جست‌وجو
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
              className="v-folio p-5 transition-all hover:shadow-card border border-border/80 flex flex-col justify-between"
            >
              {/* Header */}
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pb-2.5 border-b border-border/60">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand/10 text-brand border border-brand/20">
                    <ModeGlyph modeId={e.modeId} size={18} />
                  </span>
                  <div>
                    <h3 className="font-black text-sm sm:text-base text-ink line-clamp-1">{e.title}</h3>
                    <p className="text-[11px] font-bold text-ink-soft">
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
                    className="v-btn-primary text-xs px-3 py-1 font-black"
                  >
                    <span>✒️ ویرایش مجدد</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(e.id)}
                    className="v-btn-ghost text-xs px-2 py-1 text-red-700 hover:text-red-800"
                    title="حذف این نوشته"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Text Snippet */}
              <p className="text-xs sm:text-sm leading-7 text-ink/85 line-clamp-3 font-medium bg-paper/40 p-3 rounded-xl border border-border/50">
                {e.output}
              </p>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
