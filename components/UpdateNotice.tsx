'use client'

import { DOWNLOAD, faVersion } from '@/domain/updates'
import { useUpdate } from '@/hooks/useUpdate'
import { Star } from './Star'

/**
 * Sketch update notice banner.
 * Warm yellow highlighter strip with soft pencil border and organic handwritten note feel.
 */
export function UpdateNotice() {
  const { newer } = useUpdate()
  if (!newer) return null

  return (
    <div className="border-b border-border bg-highlight/70 text-ink shadow-soft py-2 px-4">
      <a
        href={DOWNLOAD}
        target="_blank"
        rel="noreferrer"
        className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 text-xs sm:text-sm font-bold text-ink hover:text-brand transition-colors"
      >
        <div className="flex items-center gap-2">
          <Star size={15} className="shrink-0 text-brand fill-brand" />
          <span>
            یادداشت به‌روزرسانی: نسخهٔ جدید <span className="underline decoration-dotted font-extrabold">{faVersion(newer)}</span> ویراستار آماده دریافت است!
          </span>
        </div>
        <span className="border border-ink bg-surface text-ink px-2.5 py-0.5 text-xs font-bold rounded-[6px_3px_8px_4px] shadow-soft hover:bg-white">
          دریافت برگهٔ جدید ✎
        </span>
      </a>
    </div>
  )
}
