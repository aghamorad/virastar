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
].join('\n')

// Fragments that mean the model is echoing its instructions instead of editing
// — Gemma drifts into this on short or trivial input.
const PROMPT_ECHO = ['از نو بساز', 'بازسازی کن', 'برگردان؛ توضیح نده', 'توضیح نده', 'کافی نیست']

function looksBroken(out: string, input: string, mode: WritingMode): boolean {
  if (hasPersian(input) && !hasPersian(out)) return true // drifted to another language
  if (PROMPT_ECHO.some((f) => out.includes(f))) return true // repeating the system prompt
  if (mode.instruction && out.includes(mode.instruction.slice(0, 24))) return true
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
    temperature: 0.4,
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
        content: `${system}\n\nاگر متن کوتاه یا ساده است، همان متن را با اصلاحِ لازم برگردان؛ دستورها را تکرار نکن و فقط متن ویرایش‌شده را بده.`,
      },
      { role: 'user', content: `متن:\n«${input}»` },
    ],
  })
  if (looksBroken(retry, input, mode)) {
    throw new Error('online engine returned an unedited response')
  }
  return retry
}
