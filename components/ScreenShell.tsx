'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Star } from './Star'
import { ThemeSwitcher } from './ThemeSwitcher'
import { UpdateNotice } from './UpdateNotice'
import { EditGlyph, HistoryGlyph, SettingsGlyph, StylesGlyph } from './Glyphs'
import { useSettings } from '@/hooks/useSettings'
import { MODEL_OPTIONS, modelChoiceFromSettings } from '@/domain/engine'

const NAV = [
  { href: '/edit', label: 'میز ویرایش', icon: EditGlyph },
  { href: '/styles', label: 'سبک‌ها', icon: StylesGlyph },
  { href: '/history', label: 'نوشته‌ها', icon: HistoryGlyph },
  { href: '/settings', label: 'تنظیمات', icon: SettingsGlyph },
]

export function ScreenShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const [settings] = useSettings()
  const currentChoice = modelChoiceFromSettings(settings)
  const option = MODEL_OPTIONS.find((o) => o.id === currentChoice) ?? MODEL_OPTIONS[0]

  return (
    <div className="flex min-h-dvh flex-col pb-24 md:pb-8 bg-paper text-ink transition-colors duration-150">
      {/* Sketch Working Sheet Masthead */}
      <header className="v-header border-b border-border bg-paper/90 backdrop-blur-sm sticky top-0 z-40">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex items-center gap-2 bg-surface text-ink px-3 py-1.5 border border-border rounded-[8px_4px_12px_5px] shadow-soft hover:bg-highlight hover:border-ink hover:rotate-[-1deg] transition-all cursor-pointer"
              aria-label="ویراستار — خانه"
            >
              <span className="text-brand">
                <Star size={18} />
              </span>
              <span className="text-xl font-black tracking-tight leading-none">
                ویراستار
              </span>
            </Link>

            {/* Engine status note */}
            <Link
              href="/settings"
              className="v-gem-status hover:border-ink hover:bg-highlight transition-all hidden sm:inline-flex"
              title="تغییر موتور هوش مصنوعی در تنظیمات"
            >
              <span className="text-accent">{option.kind === 'local' || option.kind === 'rules' ? '✎' : option.id === 'custom-worker' ? '⚡' : '✨'}</span>
              <span className="text-ink font-bold text-xs truncate max-w-[140px]">
                {option.label}
              </span>
            </Link>
          </div>

          <div className="flex items-center gap-2.5">
            <nav className="hidden items-center gap-1.5 md:flex" aria-label="اصلی">
              {NAV.map((item) => {
                const active =
                  item.href === '/edit'
                    ? pathname.startsWith('/edit')
                    : pathname.startsWith(item.href)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    prefetch={false}
                    aria-current={active ? 'page' : undefined}
                    className={`px-3.5 py-1.5 text-sm font-bold border rounded-[7px_3px_10px_4px] transition-all cursor-pointer ${
                      active
                        ? 'bg-highlight text-ink border-ink shadow-soft rotate-[-0.5deg] font-extrabold'
                        : 'bg-surface text-ink-soft border-border hover:border-ink hover:text-ink hover:bg-paper-deep'
                    }`}
                  >
                    {item.label}
                  </Link>
                )
              })}
            </nav>

            <ThemeSwitcher />
          </div>
        </div>
      </header>

      <UpdateNotice />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 sm:px-6 pt-6">{children}</main>

      {/* Sketch Footnote / Lightly Divided Footer */}
      <footer className="hidden md:flex mx-auto w-full max-w-6xl items-center justify-between px-6 py-6 border-t border-border mt-16 bg-surface/60 rounded-[12px_6px_14px_6px] shadow-soft">
        <div className="flex items-center gap-3">
          <span className="bg-brand text-white px-2.5 py-0.5 text-xs font-bold rounded-[6px_3px_8px_4px] shadow-soft">
            Made by Morad
          </span>
          <span className="text-xs text-ink-soft font-medium">
            ویراستار · برگهٔ دستیار نگارش و بازنویسی زبان فارسی
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs font-bold text-accent">
          <span className="bg-surface px-2.5 py-1 border border-border rounded-[6px_3px_8px_4px] shadow-soft">
            ✎ ۱۰۰٪ حریم خصوصی در دستگاه
          </span>
          <span className="bg-highlight/80 text-ink px-2.5 py-1 border border-border rounded-[6px_3px_8px_4px] shadow-soft">
            ✓ بدون نیاز به حساب کاربری
          </span>
        </div>
      </footer>

      {/* Mobile Bottom Dock */}
      <nav
        className="v-bottomnav fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-border bg-paper/95 backdrop-blur-md p-1.5 md:hidden shadow-soft"
        aria-label="اصلی"
      >
        {NAV.map((item) => {
          const active = item.href === '/edit' ? pathname.startsWith('/edit') : pathname.startsWith(item.href)
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={false}
              aria-current={active ? 'page' : undefined}
              className={`flex flex-col items-center justify-center gap-1 py-1.5 rounded-[8px_4px_10px_4px] text-xs font-bold transition-all ${
                active
                  ? 'bg-highlight text-ink border border-ink shadow-soft'
                  : 'text-ink-soft hover:text-ink'
              }`}
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
