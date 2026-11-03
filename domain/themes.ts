// Sketch design system themes (designprompts.dev/sketch)
// Warm paper, graphite ink, pencil lines, red actions, blue notes, yellow highlights, taped scraps

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
    label: 'دفترچهٔ طراحی و یادداشت',
    taste: 'کاغذ کرم گرم، مداد گرافیتی و چسب کاغذی',
    blurb: 'برگهٔ کار دست‌نویس با خطوط ملایم مداد، حاشیه‌نویسی آبی، اصلاحات سرخ و هایلایت زرد ملایم.',
    icon: '✏️',
    palette: {
      paper: '#f7f2e7',
      surface: '#fcf8ef',
      brand: '#9e3a2e',
      ink: '#38352f',
      accent: '#344c69',
    },
    interactiveFeature: 'حس نرم کشیده شدن مداد بر کاغذ گرم، سایه‌های ملایم و چرخش‌های ارگانیک',
    soundProfile: 'pen',
  },
  {
    id: 'shabnevis',
    label: 'دفترچهٔ لاجوردی (بلوپرینت)',
    taste: 'تخته‌رسم تیره و گچ سفید و فیروزه‌ای',
    blurb: 'طرح شبانهٔ معماری بر کاغذ آبی سنگی با خطوط گچی و خط‌کش دست‌ساز.',
    icon: '📐',
    palette: {
      paper: '#1e2430',
      surface: '#252c3b',
      brand: '#e06c53',
      ink: '#f4f0e6',
      accent: '#82aaff',
    },
    interactiveFeature: 'کنتراست آرام شبانه، خطوط مدادی روشن و بافت نرم تخته‌رسم',
    soundProfile: 'starlight',
    isDark: true,
  },
  {
    id: 'firouzeh',
    label: 'فیروزه و آبرنگ',
    taste: 'کاغذ نمک‌آب و جوهر فیروزه‌ای نیشابور',
    blurb: 'طرح دستی لطیف با جوهر فیروزه‌ای، خطوط مدادی نعنایی و یادداشت‌های لاجوردی.',
    icon: '🎨',
    palette: {
      paper: '#f2f8f7',
      surface: '#ffffff',
      brand: '#0d766e',
      ink: '#203331',
      accent: '#1e40af',
    },
    interactiveFeature: 'حس لطیف لمس قلم‌موی خیس و بازتاب آرام آب فیروزه',
    soundProfile: 'crystal',
  },
  {
    id: 'golestan',
    label: 'گل سرخ و یادداشت کهن',
    taste: 'کاغذ گلاب‌خورده و جوهر عنابی',
    blurb: 'دفتر خاطرات دست‌ساز با خطوط قهوه‌ای سوخته، یادداشت‌های هلویی و نشان‌های گلی.',
    icon: '🌸',
    palette: {
      paper: '#faf4ee',
      surface: '#fffaf5',
      brand: '#b84a5d',
      ink: '#3d2b27',
      accent: '#4a3853',
    },
    interactiveFeature: 'بافت مخملین کاغذ دست‌ساز و لمس پنبه‌ای کلیدها',
    soundProfile: 'velvet',
  },
  {
    id: 'termeh',
    label: 'زعفران و قلم‌نی',
    taste: 'کاغذ دست‌ساز کتان و جوهر قهوه و زعفران',
    blurb: 'طراحی روی کاغذ پوست آهو با خطوط کتانی، مرکب قهوه‌ای و هایلایت نرم زعفرانی.',
    icon: '📜',
    palette: {
      paper: '#f9f5eb',
      surface: '#fefdfa',
      brand: '#b45309',
      ink: '#382e1e',
      accent: '#2d4a43',
    },
    interactiveFeature: 'صدای ساییده شدن آرام قلم‌نی دزفولی بر کاغذ آهارمهره',
    soundProfile: 'gilded',
  },
  {
    id: 'cyber-tehran',
    label: 'گرافیت و نئون شبانه',
    taste: 'کاغذ سیاه کاربن و مداد درخشان زمردی',
    blurb: 'اسکچ شبانه روی کاغذ دوده با خطوط نرم کربنی و نشانه‌گذاری مداد زمردی.',
    icon: '💡',
    palette: {
      paper: '#1c1e22',
      surface: '#242830',
      brand: '#34d399',
      ink: '#e8ecef',
      accent: '#60a5fa',
    },
    interactiveFeature: 'خطوط دقیق با نرمی نوک اتود و درخشش ملایم شبانه',
    soundProfile: 'cyber',
    isDark: true,
  },
  {
    id: 'minimal-barfi',
    label: 'اسکچ مینیمال بریستول',
    taste: 'کاغذ سفید اشتنباخ و مداد B2',
    blurb: 'طرح ساده و پاکیزه روی کاغذ ضخیم طراحی با مداد نرم، تمرکز کامل بدون حواس‌پرتی.',
    icon: '🕊️',
    palette: {
      paper: '#fafafa',
      surface: '#ffffff',
      brand: '#9e3a2e',
      ink: '#2b2927',
      accent: '#344c69',
    },
    interactiveFeature: 'سادگی و آرامش خطوط مداد گرافیت بر صفحه سفید طراحی',
    soundProfile: 'minimal',
  },
  {
    id: 'cafe-naderi',
    label: 'کاغذ کاهی و میز کافه',
    taste: 'دفترچه کاهی قهوه‌خانه‌ای و لکه قهوه',
    blurb: 'برگه‌های کاهی کلاسیک با خطوط خاکی، جوهر قهوهٔ دم‌کشیده و حس نوستالژیک یادداشت‌برداری.',
    icon: '☕',
    palette: {
      paper: '#eedfc5',
      surface: '#f7edd9',
      brand: '#8c3325',
      ink: '#352518',
      accent: '#2e3d36',
    },
    interactiveFeature: 'حس نوستالژیک و گرم یادداشت‌برداری روی دستمال کاغذی و برگهٔ کاهی کافه',
    soundProfile: 'typewriter',
  },
]

export const THEME_STORAGE_KEY = 'virastar-theme'
export const AUDIO_FEEDBACK_KEY = 'virastar-audio-feedback'
