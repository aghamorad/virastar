'use client'

import { DOWNLOAD, faVersion } from '@/domain/updates'
import { useUpdate } from '@/hooks/useUpdate'
import { Star } from './Star'

/**
 * Neo-Brutalist update notification bar.
 * Sharp yellow alert strip with 4px solid black bottom border and solid offset shadow.
 */
export function UpdateNotice() {
  const { newer } = useUpdate()
  if (!newer) return null

  return (
    <div className="border-b-4 border-black bg-emphasis text-black shadow-[0_4px_0_#000]">
      <a
        href={DOWNLOAD}
        target="_blank"
        rel="noreferrer"
        className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-2 text-sm font-black text-black hover:bg-black hover:text-white transition-none"
      >
        <div className="flex items-center gap-2">
          <Star size={16} className="shrink-0 text-signal fill-signal" />
          <span>
            نسخهٔ جدید <span className="underline decoration-2">{faVersion(newer)}</span> ویراستار آماده دریافت است!
          </span>
        </div>
        <span className="rounded-none border-2 border-black bg-black text-white px-3 py-0.5 text-xs font-black shadow-[2px_2px_0px_#000]">
          دریافت رایگان ←
        </span>
      </a>
    </div>
  )
}
