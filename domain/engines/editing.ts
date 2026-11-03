// Shared editing-quality logic for the LLM engines (in-browser model and the
// optional online endpoint). Pure text rules — no IO — so both engines guard
// their output identically.

import type { WritingMode } from '../modes'
import { hasPersian } from '../persian'

export const ONLINE_RULES = [
  'تو یک ابزار بازنویسی و ویرایش زبان فارسی هستی، نه یک چت‌بات گفتگوگر.',
  'فقط و فقط متن بازنویسی‌شده را برگردان؛ هیچ توضیح، مقدمه، سلام، احوالپرسی یا پیامی اضافه نکن.',
  'تنها و تنها یک نسخه نهایی از متن تولید کن؛ از ارائه گزینه‌های جایگزین، شماره‌گذاری، تکرار متن یا چسباندن نسخه‌های چندگانه به هم به شدت خودداری کن.',
  'ساختار پاراگراف‌ها، شکستگی خطوط و فاصله‌بندی‌های متن اصلی را دقیقاً حفظ کن و پاراگراف‌ها را در یک بند طولانی ادغام نکن.',
  'تمام واقعیت‌ها، پیام اصلی، اسامی خاص و اعداد را با دقت حفظ کن؛ ساختار، دستور زبان، واژگان و لحن را متناسب با سبک درخواستی بازسازی کن.',
  'نشانه‌گذاری دقیق و استاندارد فارسی را کاملاً رعایت کن: در پایان هر جمله خبری حتماً نقطه (.) بگذار. اگر کاربر نقطه را جا انداخته، خودت حتماً در انتهای جمله نقطه قرار بده. برای پرسش‌ها از (؟) و برای تعجب از (!) استفاده کن.',
  'نیم‌فاصله‌های دستوری (مانند «می‌روم»، «نمی‌دانم»، «کتاب‌ها»)، ویرگول فارسی (،) و پیوستگی علائم نگارشی به واژه پیشین را رعایت کن.',
  'هیچ علامت نقل‌قول یا گیومه‌ای («...» یا "...") دور کل متن خروجی نگذار؛ فقط متن خالص را بنویس.',
  'همیشه همان متنی را که به تو داده شده بازنویسی کن؛ هرگز درخواست متن بیشتر یا ارسال متن اصلی نکن، قالب خالی نساز و placeholder نگذار.',
  'از علامت‌های مارک‌داون (مانند ** برای پررنگ‌کردن یا # برای عنوان) در متن استفاده نکن.',
  'اصطلاحات فنی و مخفف‌های انگلیسی موجود در متن (مانند PDF, HR, API, SQL) و اعداد را حفظ کن.',
  'با خط و زبان فارسی بنویس (به جز نام‌های برند یا اصطلاحات انگلیسی که در متن اصلی آمده‌اند).',
].join('\n')

// A second-chance system prompt used after a dodge: forces the model to edit
// the given text instead of echoing instructions or asking for more input.
export const HARDENING_RULE =
  'فقط و فقط یک نسخه نهایی از متن ویرایش‌شده را به سبک درخواستی برگردان؛ از تکرار متن، گزینه‌های جایگزین، علائم نقل‌قول و مارک‌داون پرهیز کن.'

// Fragments that mean the model is echoing its instructions instead of editing
const PROMPT_ECHO = ['برگردان؛ توضیح نده', 'قوانین اکید', 'فقط متن بازنویسی‌شده را برگردان']

// Genuine conversational dodges: when a model mistakenly replies as a chatbot
// instead of rewriting the text. We only flag unambiguous evasion phrases.
const BROKEN_PATTERNS: Array<{ re: RegExp; checkInput?: string | RegExp }> = [
  { re: /متن (اصلی|کامل|مورد نظر|خود) را (برای من |جهت )?(ارسال|بفرستید)/ },
  { re: /برای (ویرایش|بازنویسی) به من ارسال/ },
  { re: /متنی برای (ویرایش|بازنویسی) ارائه نشده/ },
  { re: /لطفاً متن (خود|مورد نظر) را/ },
  { re: /\[(نام|عنوان|موضوع|تاریخ|نام کارفرما|محل امضا|نام استاد)[^\]\n]*\]/ }, // template placeholders
  { re: /【[^】\n]{2,}】/ },
]

export const MARKDOWN_PATTERN = /\*\*|^#{1,6}\s|\n\s*[-*]\s+/m

export function hasMarkdown(value: string): boolean {
  return MARKDOWN_PATTERN.test(value)
}

// Corrupted script leaks (Gemma/other models leaking Cyrillic or CJK tokens).
const CORRUPT_SCRIPT = /[\p{Script=Cyrillic}\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Devanagari}]/u
const LATIN_LETTER = /[a-zA-Z]/g

export function hasForeignLetter(value: string, input = ''): boolean {
  // Always reject actual foreign script corruption (Russian, Chinese, Japanese, etc.)
  if (CORRUPT_SCRIPT.test(value)) return true

  // For Latin letters (PDF, CV, URL, Telegram):
  // If the input already had Latin letters, keeping them is expected.
  if (LATIN_LETTER.test(input)) return false

  // If input had no Latin, allow short acronyms (up to 15 Latin letters total),
  // but flag if the model drifted into writing full English sentences.
  const latinMatches = value.match(LATIN_LETTER)
  return latinMatches !== null && latinMatches.length > 25
}

