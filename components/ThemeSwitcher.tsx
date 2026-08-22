'use client'

import { useEffect, useRef, useState } from 'react'
import { THEMES } from '@/domain/themes'
import { applyTheme, useActiveTheme } from '@/hooks/useActiveTheme'
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
        onClick={() => setOpen((v) => !v)}
        className="v-btn-ghost"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`تغییر پوسته — فعلی: ${theme.label}`}
      >
        <Star size={14} className="text-brand" />
        {!compact && <span>{theme.label}</span>}
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="پوسته‌ها"
          className="v-card shadow-float absolute end-0 top-[calc(100%+0.5rem)] z-30 w-72 overflow-hidden p-1.5"
        >
          {THEMES.map((t) => {
            const isActive = t.id === active
            return (
              <button
                key={t.id}
                role="option"
                aria-selected={isActive}
                onClick={() => {
                  applyTheme(t.id)
                  setOpen(false)
                }}
                className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-start transition-colors ${
                  isActive ? 'bg-brand text-on-brand' : 'hover:bg-brand/8'
                }`}
              >
                <Star size={16} className={isActive ? 'text-on-brand' : 'text-brand'} />
                <span className="min-w-0">
                  <span className="block font-extrabold">{t.label}</span>
                  <span className={`block text-xs ${isActive ? 'text-on-brand/80' : 'text-ink-soft'}`}>
                    {t.blurb}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
