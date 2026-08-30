'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Star } from './Star'
import { ThemeSwitcher } from './ThemeSwitcher'
import { EditGlyph, HistoryGlyph, SettingsGlyph, StylesGlyph } from './Glyphs'

const NAV = [
  { href: '/edit', label: 'ویرایش', icon: EditGlyph },
  { href: '/styles', label: 'سبک‌ها', icon: StylesGlyph },
  { href: '/history', label: 'نوشته‌ها', icon: HistoryGlyph },
  { href: '/settings', label: 'تنظیمات', icon: SettingsGlyph },
]

export function ScreenShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="v-header sticky top-0 z-40">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4">
          <Link href="/" className="group flex items-center gap-2" aria-label="ویراستار — خانه">
            <Star size={22} className="text-brand transition-transform duration-500 group-hover:rotate-45" />
            <span className="text-lg font-black tracking-tight">ویراستار</span>
          </Link>

          <div className="flex items-center gap-2">
            <nav className="hidden items-center gap-1 md:flex" aria-label="اصلی">
              {NAV.map((item) => {
                const active =
                  item.href === '/edit'
                    ? pathname.startsWith('/edit')
                    : pathname.startsWith(item.href)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={`rounded-full px-4 py-1.5 text-sm font-bold transition-colors ${
                      active ? 'bg-brand text-on-brand' : 'v-link'
                    }`}
                  >
                    {item.label}
                  </Link>
                )
              })}
            </nav>
            <ThemeSwitcher compact />
          </div>
        </div>
      </header>

      <main className="v-main mx-auto w-full max-w-5xl flex-1 px-4 pt-6">{children}</main>

      <nav className="v-bottomnav fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 md:hidden" aria-label="اصلی">
        {NAV.map((item) => {
          const active = item.href === '/edit' ? pathname.startsWith('/edit') : pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={active ? 'text-brand' : ''}
            >
              <item.icon size={20} />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
