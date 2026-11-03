'use client'

import { useEffect, useRef, useState } from 'react'
import { THEMES } from '@/domain/themes'
import { applyTheme, useActiveTheme } from '@/hooks/useActiveTheme'
import { playTactileSound } from '@/domain/audioFeedback'

export function ThemeSwitcher({ compact = false }: { compact?: boolean }) {
  const active = useActiveTheme()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const theme = THEMES.find((t) => t.id === active) ?? THEMES[0]

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v)
          playTactileSound(theme.id, 'tap')
        }}
        className="flex items-center gap-2 border-3 border-black bg-white px-3 py-1.5 text-xs font-black shadow-[3px_3px_0px_#000] hover:bg-[#ffed00] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[4px_4px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0px_#000] cursor-pointer"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`تغییر پوسته — فعلی: ${theme.label}`}
      >
        <span className="text-sm leading-none" aria-hidden="true">{theme.icon}</span>
        {!compact && (
          <span className="font-black text-xs sm:text-sm text-black">
            {theme.label}
          </span>
        )}
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="پوسته‌ها"
          className="absolute end-0 top-[calc(100%+0.5rem)] z-50 w-80 max-h-[85vh] overflow-y-auto border-4 border-black bg-[#fff5d6] p-2.5 shadow-[8px_8px_0px_#000]"
        >
          <div className="px-2 py-1.5 border-b-3 border-black mb-2 flex items-center justify-between bg-black text-white">
            <span className="text-xs font-black uppercase">پوسته‌های نئوبروتال ({THEMES.length})</span>
            <span className="text-[10px] font-bold text-yellow-300">سایه‌های تخت و هارد</span>
          </div>

          <div className="space-y-2">
            {THEMES.map((t) => {
              const isActive = t.id === active
              return (
                <button
                  key={t.id}
                  role="option"
                  aria-selected={isActive}
                  onClick={() => {
                    applyTheme(t.id)
                    playTactileSound(t.id, 'special')
                    setOpen(false)
                  }}
                  className={`flex w-full items-center gap-2.5 p-2 text-start transition-all cursor-pointer border-3 border-black ${
                    isActive
                      ? 'bg-[#ffed00] text-black shadow-[4px_4px_0px_#000] translate-x-[-1px] translate-y-[-1px]'
                      : 'bg-white text-black hover:bg-[#d4bdff] shadow-[2px_2px_0px_#000]'
                  }`}
                >
                  <span className="text-xl shrink-0 leading-none">{t.icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-black text-xs sm:text-sm truncate text-black">{t.label}</span>
                      <span className="text-[10px] px-1.5 py-0.2 bg-black text-white font-black shrink-0">
                        {t.taste}
                      </span>
                    </div>

                    <div className="mt-1 flex items-center gap-1.5">
                      <div className="flex items-center gap-1">
                        <span
                          className="w-3.5 h-3.5 border-2 border-black inline-block"
                          style={{ backgroundColor: t.palette.paper }}
                          title="کاغذ"
                        />
                        <span
                          className="w-3.5 h-3.5 border-2 border-black inline-block"
                          style={{ backgroundColor: t.palette.brand }}
                          title="نشان"
                        />
                        <span
                          className="w-3.5 h-3.5 border-2 border-black inline-block"
                          style={{ backgroundColor: t.palette.accent }}
                          title="چاشنی"
                        />
                      </div>
                      <span className="text-[11px] truncate text-black/80 font-bold">
                        {t.blurb}
                      </span>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
