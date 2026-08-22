// The four moods. Themes are not palette swaps — each one re-dresses the whole
// instrument (tokens in globals.css, textures, selection, controls).

export interface AppTheme {
  id: string
  label: string
  /** One line of poetry about the mood, shown next to the picker. */
  blurb: string
}

export const THEMES: AppTheme[] = [
  {
    id: 'virastar',
    label: 'ویراستار',
    blurb: 'سفرهٔ کاغذی روشن، ستاره‌ای درخشان؛ پیش‌فرضِ همه.',
  },
  {
    id: 'shabnevis',
    label: 'شب‌نویس',
    blurb: 'سکوت و ستاره‌های شب؛ نویسنده، تنها با کاغذ و نور.',
  },
  {
    id: 'cafe-tehran',
    label: 'کافه تهران',
    blurb: 'دههٔ چهل‌وپنجاه؛ کتاب، مجله، قهوه و گفت‌وگو.',
  },
  {
    id: 'johar-benafsh',
    label: 'جوهر بنفش',
    blurb: 'مرکب و خیال؛ دفتری برای نوشتنِ خلاق.',
  },
]

export const THEME_STORAGE_KEY = 'virastar-theme'
