// Neo-Brutalism themes system (designprompts.dev/neo-brutalism)
// Cream paper, bold yellow posters, red signals, violet bands, thick black borders, solid offset shadows

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
  taste: string
  blurb: string
  icon: string
  palette: ThemePalette
  interactiveFeature: string
  soundProfile: 'pen' | 'starlight' | 'crystal' | 'velvet' | 'gilded' | 'cyber' | 'minimal' | 'typewriter'
  isDark?: boolean
}

export const THEMES: AppTheme[] = [
  {
    id: 'virastar',
    label: 'نئوبروتال اصیل',
    taste: 'کاغذ زرد و خطوط مشکی بولد',
    blurb: 'پوستر زرد، سایه‌های تخت مشکی، نوارهای بنفش و فونت ضخیم مطبوعاتی.',
    icon: '⚡',
    palette: {
      paper: '#fff5d6',
      surface: '#ffffff',
      brand: '#ff4332',
      ink: '#000000',
      accent: '#d4bdff',
    },
    interactiveFeature: 'سایه‌های ضخیم بدون محوشدگی، جهش حسی کلیدها و زوایای تند',
    soundProfile: 'typewriter',
  },
  {
    id: 'shabnevis',
    label: 'نئوبروتال شبانه',
    taste: 'تاریک اینک و نئون زرد',
    blurb: 'تیرگی کربنی، کادرهای سپید و تأکیدهای زرد فسفری در عمق شب.',
    icon: '🌌',
    palette: {
      paper: '#0d0e15',
      surface: '#181926',
      brand: '#ffed00',
      ink: '#ffffff',
      accent: '#c084fc',
    },
    interactiveFeature: 'سایه‌های تخت سپید، تضاد شدید در تاریکی و درخشش زرد',
    soundProfile: 'starlight',
    isDark: true,
  },
  {
    id: 'firouzeh',
    label: 'نئوبروتال فیروزه',
    taste: 'فیروزه برقی و زرد طلایی',
    blurb: 'کنتراست بالای فیروزه‌ای متالیک، نوارهای مشکی و قرمز جهت‌دار.',
    icon: '🏛️',
    palette: {
      paper: '#e0f7f5',
      surface: '#ffffff',
      brand: '#00a896',
      ink: '#000000',
      accent: '#ffd700',
    },
    interactiveFeature: 'خطوط ضخیم ۴ پیکسلی با بازتاب برقی فیروزه',
    soundProfile: 'crystal',
  },
  {
    id: 'golestan',
    label: 'نئوبروتال پاپ رز',
    taste: 'سرخابی برقی و لیمویی',
    blurb: 'انرژی رنگ‌های پاپ، سرخابی تند، خطوط مشکی عمیق و کادرهای برشی.',
    icon: '🌹',
    palette: {
      paper: '#ffeef4',
      surface: '#ffffff',
      brand: '#ff3385',
      ink: '#000000',
      accent: '#c084fc',
    },
    interactiveFeature: 'شکوفایی بروتالیستی، کادرهای لایه‌لایه و حاشیه‌های پرانرژی',
    soundProfile: 'velvet',
  },
  {
    id: 'termeh',
    label: 'نئوبروتال کهن',
    taste: 'زرشکی و خردلی درباری',
    blurb: 'اُخرایی گرم، زرشکی تند و کادرهای چاپ سنگی قاجاری با روح بروتال.',
    icon: '👑',
    palette: {
      paper: '#fff2db',
      surface: '#ffffff',
      brand: '#b91c1c',
      ink: '#000000',
      accent: '#fbbf24',
    },
    interactiveFeature: 'خطوط مشکی سنگین و کنتراست شاهانه بر کاغذ خردلی',
    soundProfile: 'gilded',
  },
  {
    id: 'cyber-tehran',
    label: 'نئوبروتال سایبر',
    taste: 'سبز ماتریسی و صورتی نئون',
    blurb: 'سیاهی کامل، فسفر سبز زنده و خطوط اسکن با سایه‌های تیز سبز.',
    icon: '📟',
    palette: {
      paper: '#07090e',
      surface: '#10141f',
      brand: '#00ff9d',
      ink: '#f0fdf4',
      accent: '#ff0055',
    },
    interactiveFeature: 'سایه‌های نئونی تخت ۴ پیکسلی و کلیک‌های ضربه‌ای سریع',
    soundProfile: 'cyber',
    isDark: true,
  },
  {
    id: 'minimal-barfi',
    label: 'نئوبروتال سیاه و سپید',
    taste: 'مونوکروم و آبی کبالت',
    blurb: 'سپیدی مطلق، کادرهای مشکی ۴ پیکسل، زرد تأکیدی و صفر درصد رنگ اضافه.',
    icon: '❄️',
    palette: {
      paper: '#ffffff',
      surface: '#ffffff',
      brand: '#000000',
      ink: '#000000',
      accent: '#ffed00',
    },
    interactiveFeature: 'کنتراست صددرصد، تمرکز مطلق و سایه‌های سخت و خالص',
    soundProfile: 'minimal',
  },
  {
    id: 'cafe-naderi',
    label: 'نئوبروتال کرافت',
    taste: 'کاغذ کاهی و جوهر قهوه',
    blurb: 'کاغذ کرافت کهنه، رنگ قهوهٔ برشته و کلیدهای چکش‌خوردهٔ ماشین‌تحریر.',
    icon: '☕',
    palette: {
      paper: '#eedfc5',
      surface: '#fbf5eb',
      brand: '#b45309',
      ink: '#1e130a',
      accent: '#84cc16',
    },
    interactiveFeature: 'کوبش فنری کلیدهای فلزی با فرورفتگی سخت در سایه',
    soundProfile: 'typewriter',
  },
]

export const THEME_STORAGE_KEY = 'virastar-theme'
export const AUDIO_FEEDBACK_KEY = 'virastar-audio-feedback'
