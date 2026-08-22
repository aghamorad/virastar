import type { MetadataRoute } from 'next'

export const dynamic = 'force-static'

const base = process.env.NEXT_PUBLIC_BASE_PATH ?? ''

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'ویراستار — بهتر بنویس، بهتر بگو',
    short_name: 'ویراستار',
    description: 'ابزار زیبای نوشتن فارسی؛ بنویس، سبک را انتخاب کن و ویرایش بگیر.',
    start_url: `${base}/`,
    display: 'standalone',
    background_color: '#f6efe1',
    theme_color: '#f6efe1',
    dir: 'rtl',
    lang: 'fa',
    icons: [
      { src: `${base}/icon.svg`, sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: `${base}/icon-maskable.svg`, sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
    ],
  }
}
