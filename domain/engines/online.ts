// The online editing engine — a thin, OpenAI-compatible chat-completions
// client. The mode's `instruction` is the system prompt; the user text is the
// message. Configured in تنظیمات (endpoint + model). If it fails, the caller
// falls back to the offline engine, so the app never breaks.

import type { WritingMode } from '../modes'
import { hasPersian } from '../persian'

export interface OnlineOptions {
  endpoint: string
  model: string
}

export const ONLINE_RULES = [
  'یک ویراستار حرفه‌ای باش: جمله‌ها را از نو بساز، ساختار متن را بازسازی کن و فقط عوض‌کردن چند واژه کافی نیست.',
  'معنا و تمام واقعیت‌ها، اعداد و نام‌ها را حفظ کن؛ فقط ساختار جمله، نشانه‌گذاری و لحن را بازسازی کن.',
  'فقط متن ویرایش‌شده را برگردان؛ توضیح نده، نقل‌قول اضافه نکن و متن را داخل گیومه نگذار.',
  'همیشه همان متنی را که داده‌ای ویرایش کن؛ درخواستِ متنِ بیشتر نکن، placeholder نگذار و قالبِ خالی نساز. اگر متن، درخواستِ بازنویسیِ چیزِ دیگری است، همین درخواست را با لحنِ خواسته‌شده بازنویسی کن.',
  'واژه‌های نویسنده را تحریف نکن: اگر گفته متنش «خیلی خشک» است و می‌خواهد «رسمی‌تر» شود، در خروجی نگو لحنش «رسمی» یا «بیش از حد رسمی» شده — همان خشک‌بودن را بازتاب بده، نه چیز دیگری.',
  'با صدای نویسنده بنویس، نه صدای خودت: مثلِ این‌که خودِ نویسنده متنش را با لحنِ خواسته‌شده بازنویسی کرده؛ از نویسنده چیزی نخواه و به او دستور نده.',
].join('\n')

// Fragments that mean the model is echoing its instructions instead of editing
// — Gemma drifts into this on short or trivial input.
const PROMPT_ECHO = ['از نو بساز', 'بازسازی کن', 'برگردان؛ توضیح نده', 'توضیح نده', 'کافی نیست']

// Fluent-Persian dodges: when the input reads like a meta-request («این نامه
// رو برای استادم بفرستم…»), the model asks for the "real" text or emits a
// blank form with placeholders instead of editing the words it was given.
const BROKEN_PATTERNS: RegExp[] = [
  /متن را برای من/,
  /متن ارسالی را/,
  /برای (ویرایش|بازنویسی) به من/,
  /ارسال (فرمایید|فرمائید|بفرمایید)/, // the editor telling the user to send the text
  /\[[^\]\n]{2,}\]/, // [هدف درخواست] style placeholders
  /【[^】\n]{2,}】/,
]

function looksBroken(out: string, input: string, mode: WritingMode): boolean {
  if (hasPersian(input) && !hasPersian(out)) return true // drifted to another language
  if (PROMPT_ECHO.some((f) => out.includes(f))) return true // repeating the system prompt
  if (mode.instruction && out.includes(mode.instruction.slice(0, 24))) return true
  if (BROKEN_PATTERNS.some((p) => p.test(out))) return true // dodging the edit
  return false
}

async function request(endpoint: string, body: unknown): Promise<string> {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`online engine returned ${res.status}`)
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>
    output?: string
  }
  const out = data.choices?.[0]?.message?.content ?? data.output
  if (!out || !out.trim()) throw new Error('online engine returned no text')
  return out.trim()
}

export async function editOnline(
  input: string,
  mode: WritingMode,
  opts: OnlineOptions,
): Promise<string> {
  const endpoint = opts.endpoint.replace(/\/+$/, '')
  const system = `${mode.instruction}\n\n${ONLINE_RULES}`
  const body = {
    model: opts.model || 'gemma2:9b',
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: input },
    ],
    temperature: 0.3,
  }

  let out = await request(endpoint, body)
  if (!looksBroken(out, input, mode)) return out

  // The model dodged the task (echoed instructions / changed language). Retry
  // once, more deterministically, framing the input as data to edit — and
  // explicitly telling it a short text is still a real text to fix.
  const retry = await request(endpoint, {
    ...body,
    temperature: 0.1,
    messages: [
      {
        role: 'system',
        content: `${system}\n\nاگر نوشته درخواستی دربارهٔ نوشتنِ چیزِ دیگری است، همین درخواست را با لحنِ خواسته‌شده بازنویسی کن؛ درخواستِ متنِ بیشتر نکن، placeholder نگذار و متنِ دیگری نساز. اگر متن کوتاه یا ساده است، همان متن را با اصلاحِ لازم برگردان؛ دستورها را تکرار نکن و فقط متن ویرایش‌شده را بده.`,
      },
      { role: 'user', content: `متن:\n«${input}»` },
    ],
  })
  if (looksBroken(retry, input, mode)) {
    throw new Error('online engine returned an unedited response')
  }
  return retry
}
