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
        <div className="rounded-none border-4 border-black bg-emphasis p-8 shadow-[8px_8px_0px_#000] w-full text-center">
          <div className="w-16 h-16 rounded-none border-3 border-black bg-white flex items-center justify-center text-black mx-auto mb-4 shadow-[4px_4px_0px_#000]">
            <Star size={36} className="text-signal fill-signal" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-black mb-2 uppercase">دفتر نگارش خالی است</h1>
          <p className="text-xs sm:text-sm font-bold leading-6 text-black/85 mb-6">
            هنوز متنی ذخیره نکرده‌اید. هر متنی را در میز ویرایش تحریر کنید، با دکمهٔ «ثبت در دفتر نگارش» در این دفتر برای همیشه ثبت می‌شود.
          </p>
          <Link
            href="/edit"
            className="inline-flex items-center gap-2 rounded-none border-3 border-black bg-signal px-6 py-3 text-sm font-black text-white shadow-[4px_4px_0px_#000] hover:bg-black hover:text-emphasis active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-none cursor-pointer uppercase"
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
      <header className="flex flex-wrap items-center justify-between gap-4 border-b-4 border-black pb-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-none border-2 border-black bg-emphasis text-black text-xs font-black shadow-[2px_2px_0px_#000] uppercase mb-2">
            <Star size={13} className="text-signal fill-signal" />
            <span>بایگانی محلی و امن اسناد</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-ink tracking-tight uppercase">دفتر نگارش‌های من</h1>
          <p className="mt-1 text-xs sm:text-sm text-ink-soft font-bold">
            {entries.length.toLocaleString('fa-IR')} دست‌نوشتهٔ ثبت‌شده در حافظهٔ آفلاین دستگاه
          </p>
        </div>

        <div className="flex items-center gap-2">
          {confirming ? (
            <div className="flex items-center gap-2 p-1.5 bg-signal/20 rounded-none border-3 border-black shadow-[3px_3px_0px_#000]">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="rounded-none border-2 border-black bg-white px-3 py-1 text-xs font-black text-black hover:bg-neutral-200 cursor-pointer shadow-[2px_2px_0px_#000]"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={() => {
                  clear()
                  setConfirming(false)
                }}
                className="rounded-none border-2 border-black bg-signal text-white px-3 py-1 text-xs font-black shadow-[2px_2px_0px_#000] hover:bg-black hover:text-white cursor-pointer"
              >
                تأیید پاک‌کردن همه
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="rounded-none border-3 border-black bg-white px-3 py-1.5 text-xs font-black text-signal shadow-[3px_3px_0px_#000] hover:bg-signal hover:text-white transition-none cursor-pointer"
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
            className="w-full rounded-none border-3 border-black bg-white px-4 py-2.5 text-sm font-black text-black shadow-[4px_4px_0px_#000] outline-none focus:shadow-[6px_6px_0px_#000] transition-none"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute end-3 top-1/2 -translate-y-1/2 rounded-none border-2 border-black bg-emphasis px-2 py-0.5 text-xs font-black text-black shadow-[1px_1px_0px_#000] hover:bg-signal hover:text-white"
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
              className="rounded-none border-4 border-black bg-white shadow-[6px_6px_0px_#000] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[8px_8px_0px_#000] transition-none p-5 flex flex-col justify-between"
            >
              {/* Header */}
              <div className="flex flex-wrap items-center justify-between gap-3 mb-3 pb-3 border-b-3 border-black">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-none border-2 border-black bg-emphasis text-black shadow-[2px_2px_0px_#000]">
                    <ModeGlyph modeId={e.modeId} size={20} />
                  </span>
                  <div>
                    <h3 className="font-black text-base text-ink line-clamp-1">{e.title}</h3>
                    <p className="text-xs font-bold text-ink-soft">
                      لحن «{mode.label}» · {faDate(e.at)} · {words.toLocaleString('fa-IR')} واژه
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => copyEntry(e.id, e.output)}
                    className="rounded-none border-2 border-black bg-white text-xs px-2.5 py-1 font-black text-black shadow-[2px_2px_0px_#000] hover:bg-field active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-none flex items-center gap-1 cursor-pointer"
                  >
                    {isCopied ? <CheckGlyph size={14} className="text-signal" /> : <CopyGlyph size={14} />}
                    <span>{isCopied ? 'کپی شد' : 'کپی'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => reopen(e)}
                    className="rounded-none border-2 border-black bg-emphasis text-xs px-3 py-1 font-black text-black shadow-[2px_2px_0px_#000] hover:bg-black hover:text-emphasis active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-none cursor-pointer"
                  >
                    <span>✒️ ویرایش مجدد</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(e.id)}
                    className="rounded-none border-2 border-black bg-signal/20 text-xs px-2.5 py-1 font-black text-black shadow-[2px_2px_0px_#000] hover:bg-signal hover:text-white active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-none cursor-pointer"
                    title="حذف این نوشته"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Text Snippet */}
              <p className="text-xs sm:text-sm leading-7 text-black font-bold line-clamp-3 bg-paper p-3.5 rounded-none border-2 border-black shadow-[2px_2px_0px_#000]">
                {e.output}
              </p>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
