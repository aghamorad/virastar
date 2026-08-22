// Persian text core — character normalization, نیم‌فاصله (ZWNJ) repair, spacing,
// and the colloquial → standard dictionary that powers the offline editor.
// These are deterministic rules, the honest offline half of the engine. The
// online (LLM) half lives in engines/online.ts and handles true rewriting.

export const ZWNJ = '‌'

const PERSIAN_WORD = /[؀-ۿ‌]/
const PERSIAN_WORD_RE = /[؀-ۿ‌]/g

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Arabic runes that Persians type by accident on a standard Arabic layout. */
export function normalizeChars(text: string): string {
  return text
    .replace(/[أإ]/g, 'ا')
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/ة/g, 'ه')
    .replace(/[ً-ْٰ]/g, '') // tashkeel / superscript alef
    .replace(/[٠-٩]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0x0630 + 0x06f0))
}

/**
 * Repair the two most common spacing mistakes:
 *  - a full space where Persian wants a نیم‌فاصله ("می خواهم" → "می‌خواهم"),
 *  - a space before punctuation, or none after it.
 */
export function fixZWNJ(text: string): string {
  // Dictionary of the most-typed space-separated verbs + suffixes.
  const pairs: Array<[string, string]> = [
    ['می خواهم', 'میخواهم'],
    ['می خواهی', 'میخواهی'],
    ['می خواهد', 'میخواهد'],
    ['می خواهیم', 'میخواهیم'],
    ['می خواهید', 'میخواهید'],
    ['می خواهند', 'میخواهند'],
    ['می خوام', 'میخوام'],
    ['می خوای', 'میخوای'],
    ['می خواد', 'میخواد'],
    ['می روم', 'میروم'],
    ['می روی', 'میروی'],
    ['می رود', 'میرود'],
    ['می رویم', 'میرویم'],
    ['می روید', 'میروید'],
    ['می روند', 'میروند'],
    ['می شود', 'میشود'],
    ['می شوی', 'میشوی'],
    ['می شویم', 'میشویم'],
    ['می شوید', 'میشوید'],
    ['می شوند', 'میشوند'],
    ['می کنم', 'میکنم'],
    ['می کنی', 'میکنی'],
    ['می کند', 'میکند'],
    ['می کنیم', 'میکنیم'],
    ['می کنید', 'میکنید'],
    ['می کنند', 'میکنند'],
    ['می دهم', 'میدهم'],
    ['می دهی', 'میدهی'],
    ['می دهد', 'میدهد'],
    ['می دهیم', 'میدهیم'],
    ['می دهید', 'میدهید'],
    ['می دهند', 'میدهند'],
    ['می دانم', 'میدانم'],
    ['می دانی', 'میدانی'],
    ['می داند', 'میداند'],
    ['می دانیم', 'میدانیم'],
    ['می دانید', 'میدانید'],
    ['می دانند', 'میدانند'],
    ['می گویم', 'میگویم'],
    ['می گویی', 'میگویی'],
    ['می گوید', 'میگوید'],
    ['می گوییم', 'میگوییم'],
    ['می گویید', 'میگویید'],
    ['می گویند', 'میگویند'],
    ['می آید', 'میآید'],
    ['می آیی', 'میآیی'],
    ['می آیند', 'میآیند'],
    ['می توانم', 'میتوانم'],
    ['می توانی', 'میتوانی'],
    ['می تواند', 'میتواند'],
    ['می توانیم', 'میتوانیم'],
    ['می توانید', 'میتوانید'],
    ['می توانند', 'میتوانند'],
    ['می گیرم', 'میگیرم'],
    ['می گیرد', 'میگیرد'],
    ['می گیرند', 'میگیرند'],
  ]
  let out = text
  for (const [from, to] of pairs) {
    out = out.split(from).join(to)
  }
  // Generic joins that are almost always correct in Persian: plural ها/های
  // and the comparative تر/ترین suffix attach to the noun with a نیم‌فاصله.
  out = out.replace(
    /([؀-ۿ]+) (ها|های|تر|ترین)(?=[\s.،؛؟!]|$)/g,
    (_, w, sfx) => w + ZWNJ + sfx,
  )
  return out
}

export function fixSpacing(text: string): string {
  let out = text
  // No space before Persian sentence punctuation, a single space after.
  out = out.replace(/ *([،؛؟!])/g, '$1')
  out = out.replace(/ *\./g, '.')
  out = out.replace(/([،؛؟!.])(?=[؀-ۿ])/g, '$1 ')
  // Tidy runs of whitespace and stray half-spaces.
  out = out.replace(/[ \t]{2,}/g, ' ')
  out = out.trim()
  return out
}

