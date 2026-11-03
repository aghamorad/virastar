'use client'

import { useEffect, useRef, useState } from 'react'
import { THEMES } from '@/domain/themes'
import { applyTheme, useActiveTheme } from '@/hooks/useActiveTheme'
import { playTactileSound } from '@/domain/audioFeedback'
import { Star } from './Star'

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
        className="v-btn-ghost flex items-center gap-1.5 px-3 py-1.5"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`تغییر پوسته — فعلی: ${theme.label}`}
      >
        <span className="text-base leading-none" aria-hidden="true">{theme.icon}</span>
        {!compact && (
          <span className="font-extrabold text-xs sm:text-sm">
            {theme.label}
          </span>
        )}
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="پوسته‌ها"
          className="v-card shadow-float absolute end-0 top-[calc(100%+0.5rem)] z-40 w-80 max-h-[85vh] overflow-y-auto p-2"
        >
          <div className="px-3 py-2 border-b border-border/60 mb-1 flex items-center justify-between">
            <span className="text-xs font-black text-ink">پوسته‌های تعاملی ({THEMES.length} سلیقه)</span>
            <span className="text-[10px] font-bold text-ink-soft">سلیقهٔ شما، رنگ شما</span>
          </div>

          <div className="space-y-1">
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
                  className={`flex w-full items-center gap-2.5 rounded-2xl p-2.5 text-start transition-all cursor-pointer ${
                    isActive ? 'bg-brand text-on-brand shadow-sm' : 'hover:bg-brand/10 text-ink'
                  }`}
                >
                  <span className="text-xl shrink-0 leading-none">{t.icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-black text-xs sm:text-sm truncate">{t.label}</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold shrink-0 ${
                          isActive ? 'bg-on-brand/20 text-on-brand' : 'bg-brand/10 text-brand'
                        }`}
                      >
                        {t.taste}
                      </span>
                    </div>

                    {/* Palette swatches preview */}
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <div className="flex items-center gap-1">
                        <span
                          className="w-3.5 h-3.5 rounded-full border border-black/10 shadow-xs inline-block"
                          style={{ backgroundColor: t.palette.paper }}
                          title="کاغذ"
                        />
                        <span
                          className="w-3.5 h-3.5 rounded-full border border-black/10 shadow-xs inline-block"
                          style={{ backgroundColor: t.palette.brand }}
                          title="نشان"
                        />
                        <span
                          className="w-3.5 h-3.5 rounded-full border border-black/10 shadow-xs inline-block"
                          style={{ backgroundColor: t.palette.ink }}
                          title="جوهر"
                        />
                        <span
                          className="w-3.5 h-3.5 rounded-full border border-black/10 shadow-xs inline-block"
                          style={{ backgroundColor: t.palette.accent }}
                          title="چاشنی"
                        />
                      </div>
                      <span className={`text-[11px] truncate ${isActive ? 'text-on-brand/80' : 'text-ink-soft'}`}>
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
