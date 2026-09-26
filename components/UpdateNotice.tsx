'use client'

import { DOWNLOAD, faVersion } from '@/domain/updates'
import { useUpdate } from '@/hooks/useUpdate'
import { Star } from './Star'

/**
 * The one place the app mentions its own age.
 *
 * Silent unless a newer release is confirmed, so nothing appears for a copy
 * that is current or for one that could not ask. It is a bar and not a dialog:
 * the app is fully usable either way, and a notice that interrupts a writer
 * mid-sentence to talk about packaging has its priorities wrong.
 */
export function UpdateNotice() {
  const { newer } = useUpdate()
  if (!newer) return null

  return (
    <div className="border-b border-border bg-accent/10">
      <a
        href={DOWNLOAD}
        target="_blank"
        rel="noreferrer"
        className="mx-auto flex w-full max-w-5xl items-center gap-2 px-4 py-2.5 text-sm font-bold text-ink transition-colors hover:text-brand"
      >
        <Star size={16} className="shrink-0 text-accent" />
        <span>
          نسخهٔ <span className="font-black">{faVersion(newer)}</span> ویراستار منتشر شده است.
        </span>
        <span className="v-link ms-auto shrink-0">دریافت</span>
      </a>
    </div>
  )
}
