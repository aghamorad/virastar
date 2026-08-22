// The writing modes. Two groups: the practical tools and «بازی با زبان».
// Each mode carries what the offline (deterministic) engine does and the
// instruction the online (LLM) engine follows.

export type ModeGroup = 'practical' | 'playful'

export type Register =
  | 'standard'
  | 'formal'
  | 'academic'
  | 'admin'
  | 'casual'
  | 'literary'
  | 'street'
  | 'genz'
  | 'taarof'
  | 'flattery'
  | 'poetic'

export interface WritingMode {
  id: string
  label: string
  /** Short phrase under the label — the editor's promise. */
  tagline: string
  /** Longer description shown on the سبک‌ها screen. */
  description: string
  group: ModeGroup
  register: Register
  /** Sentence connectors woven in by the offline engine. */
  connectors?: string[]
  /** Polite/literary wrappers applied by the offline engine. */
  opener?: string
  closer?: string
  /** The instruction handed to an online editing model. */
  instruction: string
}

export const MODES: WritingMode[] = [
  {
    id: 'tashih',
    label: 'اصلاح',
    tagline: 'غلط‌گیری نوشته',
    description:
      'غلط‌های املایی و دستوری، نشانه‌گذاری و نیم‌فاصله‌ها را درست می‌کند و متن را روان می‌کند؛ بدون آنکه لحن نویسنده تغییر کند.',
    group: 'practical',
    register: 'standard',
    instruction:
      'متن فارسی را فقط اصلاح کن: غلط‌های املایی و دستوری، نشانه‌گذاری و نیم‌فاصله‌ها را درست کن و جمله‌ها را روان کن. معنا و لحن نویسنده را حفظ کن. فقط متن اصلاح‌شده را برگردان.',
  },
  {
    id: 'rasmi',
    label: 'رسمی',
    tagline: 'نوشتهٔ حرفه‌ای',
    description:
      'برای ایمیل، نامه و ارتباط کاری. زبان را منظم، مودبانه و در عین حال ساده می‌کند؛ بی‌تکلف‌گرایی بی‌معنی.',
    group: 'practical',
    register: 'formal',
    connectors: ['هم‌چنین', 'از این‌رو', 'بدین ترتیب'],
    instruction:
      'متن فارسی را به زبان رسمی و حرفه‌ای بازنویسی کن؛ مناسب ایمیل و ارتباط کاری. واضح، مودبانه و بی‌تکلف. معنا را حفظ کن و فقط متن بازنویسی‌شده را برگردان.',
  },
  {
    id: 'daneshgahi',
    label: 'دانشگاهی',
    tagline: 'نوشتهٔ علمی',
    description:
      'برای دانشجو و پژوهشگر. وضوح، دقت و ساختار را بالا می‌برد؛ بدون تورم بی‌معنای ادبیات علمی.',
    group: 'practical',
    register: 'academic',
    connectors: ['بنابراین', 'از این‌رو', 'هم‌چنین', 'به‌طور کلی'],
    instruction:
      'متن فارسی را به زبان دانشگاهی و علمی بازنویسی کن؛ واضح، دقیق و منظم. از تورم ادبیات علمی بی‌معنی پرهیز کن. معنا را حفظ کن و فقط متن بازنویسی‌شده را برگردان.',
  },
  {
    id: 'edari',
    label: 'اداری',
    tagline: 'مکاتبهٔ رسمی',
    description:
      'برای درخواست، نامه و مکاتبهٔ اداری. زبان متعارف و محترمانهٔ دستگاه اداری، بدون کاغذی شدن مصنوعی.',
    group: 'practical',
    register: 'admin',
    connectors: ['مقتضی است', 'به استحضار می‌رساند', 'خواهشمند است'],
    instruction:
      'متن فارسی را به زبان اداری رسمی بازنویسی کن؛ مناسب درخواست و نامهٔ اداری. محترمانه و متعارف، بدون مصنوعی‌شدن. معنا را حفظ کن و فقط متن بازنویسی‌شده را برگردان.',
  },
  {
    id: 'khodmani',
    label: 'خودمانی',
    tagline: 'نوشتهٔ روزمره',
    description:
      'برای پیام و گفت‌وگو. زبان را طبیعی و بی‌تکلف می‌کند؛ گرم و روان، بدون بدل‌شدن به اصطلاح کوچه.',
    group: 'practical',
    register: 'casual',
    connectors: ['واقعاً', 'راستش'],
    instruction:
      'متن فارسی را به زبان خودمانی و روزمره بازنویسی کن؛ طبیعی، گرم و روان، مناسب پیام و گفت‌وگو. بدون افراط در اصطلاح کوچه. معنا را حفظ کن و فقط متن بازنویسی‌شده را برگردان.',
  },
  {
    id: 'adabi',
    label: 'ادبی',
    tagline: 'نثرِ خوش‌ساخت',
    description:
      'زیباییِ کلام و اوج و فرود جمله، الهام‌گرفته از سنت نثر فارسی. نه شعرِ تقلبی، نثری ظریف و سنجیده.',
    group: 'practical',
    register: 'literary',
    connectors: ['امّا', 'لیکن', 'بدین‌سان'],
    instruction:
      'متن فارسی را به نثر ادبی و زیبا بازنویسی کن؛ ظریف و سنجیده، الهام‌گرفته از سنت نثر فارسی. نه شعر تقلبی، نه اغراق. معنا را حفظ کن و فقط متن بازنویسی‌شده را برگردان.',
  },
  {
    id: 'lati',
    label: 'لاتی',
    tagline: 'زبانِ کوچهٔ باهوش',
    description:
      'زبان صمیمی و بی‌پردهٔ محله، با رفاقت و مرام. نه اسلنگِ کارتونی — زبان کوچهٔ واقعی، تیز و روراست.',
    group: 'playful',
    register: 'street',
    connectors: ['خب', 'بابا'],
    instruction:
      'متن فارسی را به زبان لاتی و کوچه‌ای واقعی بازنویسی کن؛ صمیمی، روراست و با مرام. اصطلاح کارتونی نساز؛ زبان کوچهٔ واقعی را بفهم. معنا را حفظ کن و فقط متن بازنویسی‌شده را برگردان.',
  },
  {
    id: 'taaroofi',
    label: 'تعارفی',
    tagline: 'ادب و احترام ایرانی',
    description:
      'لحن را محترمانه‌تر، نرم‌تر و غیرمستقیم می‌کند؛ با آن تعارفِ ایرانی که ادب، خودش پیام است.',
    group: 'playful',
    register: 'taarof',
    opener: 'خواهش می‌کنم',
    closer: 'باز هم ممنون می‌شوم',
    instruction:
      'متن فارسی را تعارفی‌تر بازنویسی کن؛ محترمانه، نرم و غیرمستقیم، با تعارف ایرانی. اغراق نکن. معنا را حفظ کن و فقط متن بازنویسی‌شده را برگردان.',
  },
  {
    id: 'pachelhkhor',
    label: 'پاچه‌خواری',
    tagline: 'تعریفِ اغراق‌آمیزِ بامزه',
    description:
      'تعریف و تمجیدِ اغراق‌آمیز و بامزه؛ برای آن‌جایی که می‌خواهی با لبخند، دل کسی را ببری.',
    group: 'playful',
    register: 'flattery',
    opener: 'به قول معروف، کار از محکم‌کاری عیب نمی‌کند',
    closer: 'واقعاً که دست‌مریزاد؛ فقط شما از پسش برمی‌آیید',
    instruction:
      'متن فارسی را با تعریف و تمجید اغراق‌آمیز و بامزه بازنویسی کن؛ طنز، گرما و کمی بذله‌گویی. منظور را حفظ کن. فقط متن بازنویسی‌شده را برگردان.',
  },
  {
    id: 'naslezed',
    label: 'نسل زد',
    tagline: 'زبانِ اینترنتیِ امروز',
    description:
      'زبان امروزیِ اینترنت؛ با آن ترکیب فارسی‌انگلیسی، طنز و اصطلاح‌های تازه. نه زبانِ جعلیِ نوجوان‌نمایی.',
    group: 'playful',
    register: 'genz',
    connectors: ['واقعاً', 'بازم', 'فرموده'],
    instruction:
      'متن فارسی را به زبان امروزی نسل زد بازنویسی کن؛ فارسی‌انگلیسیِ سبک، طنز و اصطلاح‌های به‌روز. زبان جعلی و نوجوان‌نمایی نساز. معنا را حفظ کن و فقط متن بازنویسی‌شده را برگردان.',
  },
  {
    id: 'shaeraneh',
    label: 'شاعرانه',
    tagline: 'با ریتم و تصویر',
    description:
      'موج‌هایی از فردوسی، سعدی و حافظ؛ تصویر و ریتم، بدون کپی‌کردن شعر. نثر که در خودش آهنگ دارد.',
    group: 'playful',
    register: 'poetic',
    connectors: ['گویی', 'هم‌چون', 'چون'],
    instruction:
      'متن فارسی را شاعرانه بازنویسی کن؛ با تصویر، ریتم و ظرافت الهام‌گرفته از فردوسی، سعدی و حافظ. شعر را کپی نکن؛ نثرِ آهنگین بنویس. معنا را حفظ کن و فقط متن بازنویسی‌شده را برگردان.',
  },
]

export const PRACTICAL_MODES = MODES.filter((m) => m.group === 'practical')
export const PLAYFUL_MODES = MODES.filter((m) => m.group === 'playful')

export function getMode(id: string): WritingMode {
  return MODES.find((m) => m.id === id) ?? MODES[0]
}
