import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import 'vazirmatn/Vazirmatn-font-face.css'
import './globals.css'
import { ScreenShell } from '@/components/ScreenShell'
import { THEME_STORAGE_KEY } from '@/domain/themes'

const base = process.env.NEXT_PUBLIC_BASE_PATH ?? ''

export const metadata: Metadata = {
  title: {
    default: 'ویراستار — بهتر بنویس، بهتر بگو',
    template: '%s · ویراستار',
  },
  description:
    'ابزار زیبای نوشتن فارسی. بنویس، سبک را انتخاب کن و ویرایش بگیر؛ مثل یک ویراستار حرفه‌ای.',
  applicationName: 'ویراستار',
  manifest: `${base}/manifest.webmanifest`,
  icons: {
    icon: `${base}/icon.svg`,
  },
  appleWebApp: {
    capable: true,
    title: 'ویراستار',
    statusBarStyle: 'default',
  },
}

export const viewport: Viewport = {
  themeColor: '#f6efe1',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning data-scroll-behavior="smooth">
      <body className="min-h-dvh bg-paper font-sans text-ink antialiased">
        <script
          // Apply the saved theme before first paint so the page never flashes
          // in the wrong mood.
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('${THEME_STORAGE_KEY}')||'virastar';document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','virastar');}})();`,
          }}
        />
        <ScreenShell>{children}</ScreenShell>
      </body>
    </html>
  )
}
