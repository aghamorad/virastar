// The 8 distinct interactive themes of Virastar.
// Each theme caters to a distinct taste, aesthetic, mood, and interactive feel.

export interface ThemePalette {
  paper: string
  surface: string
  brand: string
  ink: string
  accent: string
}

export interface AppTheme {
  id: string
  label: string
  /** The specific taste / aesthetic persona this theme caters to */
  taste: string
  /** One line of poetry / characterization about the mood */
  blurb: string
  /** Visual icon / symbol representing this theme */
  icon: string
  /** Exact hex color palette for live preview swatches */
  palette: ThemePalette
  /** What makes this theme physically and visually interactive */
  interactiveFeature: string
  /** The acoustic profile used when interactive typing sounds are enabled */
  soundProfile: 'pen' | 'starlight' | 'crystal' | 'velvet' | 'gilded' | 'cyber' | 'minimal' | 'typewriter'
  /** Whether this is a dark mood (color-scheme: dark) */
  isDark?: boolean
}

export const THEMES: AppTheme[] = [
  {
    id: 'virastar',
    label: 'ویراستار اصیل',
    taste: 'کلاسیک و تحریری',
    blurb: 'سفرهٔ کاغذی باوقار، مهر لاکی سرخ و آرامش نگارش روزانه.',
    icon: '✒️',
    palette: {
      paper: '#fbf8f1',
      surface: '#ffffff',
      brand: '#c2362b',
      ink: '#231f1a',
      accent: '#d97706',
    },
    interactiveFeature: 'فشار مهر لاکی لعلگون با حس ضربهٔ مهروار و بافت ریز کاغذ تحریری',
    soundProfile: 'pen',
  },
  {
    id: 'shabnevis',
    label: 'شب لاجوردی',
    taste: 'تاریک OLED و کهکشانی',
    blurb: 'لاجورد کهکشان و زر ناب؛ سکوت خلوت شبانه با ستاره‌های چشمک‌زن.',
    icon: '🌌',
    palette: {
      paper: '#0b0e17',
      surface: '#121726',
      brand: '#e6b94d',
      ink: '#f0f2f8',
      accent: '#60a5fa',
    },
    interactiveFeature: 'ستاره‌های چشمک‌زن آسمان کویر و هالهٔ درخشان طلایی دور دکمه‌ها',
    soundProfile: 'starlight',
    isDark: true,
  },
  {
    id: 'firouzeh',
    label: 'فیروزه نیشابور',
    taste: 'معماری و کاشی‌کاری',
    blurb: 'نغمهٔ کاشی‌کاری معرق اصفهان و فیروزهٔ تراش‌خورده در سپیدهٔ خنک.',
    icon: '🏛️',
    palette: {
      paper: '#eef7f6',
      surface: '#ffffff',
      brand: '#008e82',
      ink: '#0f2625',
      accent: '#c27803',
    },
    interactiveFeature: 'موج آبگونه و بازتاب صیقلی سرامیک با گره‌چینی هندسی پس‌زمینه',
    soundProfile: 'crystal',
  },
  {
    id: 'golestan',
    label: 'گلستان و زعفران',
    taste: 'شاعرانه و رمانتیک',
    blurb: 'عطر گل سرخ شیراز و زعفران قائنات؛ دفتری مخملین برای شعر و داستان.',
    icon: '🌹',
    palette: {
      paper: '#fdf2f4',
      surface: '#ffffff',
      brand: '#a21caf',
      ink: '#2c121f',
      accent: '#d97706',
    },
    interactiveFeature: 'شکوفایی نرم گلبرگ‌ها هنگام لمس و تپش مخملی یاقوت انار',
    soundProfile: 'velvet',
  },
  {
    id: 'termeh',
    label: 'ترمه یزد',
    taste: 'میراث صفوی و زربفت',
    blurb: 'زربفت شاهانهٔ یزد، زرشکی درباری و طلاکاری اسناد کهن.',
    icon: '👑',
    palette: {
      paper: '#faf3e8',
      surface: '#fffcf7',
      brand: '#941b2c',
      ink: '#2d1519',
      accent: '#b8860b',
    },
    interactiveFeature: 'درخشش نوار طلایی متحرک در سربرگ و بافت اصیل بته‌جقه',
    soundProfile: 'gilded',
  },
  {
    id: 'cyber-tehran',
    label: 'سایبر طهران',
    taste: 'سایبرپانک و دیجیتال',
    blurb: 'طهرانِ بارانی آینده؛ نئون زمردی در سیاهی شب و خط فرمان پرشتاب.',
    icon: '⚡',
    palette: {
      paper: '#0a0b10',
      surface: '#121520',
      brand: '#10b981',
      ink: '#f1f5f9',
      accent: '#a855f7',
    },
    interactiveFeature: 'ردیابی پرتوهای نئونی، خط اسکن شبانه و کلیک فوق‌سریع هکری',
    soundProfile: 'cyber',
    isDark: true,
  },
  {
    id: 'minimal-barfi',
    label: 'مینیمال برفی',
    taste: 'مدرن و تمرکز خالص',
    blurb: 'سپیدی برف البرز، خطوط شارپ شیشه‌ای و تمرکز مطلق بر واژه‌ها.',
    icon: '❄️',
    palette: {
      paper: '#f8fafc',
      surface: '#ffffff',
      brand: '#2563eb',
      ink: '#0f172a',
      accent: '#0284c7',
    },
    interactiveFeature: 'حرکت فنری نرم با مقیاس لمسی، شیشهٔ مات بدون هیچ نویز بصری',
    soundProfile: 'minimal',
  },
  {
    id: 'cafe-naderi',
    label: 'کافه نادری',
    taste: 'نوستالژیک و کاهی',
    blurb: 'نادری سال ۱۳۳۵؛ کلیدهای فلزی ماشین‌تحریر، قهوهٔ اسپرسو و کاغذ کاهی.',
    icon: '☕',
    palette: {
      paper: '#ede3cf',
      surface: '#f8f2e4',
      brand: '#a63a1e',
      ink: '#291c12',
      accent: '#446353',
    },
    interactiveFeature: 'کوبش فنری کلیدهای ماشین‌تحریر، خطوط دفتری و نفس ملایم چراغ کافه',
    soundProfile: 'typewriter',
  },
]

export const THEME_STORAGE_KEY = 'virastar-theme'
export const AUDIO_FEEDBACK_KEY = 'virastar-audio-feedback'
