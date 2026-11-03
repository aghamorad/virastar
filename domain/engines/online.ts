// The online editing engine — an OpenAI-compatible chat-completions client that
// streams the rewrite in as it is generated. By default it talks to the hosted
// Virastar proxy (`worker/`, which fronts Google Gemini and fails over to
// Cloudflare Workers AI); power users can point it at any OpenAI-compatible
// service (Ollama, etc.). The mode's `instruction` is the system prompt; the
// user text is the message. If it fails, the caller falls back to the offline
// rules, so the app never breaks.

import type { WritingMode } from '../modes'
import { HARDENING_RULE, ONLINE_RULES, looksBroken } from './editing'

// Kept for the dataset scripts, which import the shared prompt from here.
export { ONLINE_RULES } from './editing'

export interface OnlineOptions {
  endpoint: string
  model: string
  /** Which worker backend to route to ('gemini' | 'workersai' | 'hf'). */
  backend?: string
  /** User-provided Google Gemini API key (free tier) */
  geminiApiKey?: string
  /** User-provided Groq API key (free tier) */
  groqApiKey?: string
  /** Custom endpoint (e.g. http://localhost:11434/v1 for Ollama) */
  customEndpoint?: string
  customModel?: string
  /** Called as streamed text arrives, so the UI can show the edit forming. */
  onPartial?: (text: string) => void
}

// The hosted worker streams SSE deltas as `{ text }`; OpenAI-compatible
// endpoints stream `{ choices: [{ delta: { content } }] }`. A few custom
// endpoints ignore `stream` and answer JSON in one shot — handled separately.
function sseDelta(obj: any): string {
  if (typeof obj?.text === 'string' && obj.text) return obj.text
  return obj?.choices?.[0]?.delta?.content ?? ''
}

function parseSseLine(line: string): Record<string, any> | null {
  const t = line.trim()
  if (!t.startsWith('data:')) return null
  const payload = t.slice(5).trim()
  if (!payload || payload === '[DONE]') return null
  try {
    return JSON.parse(payload)
  } catch {
    return null
  }
}

async function request(
  endpoint: string,
  body: unknown,
  onPartial?: (text: string) => void,
): Promise<string> {
  const controller = new AbortController()
  // The worker must answer within this window; a stalled stream is caught by a
  // separate per-chunk inactivity timer below.
  const headTimer = window.setTimeout(() => controller.abort(), 30_000)
  let res: Response
  try {
    res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
  } finally {
    window.clearTimeout(headTimer)
  }
  if (!res.ok) throw new Error(`online engine returned ${res.status}`)

  const ctype = res.headers.get('content-type') ?? ''
  if (ctype.includes('application/json')) {
    // A custom endpoint answered JSON without streaming.
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>
      output?: string
    }
    const out = data.choices?.[0]?.message?.content ?? data.output
    if (!out || !out.trim()) throw new Error('online engine returned no text')
    onPartial?.(out.trim())
    return out.trim()
  }

  // Streaming body — our worker, or an OpenAI-compatible SSE endpoint.
  if (!res.body) throw new Error('online engine returned no body')
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let text = ''
  let inactivity = window.setTimeout(() => controller.abort(), 30_000)
  const touch = () => {
    window.clearTimeout(inactivity)
    inactivity = window.setTimeout(() => controller.abort(), 30_000)
  }
  // Consume one SSE block (split on blank lines) and return what it added.
  const consume = (block: string): { delta: string; done: boolean; error?: string } => {
    let delta = ''
    for (const line of block.split('\n')) {
      const obj = parseSseLine(line)
      if (!obj) continue
      if (obj.error) return { delta, done: false, error: String(obj.error) }
      const piece = sseDelta(obj)
      if (piece) delta += piece
      if (obj.done === true) return { delta, done: true }
    }
    return { delta, done: false }
  }
  try {
    for (;;) {
      let done: boolean
      let value: Uint8Array | undefined
      try {
        const read = await reader.read()
        done = read.done
        value = read.value
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') throw new Error('online engine timed out')
        throw e
      }
      touch()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      let idx = buffer.indexOf('\n\n')
      while (idx !== -1) {
        const block = buffer.slice(0, idx)
        buffer = buffer.slice(idx + 2)
        const parsed = consume(block)
        if (parsed.error) throw new Error(`online engine: ${parsed.error}`)
        if (parsed.delta) {
          text += parsed.delta
          onPartial?.(text)
        }
        if (parsed.done) return text.trim()
        idx = buffer.indexOf('\n\n')
      }
    }
    const tail = consume(buffer)
    if (tail.error) throw new Error(`online engine: ${tail.error}`)
    if (tail.delta) {
      text += tail.delta
      onPartial?.(text)
    }
  } finally {
    window.clearTimeout(inactivity)
  }
  const out = text.trim()
  if (!out) throw new Error('online engine returned no text')
  return out
}

async function callGeminiDirect(
  input: string,
  mode: WritingMode,
  apiKey: string,
  modelName = 'gemini-2.5-flash',
  onPartial?: (text: string) => void,
): Promise<string> {
  const model = modelName.includes('gemini') ? modelName : 'gemini-2.5-flash'
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
  const systemPrompt = `${mode.instruction}\n\n${ONLINE_RULES}`
  const userContent = `متن جهت بازنویسی و ویرایش به سبک «${mode.label}»:\n«««\n${input}\n»»»\n\nفقط متن ویرایش‌شده را بدون هیچ توضیح اضافی برگردان.`

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: systemPrompt }],
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: userContent }],
        },
      ],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 2048,
      },
    }),
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`خطای گوگل جمینی (${res.status}): ${detail.slice(0, 160)}`)
  }

  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
  }
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text || !text.trim()) throw new Error('گوگل جمینی متنی برنگرداند')
  const cleaned = cleanOutput(text)
  onPartial?.(cleaned)
  return cleaned
}

