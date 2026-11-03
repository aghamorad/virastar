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
        className="flex items-center gap-2 border border-border bg-surface px-3 py-1.5 text-xs font-bold rounded-[8px_4px_12px_5px] shadow-soft hover:bg-highlight hover:border-ink hover:rotate-[-0.5deg] active:translate-y-[1px] cursor-pointer transition-all"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`تغییر پوسته — فعلی: ${theme.label}`}
      >
        <span className="text-sm leading-none" aria-hidden="true">{theme.icon}</span>
        {!compact && (
          <span className="font-bold text-xs sm:text-sm text-ink">
            {theme.label}
          </span>
        )}
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="پوسته‌ها"
          className="absolute end-0 top-[calc(100%+0.5rem)] z-50 w-80 max-h-[85vh] overflow-y-auto border border-border bg-surface p-3 rounded-[12px_6px_14px_6px] shadow-card"
        >
          <div className="px-2 py-1.5 border-b border-border/80 mb-2 flex items-center justify-between text-ink">
            <span className="text-xs font-bold text-accent">✎ برگه‌های یادداشت و طرح ({THEMES.length})</span>
            <span className="text-[10px] text-ink-soft">دست‌ساز و ارگانیک</span>
          </div>

          <div className="space-y-1.5">
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
                  className={`flex w-full items-center gap-2.5 p-2 text-start transition-all cursor-pointer border rounded-[8px_4px_10px_4px] ${
                    isActive
                      ? 'bg-highlight text-ink border-ink shadow-soft font-extrabold'
                      : 'bg-paper text-ink border-transparent hover:border-border hover:bg-paper-deep'
                  }`}
                >
                  <span className="text-xl shrink-0 leading-none">{t.icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-bold text-xs sm:text-sm truncate text-ink">{t.label}</span>
                      <span className="text-[10px] px-1.5 py-0.5 bg-paper-deep text-ink-soft border border-border rounded-[4px] shrink-0 font-medium">
                        {t.taste}
                      </span>
                    </div>

                    <div className="mt-1 flex items-center gap-1.5">
                      <div className="flex items-center gap-1">
                        <span
                          className="w-3.5 h-3.5 rounded-full border border-black/20 inline-block shadow-xs"
                          style={{ backgroundColor: t.palette.paper }}
                          title="کاغذ"
                        />
                        <span
                          className="w-3.5 h-3.5 rounded-full border border-black/20 inline-block shadow-xs"
                          style={{ backgroundColor: t.palette.brand }}
                          title="نشان"
                        />
                        <span
                          className="w-3.5 h-3.5 rounded-full border border-black/20 inline-block shadow-xs"
                          style={{ backgroundColor: t.palette.accent }}
                          title="چاشنی"
                        />
                      </div>
                      <span className="text-[11px] truncate text-ink-soft font-normal">
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
