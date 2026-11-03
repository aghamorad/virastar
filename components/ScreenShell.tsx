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
  { href: '/styles', label: 'قلم‌دان سبک‌ها', icon: StylesGlyph },
  { href: '/history', label: 'دفتر نگارش', icon: HistoryGlyph },
  { href: '/settings', label: 'تنظیمات و مدل‌ها', icon: SettingsGlyph },
]

export function ScreenShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const [settings] = useSettings()
  const currentChoice = modelChoiceFromSettings(settings)
  const option = MODEL_OPTIONS.find((o) => o.id === currentChoice) ?? MODEL_OPTIONS[0]

  return (
    <div className="flex min-h-dvh flex-col pb-20 md:pb-6">
      {/* Artisanal Persian Masthead */}
      <header className="v-header sticky top-0 z-40 border-b border-border/70 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Link href="/" className="group flex items-center gap-2.5" aria-label="ویراستار — خانه">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand/10 border border-brand/20 shadow-xs transition-transform duration-500 group-hover:rotate-45">
                <Star size={20} className="text-brand" />
              </span>
              <div>
                <span className="block text-xl font-black tracking-tight leading-none text-ink">
                  ویراستار
                </span>
                <span className="text-[10px] font-bold text-ink-soft hidden sm:block">
                  دستیار هوشمند و پیرایشگر زبان فارسی
                </span>
              </div>
            </Link>

            {/* Gemstone engine status chip */}
            <Link
              href="/settings"
              className="v-gem-status hover:border-brand/40 transition-colors hidden sm:inline-flex"
              title="مشاهده و تغییر مدل هوش مصنوعی در تنظیمات"
            >
              <span className="text-xs">
                {option.kind === 'local' || option.kind === 'rules' ? '💎' : option.id === 'custom-worker' ? '⚡' : '✨'}
              </span>
              <span className="text-ink/80 text-[11px] truncate max-w-[130px]">
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
                    className={`relative rounded-full px-4 py-2 text-xs lg:text-sm font-extrabold transition-all ${
                      active
                        ? 'bg-brand text-on-brand shadow-xs'
                        : 'text-ink-soft hover:text-ink hover:bg-brand/5'
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

      <footer className="hidden md:flex mx-auto w-full max-w-6xl items-center justify-between px-6 py-8 text-xs font-bold text-ink-soft/75 border-t border-border/50 mt-16">
        <span className="flex items-center gap-2">
          <Star size={13} className="text-brand" />
          <span>طراحی و پیاده‌سازی شده با ❤️ توسط مراد (Made by Morad)</span>
        </span>
        <span className="text-ink-soft/60">
          ویراستار · بدون نیاز به ثبت‌نام · حافظ حریم شخصی ۱۰۰٪ کاربر
        </span>
      </footer>

      {/* Artisanal Mobile Bottom Navigation Dock */}
      <nav
        className="v-bottomnav fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-border/80 bg-paper/95 backdrop-blur-lg px-2 py-1.5 md:hidden shadow-lg"
        aria-label="اصلی"
      >
        {NAV.map((item) => {
          const active = item.href === '/edit' ? pathname.startsWith('/edit') : pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={false}
              aria-current={active ? 'page' : undefined}
              className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition-all ${
                active ? 'text-brand font-black bg-brand/10 shadow-xs' : 'text-ink-soft font-bold'
              }`}
            >
              <item.icon size={20} className={active ? 'text-brand' : 'text-ink-soft'} />
              <span className="text-[11px] mt-0.5 leading-none">{item.label}</span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
