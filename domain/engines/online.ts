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

export async function editOnline(
  input: string,
  mode: WritingMode,
  opts: OnlineOptions,
): Promise<string> {
  const endpoint = opts.endpoint.replace(/\/+$/, '')
  const system = `${mode.instruction}\n\n${ONLINE_RULES}`
  const body = {
    model: opts.model || 'gemma2:9b',
    backend: opts.backend,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: input },
    ],
    temperature: 0.3,
    stream: true,
  }

  let out = await request(endpoint, body, opts.onPartial)
  if (!looksBroken(out, input, mode)) return unwrapGuillemets(out)

  // The model dodged the task (echoed instructions / changed language). Retry
  // once, more deterministically, framing the input as data to edit.
  const retry = await request(
    endpoint,
    {
      ...body,
      temperature: 0.1,
      messages: [
        { role: 'system', content: `${system}\n\n${HARDENING_RULE}` },
        { role: 'user', content: `متن:\n«${input}»` },
      ],
    },
    opts.onPartial,
  )
  if (looksBroken(retry, input, mode)) {
    throw new Error('online engine returned an unedited response')
  }
  return unwrapGuillemets(retry)
}

// The retry frames the input as «...», and Qwen sometimes echoes the quotes
// around its whole reply. Strip a wrapping pair; keep any «» used mid-text.
function unwrapGuillemets(text: string): string {
  const t = text.trim()
  if (t.length > 2 && t.startsWith('«') && t.endsWith('»')) {
    const inner = t.slice(1, -1).trim()
    if (inner) return inner
  }
  return t
}
