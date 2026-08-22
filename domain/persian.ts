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
    .replace(/ـ/g, '') // tatweel / kashida — "fake" justification marks
    .replace(/[​‎‏]/g, '') // ZWSP / LRM / RLM, invisible but messy
}

/** Present-tense stems of the everyday verbs. ZWNJ joins are only ever applied
 *  to these exact inflections (full word, never a bare stem), so look-alike
 *  nouns like میدان or میوه are never touched. */
const MI_STEMS = [
  'خواه', 'رو', 'شو', 'کن', 'ده', 'دان', 'گوی', 'گیر', 'آ', 'آور', 'توان',
  'خور', 'بین', 'رس', 'خواب', 'نشین', 'فهم', 'زن', 'انداز', 'پرس', 'نویس',
  'خوان', 'گذار', 'شمار', 'خند', 'تاب', 'بند', 'شکن',
]
const MI_ENDINGS = ['م', 'ی', 'د', 'یم', 'ید', 'ند']
const MI_FORMS = MI_STEMS.flatMap((s) => MI_ENDINGS.map((e) => s + e)).sort(
  (a, b) => b.length - a.length,
)
const MI_RE = new RegExp(`(می|نمی)( ?)(${MI_FORMS.join('|')})(?![\\p{L}\\u200c])`, 'gu')

/**
 * Typographic cleanup a Persian editor should always do: ellipses, collapsing
 * doubled marks, converting Latin ?/;/، into their Persian forms when they sit
 * inside Persian text, and wrapping Persian speech in «…» guillemets.
 */
export function fixPunctuation(text: string): string {
  let out = text
  out = out.replace(/\.\.\.+/g, '…')
  out = out.replace(/…{2,}/g, '…')
  out = out.replace(/[؟]{2,}/g, '؟')
  out = out.replace(/!{2,}/g, '!')
  out = out.replace(/[،]{2,}/g, '،')
  out = out.replace(/([؀-ۿ])\s*\?/g, '$1؟')
  out = out.replace(/([؀-ۿ])\s*;/g, '$1؛')
  out = out.replace(/([؀-ۿ]),/g, '$1،')
  out = out.replace(/"([^"\n]*[؀-ۿ][^"\n]*)"/g, '«$1»')
  out = out.replace(/'([^'\n]*[؀-ۿ][^'\n]*)'/g, '«$1»')
  return out
}

/** Dict keys like میخوام are typed both with and without the نیم‌فاصله; add the
 *  ZWNJ-joined variant of every می/نمی-prefixed key so either spelling matches. */
export function expandMiVariants(dict: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = { ...dict }
  for (const [k, v] of Object.entries(dict)) {
    const m = k.match(/^(می|نمی)(?=[؀-ۿ])/)
    if (m && !k.includes(ZWNJ)) out[`${m[1]}${ZWNJ}${k.slice(m[1].length)}`] = v
  }
  return out
}

/**
 * Repair the two most common spacing mistakes: a full space where Persian wants
 * a نیم‌فاصله ("می خواهم" → "می‌خواهم", and the glued "میخواهم" → "می‌خواهم")
 * plus the generic ها/های/تر/ترین suffix joins. Only exact verb inflections are
 * touched, so nouns like میدان or میوه survive untouched.
 */
export function fixZWNJ(text: string): string {
  let out = text
  // Clean stray ZWNJs first: doubled half-spaces, or one glued to a real space.
  out = out.replace(/‌{2,}/g, '‌')
  out = out.replace(/‌ +/g, ' ')
  out = out.replace(/ +‌(?=[؀-ۿ])/g, ' ')

  // Every known inflection, joined whether typed with a space or glued.
  out = out.replace(MI_RE, (_m, pre, _sp, form) => pre + ZWNJ + form)

  // Generic space join for می/نمی + any other verb ("می رفت" → "می‌رفت").
  // و/که guard keeps the noun می (wine) from joining its conjunction or the
  // relative pronoun: "می که نوشیدم" must stay two words.
  out = out.replace(/(می|نمی)( +)(?![وکه])(?=\p{L})/gu, '$1' + ZWNJ)

  // Plural ها/های and comparative تر/ترین attach to the noun with a نیم‌فاصله.
  out = out.replace(
    /([؀-ۿ]+) (ها|های|تر|ترین)(?=[\s.،؛؟!…]|$)/g,
    (_, w, sfx) => w + ZWNJ + sfx,
  )
  return out
}

export function fixSpacing(text: string): string {
  let out = text
  // No space before Persian sentence punctuation, a single space after.
  out = out.replace(/ *([،؛؟!…])/g, '$1')
  out = out.replace(/ *\./g, '.')
  // …but not between a digit and a decimal point (۳.۵ stays ۳.۵).
  out = out.replace(/([،؛؟!.…])(?=[؀-ۿ])(?![۰-۹٠-٩])/g, '$1 ')
  // Guillemets hug their text: «کلمه», not « کلمه ».
  out = out.replace(/« +/g, '«')
  out = out.replace(/ +»/g, '»')
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
  'نمیدونم': 'نمیدانم',
  'نمیدونی': 'نمیدانی',
  'نمیدونه': 'نمیداند',
  'نمیدونیم': 'نمیدانیم',
  'نمیدونید': 'نمیدانید',
  'نمیدونن': 'نمیدانند',
  'نمیشه': 'نمیشود',
  'نمیرم': 'نمیروم',
  'نمیرن': 'نمیروند',
  'نمیاد': 'نمیآید',
  'اصلا': 'اصلاً',
  'واقعا': 'واقعاً',
  'حتما': 'حتماً',
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
  'بخوام': 'بخواهم',
  'بخوای': 'بخواهی',
  'بخواد': 'بخواهد',
  'بخوایم': 'بخواهیم',
  'بخواین': 'بخواهید',
  'بخوان': 'بخواهند',
  'باشه': 'باشد',
  'بشه': 'بشود',
  'بشی': 'بشوی',
  'بشیم': 'بشویم',
  'بشن': 'بشوند',
  'خوبه': 'خوب است',
  'خونه': 'خانه',
  'کتابخونه': 'کتابخانه',
  'چیکار': 'چه کار',
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
  'دوباره': 'بار دیگر',
  'دیگه': 'دیگر',
  'اصلا': 'اصلاً',
  'واقعا': 'واقعاً',
  'فقط': 'تنها',
  'اینطوری': 'این‌گونه',
  'اونطوری': 'آن‌گونه',
  'جوری': 'طور',
  'بهم': 'به من',
  'بهمون': 'به ما',
  'بهت': 'به تو',
  'بهش': 'به او',
  'هیچکس': 'هیچ‌کس',
  'کسی': 'کسی',
  'نمیدونم': 'نمی‌دانم',
  'نمیدونی': 'نمی‌دانی',
  'نمیدونه': 'نمی‌داند',
  'نمیدونیم': 'نمی‌دانیم',
  'نمیدونید': 'نمی‌دانید',
  'نمیدونن': 'نمی‌دانند',
  'نمیشه': 'نمی‌شود',
  'نمیرم': 'نمی‌روم',
  'نمیرن': 'نمی‌روند',
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

/** Replace whole words (a letter on either side, or a نیم‌فاصله, blocks a match)
 *  from a dictionary. Punctuation — ، ؛ ؟ — counts as a boundary. */
export function replaceWords(text: string, dict: Record<string, string>): { text: string; count: number } {
  let out = text
  let count = 0
  for (const [from, to] of orderedEntries(dict)) {
    const re = new RegExp(
      `(?<![\\p{L}\\u200c])${escapeRegExp(from)}(?![\\p{L}\\u200c])`,
      'gu',
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