function numbersPreserved(input: string, output: string): boolean {
  const normalizedInput = input.replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
  const normalizedOutput = output.replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
  const numbers = normalizedInput.match(/\d+(?:[.,]\d+)?/g) ?? []
  return numbers.every((number) => normalizedOutput.includes(number))
}

export function looksBroken(out: string, input: string, mode: WritingMode): boolean {
  return brokenReasons(out, input, mode).length > 0
}

// Which guard tripped — logged on rejection so a rejected model rewrite is
// diagnosable instead of a black box.
export function brokenReasons(out: string, input: string, mode: WritingMode): string[] {
  const reasons: string[] = []
  if (hasPersian(input) && !hasPersian(out)) reasons.push('no-persian') // drifted to another language
  if (hasForeignLetter(out, input)) reasons.push('foreign-letter') // foreign-script leakage
  if (!numbersPreserved(input, out)) reasons.push('numbers') // factual anchor was dropped
  if (mode.id !== 'tashih' && out.trim() === input.trim()) reasons.push('unchanged') // no rewrite
  if (PROMPT_ECHO.some((f) => out.includes(f))) reasons.push('prompt-echo') // repeating the system prompt
  
  const matchedPattern = BROKEN_PATTERNS.find(({ re, checkInput }) => {
    if (!re.test(out)) return false
    if (checkInput === undefined) return true
    return typeof checkInput === 'string' ? !input.includes(checkInput) : !checkInput.test(input)
  })
  if (matchedPattern) reasons.push(`broken-pattern:${matchedPattern.re.source}`) // dodging the edit
  return reasons
}

/**
 * Strips markdown, prompt fence wrappers (««« ... »»»), framing quotes,
 * and detects/deduplicates concatenated alternative versions emitted by models.
 */
export function cleanOutput(text: string): string {
  if (!text) return ''
  let t = text.trim()

  // 1. Strip markdown code fences or prompt delimiter blocks
  t = t.replace(/^```[a-z]*\n([\s\S]*?)\n```$/g, '$1')
  t = t.replace(/^«««\s*([\s\S]*?)\s*»»»$/g, '$1')

  // 2. Strip basic markdown formatting
  t = t
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/^\s*[-*]\s+/gm, '')
    .replace(/^\s*>\s?/gm, '')
    .trim()

  // 3. If the model provided explicit alternatives (e.g. "نسخه ۱: ... نسخه ۲: ...")
  const optionMatch = t.match(/^(?:نسخه|گزینه|حالت)\s*(?:۱|1|اول)[:\-\s]+([\s\S]+?)(?=\n*(?:نسخه|گزینه|حالت)\s*(?:۲|2|دوم)|$)/)
  if (optionMatch && optionMatch[1]?.trim()) {
    t = optionMatch[1].trim()
  }

  // 4. If the model output a quoted version followed by a duplicate concatenated version:
  // e.g. «سرور API پاسخ 404 داد»سرور_api پاسخ...
  const quoteGluedMatch = t.match(/^[«"“]([^»"”]+)[»"”][\s\S]+$/)
  if (quoteGluedMatch && quoteGluedMatch[1]?.trim().length > 10) {
    t = quoteGluedMatch[1].trim()
  }

  // 5. Strip any outer wrapping quotes / guillemets
  t = t.replace(/^[«"“'»\s]+/, '').replace(/[«"”'»\s]+$/, '').trim()

  // 6. Detect duplicated sentence concatenation (glued seam like "... از کار افتادسرور پاسخ ...")
  const words = t.split(/\s+/)
  if (words.length >= 8) {
    const w0 = words[0].replace(/^[«"“']/, '')
    const w1 = words[1]?.replace(/^[«"“']/, '')
    const w2 = words[2]?.replace(/^[«"“']/, '')

    for (let i = 3; i < words.length; i++) {
      const w = words[i]
      const idx = w.indexOf(w0)
      if (idx > 0) {
        // Glued seam without space (e.g. "افتادسرور")
        const beforeWord = w.slice(0, idx)
        const reconstructed = [...words.slice(0, i), beforeWord].join(' ').trim()
        t = reconstructed + (/[.!?؟،؛]$/.test(reconstructed) ? '' : '.')
        break
      } else if (idx === 0 && w1 && words[i + 1] === w1 && (!w2 || words[i + 2] === w2)) {
        // At least 2-3 consecutive matching words repeating from the start
        const reconstructed = words.slice(0, i).join(' ').trim()
        t = reconstructed + (/[.!?؟،؛]$/.test(reconstructed) ? '' : '.')
        break
      }
    }
  }

  return t.trim()
}

// The instruction up to its first hard stop — excludes the Persian semicolons
// that join clauses inside the first sentence.
function firstSentence(instruction: string): string {
  const match = instruction.split(/[.!؟\n]/, 1)[0]
  return match.length >= 24 ? match : instruction.slice(0, 24)
}