/** Colloquial spellings → standard written Persian. Safe enough to always apply. */
export const COLLOQUIAL_TO_STANDARD: Record<string, string> = {
  'میخوام': 'میخواهم',
  'میخوای': 'میخواهی',
  'میخواد': 'میخواهد',
  'میخوایم': 'میخواهیم',
  'میخواین': 'میخواهید',
  'میخوان': 'میخواهند',
  'نمیخوام': 'نمیخواهم',
  'نمیخواد': 'نمیخواهد',
  'میرم': 'میروم',
  'میری': 'میروی',
  'میره': 'میرود',
  'میریم': 'میرویم',
  'میرین': 'میروید',
  'میرن': 'میروند',
  'میگم': 'میگویم',
  'میگی': 'میگویی',
  'میگه': 'میگوید',
  'میگیم': 'میگوییم',
  'میگین': 'میگویید',
  'میگن': 'میگویند',
  'میدونم': 'میدانم',
  'میدونی': 'میدانی',
  'میدونه': 'میداند',
  'میدونیم': 'میدانیم',
  'میدونید': 'میدانید',
  'میدونن': 'میدانند',
  'برم': 'بروم',
  'بری': 'بروی',
  'بره': 'برود',
  'بریم': 'برویم',
  'برین': 'بروید',
  'برن': 'بروند',
  'بگم': 'بگویم',
  'بگی': 'بگویی',
  'بگه': 'بگوید',
  'بگیم': 'بگوییم',
  'بگین': 'بگویید',
  'بگن': 'بگویند',
  'میشه': 'میشود',
  'میتونم': 'میتوانم',
  'میتونی': 'میتوانی',
  'میتونه': 'میتواند',
  'میتونیم': 'میتوانیم',
  'میتونید': 'میتوانید',
  'میتونن': 'میتوانند',
  'نمیتونم': 'نمیتوانم',
  'نمیتونی': 'نمیتوانی',
  'نمیتونه': 'نمیتواند',
  'داره': 'دارد',
  'دارن': 'دارند',
  'میاد': 'میآید',
  'میام': 'میآیم',
  'میای': 'میآیی',
  'میان': 'میآیند',
  'برام': 'برایم',
  'براش': 'برای او',
  'واسم': 'برایم',
  'واسه': 'برای',
  'واسه همین': 'به همین دلیل',
  'اگه': 'اگر',
  'مگه': 'مگر',
  'آخه': 'چون',
  'خب': 'خوب',
  'آره': 'بله',
  'راجع به': 'درباره',
  'راجب': 'درباره',
  'درباره به': 'درباره',
  'اون': 'آن',
  'اونها': 'آنها',
  'اینا': 'اینها',
  'اونجا': 'آنجا',
  'هیچی': 'هیچ',
  'یه': 'یک',
  'چیزیه': 'چیزی است',
  'چیزیه که': 'چیزی است که',
  'میخاستم': 'میخواستم',
  'میخاست': 'میخواست',
  'میخوره': 'میخورد',
}

/** Formal registers swap casual forms for literary/standard ones. */
export const TO_FORMAL: Record<string, string> = {
  'برای اینکه': 'زیرا',
  'برای این که': 'زیرا',
  'چون': 'زیرا',
  'ولی': 'اما',
  'ولی خب': 'اما',
  'خیلی': 'بسیار',
  'خب': 'خوب',
  'آره': 'بله',
  'لطفا': 'لطفاً',
  'میخوام': 'میخواهم',
  'میخوای': 'میخواهی',
  'میخواد': 'میخواهد',
  'میخوایم': 'میخواهیم',
  'میخواین': 'میخواهید',
  'میخوان': 'میخواهند',
  'میشه': 'میشود',
  'میتونم': 'میتوانم',
  'میتونی': 'میتوانی',
  'میتونه': 'میتواند',
  'میتونیم': 'میتوانیم',
  'میتونید': 'میتوانید',
  'میتونن': 'میتوانند',
  'نمیتونم': 'نمیتوانم',
  'اون': 'آن',
  'اونا': 'آنها',
  'توی': 'در',
  'تو این': 'در این',
  'تو اون': 'در آن',
  'راجع به': 'درباره',
  'یه': 'یک',
  'میخوره': 'میخورد',
  'میخواستم': 'میخواستم',
  'هستم': 'هستم',
}

/** Everyday mode: pull formal stiffness back toward natural speech. */
export const TO_CASUAL: Record<string, string> = {
  'بسیار': 'خیلی',
  'اما': 'ولی',
  'زیرا': 'چون',
  'برای اینکه': 'چون',
  'لذا': 'پس',
  'بنابراین': 'پس',
  'میخواهم': 'میخوام',
  'میخواهی': 'میخوای',
  'میخواهد': 'میخواد',
  'میخواهیم': 'میخوایم',
  'میخواهید': 'میخواین',
  'میخواهند': 'میخوان',
  'میشود': 'میشه',
  'میتوانم': 'میتونم',
  'میتوانی': 'میتونی',
  'میتواند': 'میتونه',
  'بله': 'آره',
  'خواهش میکنم': 'خواهش میکنم',
  'آیا ': '',
}

