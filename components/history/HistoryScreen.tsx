'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useHistory } from '@/hooks/useHistory'
import { getMode } from '@/domain/modes'
import { clearDraft, saveDraft } from '@/services/draft'
import { Star } from '../Star'
import { ModeGlyph } from '../editor/ModeGlyph'

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

export function HistoryScreen() {
  const { entries, remove, clear } = useHistory()
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)

  function reopen(e: (typeof entries)[number]) {
    saveDraft({ input: e.input, modeId: e.modeId })
    router.push('/edit')
  }

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-20 text-center">
        <Star size={44} className="text-brand opacity-40" hollow />
        <h1 className="text-2xl font-black">نوشته‌های من</h1>
        <p className="max-w-sm text-sm leading-7 text-ink-soft">
          هنوز نوشته‌ای ذخیره نشده. بعد از هر ویرایش، «ذخیره در نوشته‌ها» را بزن تا اینجا نگه‌داری
          شود.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black">نوشته‌های من</h1>
          <p className="mt-1 text-sm text-ink-soft">{entries.length} نوشته ذخیره شده</p>
        </div>
        {confirming ? (
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setConfirming(false)} className="v-btn-ghost px-3 py-1.5 text-xs">
              انصراف
            </button>
            <button
              type="button"
              onClick={() => {
                clear()
                setConfirming(false)
              }}
              className="v-btn-primary px-3 py-1.5 text-xs"
            >
              همه را پاک کن
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirming(true)} className="v-btn-ghost px-3 py-1.5 text-xs">
            پاک کردن همه
          </button>
        )}
      </header>

      <ul className="space-y-3">
        {entries.map((e) => {
          const mode = getMode(e.modeId)
          return (
            <li key={e.id} className="v-card shadow-soft p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
                    <ModeGlyph modeId={e.modeId} size={20} />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-extrabold">{e.title}</p>
                    <p className="mt-0.5 text-xs font-bold text-ink-soft">
                      {mode.label} · {faDate(e.at)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => reopen(e)} className="v-btn-ghost px-3 py-1.5 text-xs">
                    ادامهٔ ویرایش
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(e.id)}
                    aria-label="حذف"
                    className="v-btn-ghost px-2.5 py-1.5 text-xs"
                  >
                    حذف
                  </button>
                </div>
              </div>

              <div className="mt-3 grid gap-2 text-sm leading-6 sm:grid-cols-2">
                <div className="rounded-xl bg-paper px-3 py-2">
                  <span className="mb-1 block text-[0.65rem] font-black text-ink-soft">متن تو</span>
                  <p className="line-clamp-3 text-ink/80">{e.input}</p>
                </div>
                <div className="rounded-xl bg-paper-deep px-3 py-2">
                  <span className="mb-1 block text-[0.65rem] font-black text-ink-soft">نتیجه</span>
                  <p className="line-clamp-3">{e.output}</p>
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
