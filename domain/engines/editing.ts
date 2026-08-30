// Shared editing-quality logic for the LLM engines (in-browser model and the
// optional online endpoint). Pure text rules — no IO — so both engines guard
// their output identically.

import type { WritingMode } from '../modes'
import { hasPersian } from '../persian'

export const ONLINE_RULES = [
  'یک ویراستار حرفه‌ای باش: جمله‌ها را از نو بساز، ساختار متن را بازسازی کن و فقط عوض‌کردن چند واژه کافی نیست.',
  'معنا و تمام واقعیت‌ها، اعداد و نام‌ها را حفظ کن؛ فقط ساختار جمله، نشانه‌گذاری و لحن را بازسازی کن.',
  'فقط متن ویرایش‌شده را برگردان؛ توضیح نده، نقل‌قول اضافه نکن و متن را داخل گیومه نگذار.',
  'همیشه همان متنی را که داده‌ای ویرایش کن؛ درخواستِ متنِ بیشتر نکن، placeholder نگذار و قالبِ خالی نساز. اگر متن، درخواستِ بازنویسیِ چیزِ دیگری است، همین درخواست را با لحنِ خواسته‌شده بازنویسی کن.',
  'واژه‌های نویسنده را تحریف نکن: اگر گفته متنش «خیلی خشک» است و می‌خواهد «رسمی‌تر» شود، در خروجی نگو لحنش «رسمی» یا «بیش از حد رسمی» شده — همان خشک‌بودن را بازتاب بده، نه چیز دیگری.',
  'با صدای نویسنده بنویس، نه صدای خودت: مثلِ این‌که خودِ نویسنده متنش را با لحنِ خواسته‌شده بازنویسی کرده؛ از نویسنده چیزی نخواه و به او دستور نده.',
  'با خط فارسی بنویس؛ هیچ حرفِ لاتین، چینی یا غیرفارسی به‌کار نبر (اعداد و نشانه‌ها اشکالی ندارند).',
].join('\n')

// A second-chance system prompt used after a dodge: forces the model to edit
// the given text instead of echoing instructions or asking for more input.
export const HARDENING_RULE =
  'اگر نوشته درخواستی دربارهٔ نوشتنِ چیزِ دیگری است، همین درخواست را با لحنِ خواسته‌شده بازنویسی کن؛ درخواستِ متنِ بیشتر نکن، placeholder نگذار و متنِ دیگری نساز. اگر متن کوتاه یا ساده است، همان متن را با اصلاحِ لازم برگردان؛ دستورها را تکرار نکن و فقط متن ویرایش‌شده را بده.'

// Fragments that mean the model is echoing its instructions instead of editing
// — Gemma drifts into this on short or trivial input.
const PROMPT_ECHO = ['از نو بساز', 'بازسازی کن', 'برگردان؛ توضیح نده', 'توضیح نده', 'کافی نیست']

// Fluent-Persian dodges: when the input reads like a meta-request («این نامه
// رو برای استادم بفرستم…»), the model asks for the "real" text or emits a
// blank form with placeholders instead of editing the words it was given.
// The unconditional rules are unmistakable. The editorial-voice rules carry
// checkInput: a phrase only counts as a dodge when the model INTRODUCED it —
// if the author's own text already contains it, echoing it is a faithful
// rewrite. Without this, natural formal prose like «هدف از این نامه» or
// «در ادامه نامه» (legitimate letter openings) falsely rejects good rewrites.
const BROKEN_PATTERNS: Array<{ re: RegExp; checkInput?: string | RegExp }> = [
  { re: /متن را برای من/ },
  { re: /متن ارسالی را/ },
  { re: /برای (ویرایش|بازنویسی) به من/ },
  { re: /\[[^\]\n]{2,}\]/ }, // [هدف درخواست] style placeholders
  { re: /【[^】\n]{2,}】/ },
  // "please send" — only a dodge when the author didn't already use the imperative.
  { re: /ارسال (فرمایید|فرمائید|بفرمایید)/, checkInput: /(فرمایید|فرمائید|بفرمایید)/ },
  { re: /هدف (ما|این|از این)/, checkInput: 'هدف' }, // "our goal is..." editorial framing
  { re: /برای رسیدن به نتیجه/, checkInput: 'برای رسیدن به نتیجه' },
  { re: /^در ادامه/m, checkInput: 'در ادامه' },
  { re: /پیشنهاد (میشود|می‌شود|می شود)/, checkInput: 'پیشنهاد' },
]

// Markdown never belongs in a Persian rewrite: the 1B model pads short input
// with headings, bold and bullet lists when it decides to "organize" the text.
export const MARKDOWN_PATTERN = /\*\*|^#{1,6}\s|\n\s*[-*]\s+/m

export function hasMarkdown(value: string): boolean {
  return MARKDOWN_PATTERN.test(value)
}

// Gemma occasionally leaves a Latin/Cyrillic/CJK word in otherwise Persian
// prose, or drops a number while paraphrasing. Treat either as a failed edit
// so the caller falls back instead of showing corrupted text.
const FOREIGN_LETTER = /\p{Letter}/u
const ARABIC_SCRIPT = /\p{Script_Extensions=Arabic}/u

export function hasForeignLetter(value: string): boolean {
  return [...value].some((character) => FOREIGN_LETTER.test(character) && !ARABIC_SCRIPT.test(character))
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
  if (hasForeignLetter(out)) reasons.push('foreign-letter') // foreign-script leakage
  if (!numbersPreserved(input, out)) reasons.push('numbers') // factual anchor was dropped
  if (mode.id !== 'tashih' && out.trim() === input.trim()) reasons.push('unchanged') // no rewrite
  if (PROMPT_ECHO.some((f) => out.includes(f))) reasons.push('prompt-echo') // repeating the system prompt
  // An instruction's opening words are generic («این متن را به فارسی رسمی و
  // حرفه…»); a model naturally echoes them in framing like «بازنویسی کردم».
  // Only a full first sentence counts as real parroting.
  if (mode.instruction && out.includes(firstSentence(mode.instruction))) reasons.push('instruction-echo')
  const matchedPattern = BROKEN_PATTERNS.find(({ re, checkInput }) => {
    if (!re.test(out)) return false
    if (checkInput === undefined) return true
    return typeof checkInput === 'string' ? !input.includes(checkInput) : !checkInput.test(input)
  })
  if (matchedPattern) reasons.push(`broken-pattern:${matchedPattern.re.source}`) // dodging the edit
  return reasons
}

// The instruction up to its first hard stop — excludes the Persian semicolons
// that join clauses inside the first sentence.
function firstSentence(instruction: string): string {
  const match = instruction.split(/[.!؟\n]/, 1)[0]
  return match.length >= 24 ? match : instruction.slice(0, 24)
}