/** Streetwise flavor — real colloquial Tehrani, not cartoon slang. */
export const TO_STREET: Record<string, string> = {
  'چطور': 'چجوری',
  'چطوره': 'چجوریه',
  'چه طور': 'چجوری',
  'میخواهی': 'میخوای',
  'میخواهم': 'میخوام',
  'میخواهد': 'میخواد',
  'میتوانی': 'میتونی',
  'میتوانم': 'میتونم',
  'میشود': 'میشه',
  'بسیار': 'خیلی',
  'اما': 'ولی',
  'زیرا': 'چون',
  'لطفاً': 'لطفا',
  'برویم': 'بریم',
  'بروی': 'بری',
  'میبینم': 'میبینم',
}

/** نسل زد — contemporary Iranian internet Persian, irony + light mixing. */
export const TO_GENZ: Record<string, string> = {
  'میخواهم': 'میخوام',
  'میخواهی': 'میخوای',
  'میخواهد': 'میخواد',
  'میشود': 'میشه',
  'میتوانم': 'میتونم',
  'میتوانی': 'میتونی',
  'بسیار': 'واقعاً',
  'خیلی': 'خیلی',
  'بله': 'آره',
  'لطفاً': 'لطفا',
  'میگوید': 'میگه',
  'میگویند': 'میگن',
  'بنابراین': 'پس',
  'در واقع': 'واقعا',
  'خوب': 'خب',
}

/** ادبی / شاعرانه — literary and poetic registers share an elevated layer. */
export const TO_LITERARY: Record<string, string> = {
  'خیلی': 'بسیار',
  'ولی': 'امّا',
  'اما': 'امّا',
  'چون': 'زیرا',
  'توی': 'در',
  'زیبا': 'دل‌انگیز',
  'قشنگ': 'دل‌انگیز',
  'غمگین': 'دلتنگ',
  'خوشحال': 'شادمان',
  'شاد': 'شادمان',
  'میخوام': 'می‌خواهم',
  'میخوای': 'می‌خواهی',
  'میخواد': 'می‌خواهد',
  'بعد': 'پس از آن',
  'حالا': 'اکنون',
  'الان': 'اکنون',
  'کمکم': 'کم‌کم',
}

/** تعارفی — Iranian politeness: soften, honor, hesitate politely. */
export const TO_TAAROF: Record<string, string> = {
  'لطفا': 'لطفاً',
  'بگو': 'لطفاً بفرمایید',
  'بگید': 'لطفاً بفرمایید',
  'بده': 'مرحمت فرمایید',
  'بفرست': 'لطفاً بفرستید',
  'بیا': 'تشریف بیاورید',
  'برو': 'مرحمت فرمایید',
  'کمکم کن': 'ممنون می‌شوم کمکم کنید',
  'بعدا': 'بعداً',
  'خودت': 'خودتان',
}

/** پاچه‌خواری — exaggerated, warm flattery for laughs. */
export const TO_FLATTERY: Record<string, string> = {
  'شما': 'جناب‌عالی',
  'عالی': 'بی‌نظیر',
  'خوب': 'درخشان',
  'خیلی خوب': 'بی‌نظیر',
  'بهترین': 'بی‌همتاترین',
  'ممنونم': 'باز هم دست‌مریزاد',
  'متشکرم': 'سراپا مرهون لطف شمایم',
}

// Longest-first so compound entries («چیزیه که», «برای اینکه») win.
export function orderedEntries(dict: Record<string, string>): Array<[string, string]> {
  return Object.entries(dict).sort((a, b) => b[0].length - a[0].length)
}

/** Replace whole words (Persian letters + ZWNJ form a word) from a dictionary. */
export function replaceWords(text: string, dict: Record<string, string>): { text: string; count: number } {
  let out = text
  let count = 0
  for (const [from, to] of orderedEntries(dict)) {
    const re = new RegExp(
      `(?<![\\u0600-\\u06FF\\u200c])${escapeRegExp(from)}(?![\\u0600-\\u06FF\\u200c])`,
      'g',
    )
    const replaced = out.replace(re, (m) => {
      count++
      return m === from ? to : to
    })
    out = replaced
  }
  return { text: out, count }
}

export function countPersianWords(text: string): number {
  const m = text.match(/[؀-ۿ][؀-ۿ‌]*/g)
  return m ? m.length : 0
}

export function hasPersian(text: string): boolean {
  return PERSIAN_WORD.test(text)
}

export { PERSIAN_WORD_RE }
