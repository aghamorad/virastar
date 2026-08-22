// The online editing engine — a thin, OpenAI-compatible chat-completions
// client. The mode's `instruction` is the system prompt; the user text is the
// message. Configured in تنظیمات (endpoint + model). If it fails, the caller
// falls back to the offline engine, so the app never breaks.

import type { WritingMode } from '../modes'

export interface OnlineOptions {
  endpoint: string
  model: string
}

export const ONLINE_RULES = [
  'متن فارسی را ویرایش کن.',
  'معنای اصلی را حفظ کن و به لحن نویسنده احترام بگذار.',
  'فقط متن ویرایش‌شده را برگردان؛ توضیح نده، نقل‌قول اضافه نکن و متن را داخل گیومه نگذار.',
].join('\n')

export async function editOnline(
  input: string,
  mode: WritingMode,
  opts: OnlineOptions,
): Promise<string> {
  const endpoint = opts.endpoint.replace(/\/+$/, '')
  const body = {
    model: opts.model || 'gemma2:9b',
    messages: [
      { role: 'system', content: `${mode.instruction}\n\n${ONLINE_RULES}` },
      { role: 'user', content: input },
    ],
    temperature: 0.4,
  }

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