async function callGroqDirect(
  input: string,
  mode: WritingMode,
  apiKey: string,
  modelName = 'qwen-2.5-32b',
  onPartial?: (text: string) => void,
): Promise<string> {
  const url = 'https://api.groq.com/openai/v1/chat/completions'
  const systemPrompt = `${mode.instruction}\n\n${ONLINE_RULES}`
  const userContent = `متن جهت بازنویسی و ویرایش به سبک «${mode.label}»:\n«««\n${input}\n»»»\n\nفقط متن ویرایش‌شده را بدون هیچ توضیح اضافی بنویس.`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: modelName || 'qwen-2.5-32b',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
      temperature: 0.3,
      max_tokens: 2048,
    }),
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`خطای Groq (${res.status}): ${detail.slice(0, 160)}`)
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  const text = data.choices?.[0]?.message?.content
  if (!text || !text.trim()) throw new Error('Groq متنی برنگرداند')
  const cleaned = cleanOutput(text)
  onPartial?.(cleaned)
  return cleaned
}

async function callCustomEndpoint(
  input: string,
  mode: WritingMode,
  endpoint: string,
  modelName = 'qwen2.5:1.5b',
  onPartial?: (text: string) => void,
): Promise<string> {
  const ep = endpoint.replace(/\/+$/, '')
  const url = ep.endsWith('/chat/completions') ? ep : `${ep}/chat/completions`
  const systemPrompt = `${mode.instruction}\n\n${ONLINE_RULES}`
  const userContent = `متن جهت بازنویسی و ویرایش به سبک «${mode.label}»:\n«««\n${input}\n»»»\n\nفقط متن ویرایش‌شده را بدون هیچ توضیح اضافی بنویس.`

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: modelName || 'qwen2.5:1.5b',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
      temperature: 0.3,
    }),
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`خطای سرور محلی (${res.status}): ${detail.slice(0, 160)}`)
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  const text = data.choices?.[0]?.message?.content
  if (!text || !text.trim()) throw new Error('سرور محلی پاسخی نداد')
  const cleaned = cleanOutput(text)
  onPartial?.(cleaned)
  return cleaned
}

export async function editOnline(
  input: string,
  mode: WritingMode,
  opts: OnlineOptions,
): Promise<string> {
  // 1. If user provided a direct Gemini API key, use direct Google Gemini call
  if (opts.geminiApiKey && opts.geminiApiKey.trim()) {
    return callGeminiDirect(input, mode, opts.geminiApiKey.trim(), opts.model, opts.onPartial)
  }

  // 2. If user provided a direct Groq API key, use Groq
  if (opts.groqApiKey && opts.groqApiKey.trim()) {
    return callGroqDirect(input, mode, opts.groqApiKey.trim(), opts.model, opts.onPartial)
  }

  // 3. If user provided a custom local endpoint (e.g. Ollama http://localhost:11434/v1)
  if (opts.customEndpoint && opts.customEndpoint.trim()) {
    return callCustomEndpoint(input, mode, opts.customEndpoint.trim(), opts.customModel, opts.onPartial)
  }

  // 4. Default: Hosted Cloudflare Worker proxy
  const endpoint = opts.endpoint.replace(/\/+$/, '')
  const system = `${mode.instruction}\n\n${ONLINE_RULES}`
  const userContent = `متن جهت بازنویسی و ویرایش به سبک «${mode.label}»:\n«««\n${input}\n»»»\n\nفقط متن ویرایش‌شده را بنویس.`
  const body = {
    model: opts.model || 'gemini-2.5-flash',
    backend: opts.backend,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: userContent },
    ],
    temperature: 0.3,
    stream: true,
  }

  let out = await request(endpoint, body, opts.onPartial)
  out = cleanOutput(out)
  if (!looksBroken(out, input, mode)) return out

  // The model dodged the task (echoed instructions / changed language). Retry
  // once, more deterministically, framing the input as data to edit.
  const retry = await request(
    endpoint,
    {
      ...body,
      temperature: 0.1,
      messages: [
        { role: 'system', content: `${system}\n\n${HARDENING_RULE}` },
        { role: 'user', content: `متن بازنویسی شود:\n«««\n${input}\n»»»\n\nفقط متن نهایی را بدون هیچ کلمه اضافه‌ای بنویس.` },
      ],
    },
    opts.onPartial,
  )
  const cleanedRetry = cleanOutput(retry)
  if (looksBroken(cleanedRetry, input, mode)) {
    throw new Error('مدل آنلاین پاسخ معتبری بازنگرداند.')
  }
  return cleanedRetry
}

export function cleanOutput(text: string): string {
  let t = text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/^\s*[-*]\s+/gm, '')
    .replace(/^\s*>\s?/gm, '')
    .trim()

  if (t.length > 2) {
    const open = t[0]
    const close = t[t.length - 1]
    const pair =
      (open === '«' && close === '»') ||
      (open === '"' && close === '"') ||
      (open === "'" && close === "'")
    if (pair) {
      const inner = t.slice(1, -1).trim()
      if (inner) t = inner
    }
  }
  return t
}
