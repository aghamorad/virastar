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
    <div className="flex min-h-dvh flex-col pb-24 md:pb-8 bg-paper">
      {/* Neo-Brutalist Masthead */}
      <header className="v-header border-b-4 border-black bg-paper">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex items-center gap-2.5 bg-black text-white px-3 py-1.5 border-3 border-black shadow-[3px_3px_0px_#000] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[5px_5px_0px_#000] transition-all cursor-pointer"
              aria-label="ویراستار — خانه"
            >
              <span className="text-yellow-400 font-black">
                <Star size={20} />
              </span>
              <span className="text-xl font-black tracking-tight leading-none uppercase">
                ویراستار
              </span>
            </Link>

            {/* Engine status indicator tile */}
            <Link
              href="/settings"
              className="v-gem-status hover:bg-yellow-300 transition-colors hidden sm:inline-flex"
              title="تغییر موتور هوش مصنوعی در تنظیمات"
            >
              <span>{option.kind === 'local' || option.kind === 'rules' ? '💎' : option.id === 'custom-worker' ? '⚡' : '✨'}</span>
              <span className="text-black font-black text-xs truncate max-w-[140px]">
                {option.label}
              </span>
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <nav className="hidden items-center gap-2 md:flex" aria-label="اصلی">
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
                    className={`border-3 border-black px-4 py-1.5 text-sm font-black transition-all cursor-pointer ${
                      active
                        ? 'bg-[#ffed00] text-black shadow-[4px_4px_0px_#000] translate-x-[-2px] translate-y-[-2px]'
                        : 'bg-white text-black shadow-[2px_2px_0px_#000] hover:bg-[#ffed00] hover:shadow-[4px_4px_0px_#000]'
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

      {/* Neo-Brutalist Grouped Footer */}
      <footer className="hidden md:flex mx-auto w-full max-w-6xl items-center justify-between px-6 py-6 border-t-4 border-black bg-white mt-16 shadow-[6px_6px_0px_#000]">
        <div className="flex items-center gap-3">
          <span className="bg-[#ff4332] text-white px-2.5 py-1 text-xs font-black border-2 border-black shadow-[2px_2px_0px_#000]">
            MADE BY MORAD
          </span>
          <span className="text-xs font-black text-black">
            ویراستار · ابزار هوشمند پیرایش و ویرایش زبان فارسی
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs font-black text-black">
          <span className="bg-[#d4bdff] px-2 py-0.5 border border-black shadow-[1px_1px_0px_#000]">۱۰۰٪ خصوصی</span>
          <span className="bg-[#ffed00] px-2 py-0.5 border border-black shadow-[1px_1px_0px_#000]">بدون نیاز به ثبت‌نام</span>
        </div>
      </footer>

      {/* Mobile Bottom Dock */}
      <nav
        className="v-bottomnav fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t-4 border-black bg-[#fff5d6] p-1.5 md:hidden shadow-[0_-4px_0px_#000]"
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
              className={`flex flex-col items-center justify-center py-2 px-1 border-2 transition-all ${
                active
                  ? 'bg-[#ffed00] text-black border-black shadow-[3px_3px_0px_#000] font-black'
                  : 'bg-white text-black border-black/30 font-bold'
              }`}
            >
              <item.icon size={18} className="text-black" />
              <span className="text-[11px] mt-0.5 leading-none font-black">{item.label}</span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
