// Virastar edit proxy — a Cloudflare Worker that fronts an AI model for the
// static Virastar site. The site sends OpenAI-style chat-completions bodies and
// (with `stream: true`) reads back SSE deltas as the edit forms; callers that
// omit `stream` still get an OpenAI-shaped JSON reply.
//
// Backends (first configured one wins):
//   1. GEMINI_API_KEY → Google Gemini (best quality for Persian formal prose;
//                       model `gemini-3.6-flash`, override with GEMINI_MODEL).
//   2. AI binding   → Cloudflare Workers AI (no-key fallback; Llama 3.3 70B).
//   3. HF_TOKEN      → HuggingFace serverless inference (Qwen2.5-14B).
//
// A request can name a `backend` explicitly (the app's model picker does).
// That backend is tried first, then the remaining configured backends in the
// order above. Failures move on to the next backend instead of retrying the
// same quota/rate error, so the app keeps delivering a real AI edit while any
// backend lives — it never silently degrades to rule-based rewriting.
//
// Workers AI chat models occasionally leak a stray Chinese character into
// otherwise Persian prose, so the worker re-checks its own output for
// non-Persian script, retries once with a corrective instruction, and strips
// any leftover foreign characters as a last resort. The app's own guard
// (`domain/engines/editing.ts`) stays as a second backstop.
//
// Deploy:
//   npx wrangler login
//   npx wrangler deploy
//   npx wrangler secret put WORKERS_AI_MODEL   # optional model override

export interface Env {
  GEMINI_API_KEY?: string
  /** Gemini model id, default gemini-3.6-flash. */
  GEMINI_MODEL?: string
  /** Cloudflare Workers AI binding (no-key fallback backend). */
  AI?: { run: (model: string, options: Record<string, unknown>) => Promise<unknown> }
  /** Workers AI model id, default @cf/meta/llama-3.3-70b-instruct-fp8-fast. */
  WORKERS_AI_MODEL?: string
  HF_TOKEN?: string
  /** HuggingFace model id, default Qwen/Qwen2.5-14B-Instruct (free tier). */
  HF_MODEL?: string
  /** Comma-separated list of origins allowed to call this worker. */
  ALLOWED_ORIGINS?: string
}

// The app is served from GitHub Pages; Capacitor wraps it in a WKWebView with
// a capacitor:// origin; local dev hits localhost. Requests without an Origin
// header (native clients, some WKWebView setups) are also accepted.
const DEFAULT_ALLOWED_ORIGINS = [
  'https://aghamorad.github.io',
  'https://virastar.ir',
]

const JSON_HEADERS = { 'Content-Type': 'application/json' }
const SSE_HEADERS = { ...JSON_HEADERS, 'Content-Type': 'text/event-stream' }
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta'
const HF_CHAT_URL = 'https://api-inference.huggingface.co/v1/chat/completions'
// Llama 3.3 70B (not the Qwen3 reasoning model — that burns the token budget
// on thinking and emits no rewrite).
const DEFAULT_WORKERS_AI_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast'
const DEFAULT_HF_MODEL = 'Qwen/Qwen2.5-14B-Instruct'
const DEFAULT_GEMINI_MODEL = 'gemini-3.6-flash'

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, ...JSON_HEADERS } })
}

function sseLine(obj: unknown): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(obj)}\n\n`)
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

// Local development runs on arbitrary localhost ports and the iOS app is a
// Capacitor WKWebView, so those origins always pass. Otherwise require an
// explicit entry in the allowlist.
function originAllowed(origin: string, allowed: string[]): boolean {
  if (allowed.includes(origin)) return true
  try {
    const url = new URL(origin)
    if (url.protocol === 'capacitor:') return true
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') return true
  } catch {
    /* not a URL — treat as disallowed */
  }
  return false
}

interface ChatMessage {
  role?: string
  content?: unknown
}

// Persian (and other Arabic-script) prose should never contain a letter from a
// foreign script. Workers AI chat models occasionally slip in a Chinese or
// Latin character, so this drives the worker's own retry + strip pass.
const FOREIGN_LETTER = /\p{Letter}/u
const ARABIC_SCRIPT = /\p{Script_Extensions=Arabic}/u
function hasForeignLetter(value: string): boolean {
  return [...value].some((c) => FOREIGN_LETTER.test(c) && !ARABIC_SCRIPT.test(c))
}
// Keep only Arabic-script letters, numbers, punctuation, symbols, spaces and
// join controls (ZWNJ) — everything else (Latin/CJK/Cyrillic letters) is dropped.
const FOREIGN_STRIP = /[^\p{Script_Extensions=Arabic}\p{N}\p{P}\p{S}\p{Z}\p{Cf}]/gu

// Every backend is an async generator that yields text deltas as they are
// produced and throws on failure. The failover loop commits to the first
// backend that yields anything, then streams it to the caller.

// Gemini uses its own REST shape, so translate the OpenAI-style request into
// systemInstruction + contents and stream back the text deltas.
async function* geminiStream(
  env: Env,
  user: string,
  messages: ChatMessage[],
  temperature: number,
): AsyncGenerator<string> {
  const system = messages
    .filter((m) => m.role === 'system')
    .map((m) => String(m.content ?? ''))
    .join('\n')
  const model = env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL
  const words = user.trim().split(/\s+/).length
  // Gemini 3.x flash is a reasoning model: it spends a large chunk of its token
  // budget on internal thinking, so give it a generous cap or the actual
  // rewrite gets cut off at MAX_TOKENS with a truncated fragment.
  const maxOutputTokens = Math.min(8192, Math.max(2048, words * 8 + 512))
  const params = new URLSearchParams({ key: env.GEMINI_API_KEY ?? '' })

  const payload: Record<string, unknown> = {
    contents: [{ role: 'user', parts: [{ text: user }] }],
    generationConfig: { temperature, maxOutputTokens },
  }
  if (system.trim()) payload.systemInstruction = { parts: [{ text: system }] }

  const res = await fetch(`${GEMINI_BASE}/models/${model}:streamGenerateContent?alt=sse&${params}`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`gemini ${res.status} ${detail.slice(0, 200)}`)
  }
  if (!res.body) throw new Error('gemini returned an empty response body')

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let emitted = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let idx = buffer.indexOf('\n\n')
    while (idx !== -1) {
      const block = buffer.slice(0, idx)
      buffer = buffer.slice(idx + 2)
      for (const t of extractGeminiTexts(block)) {
        emitted++
        yield t
      }
      if (finishedGemini(block)) return
      idx = buffer.indexOf('\n\n')
    }
  }
  if (buffer.trim()) {
    for (const t of extractGeminiTexts(buffer)) {
      emitted++
      yield t
    }
  }
  if (emitted === 0) throw new Error('gemini returned no content')
}

function extractGeminiTexts(block: string): string[] {
  const texts: string[] = []
  for (const line of block.split('\n')) {
    const t = line.trim()
    if (!t.startsWith('data:')) continue
    const payload = t.slice(5).trim()
    if (!payload || payload === '[DONE]') continue
    let obj: any
    try {
      obj = JSON.parse(payload)
    } catch {
      continue
    }
    for (const part of obj?.candidates?.[0]?.content?.parts ?? []) {
      if (part?.thought !== true && typeof part?.text === 'string' && part.text) texts.push(part.text)
    }
  }
  return texts
}

function finishedGemini(block: string): boolean {
  for (const line of block.split('\n')) {
    const t = line.trim()
    if (!t.startsWith('data:')) continue
    const payload = t.slice(5).trim()
    if (!payload) continue
    let obj: any
    try {
      obj = JSON.parse(payload)
    } catch {
      continue
    }
    if (obj?.candidates?.[0]?.finishReason) return true
  }
  return false
}

// Cloudflare Workers AI takes OpenAI-style messages directly and can stream
// `{ response }` chunks. The model id resolves from the WORKERS_AI_MODEL
// secret, else the request's own `model` when the caller explicitly asked for
// Workers AI and named a @cf/ model, else the default.
function resolveWorkersAiModel(requestedModel: unknown, honorRequested: boolean): string {
  if (honorRequested && typeof requestedModel === 'string' && requestedModel.startsWith('@cf/')) {
    return requestedModel
  }
  return DEFAULT_WORKERS_AI_MODEL
}

async function* workersAiStream(
  env: Env,
  user: string,
  messages: ChatMessage[],
  temperature: number,
  model: string,
): AsyncGenerator<string> {
  if (!env.AI) throw new Error('workers ai not configured')
  const words = user.trim().split(/\s+/).length
  // Generous cap — reasoning models (e.g. Qwen3) burn tokens on thinking and a
  // low cap truncates the actual rewrite.
  const maxTokens = Math.min(8192, Math.max(2048, words * 8 + 512))

  const first = streamWorkersAi(env, model, messages, maxTokens, temperature)
  let saw = false
  let firstText = ''
  for await (const chunk of first) {
    saw = true
    firstText += chunk
    yield chunk
  }
  if (!saw) throw new Error('workers ai returned no text')
  if (!hasForeignLetter(firstText)) return

  // Leaked a Chinese/Latin letter — re-issue the request with a warning. Do
  // NOT echo the leaked draft into context, or the model "corrects" it by
  // repeating it and the reply comes back duplicated.
  const corrective = [...messages, {
    role: 'user',
    content: 'خروجیِ قبلی تو حرفِ چینی/لاتین (غیرفارسی) داشت و ممنوع است. فقط با خط فارسی دوباره بنویس؛ حتی یک حرف غیرفارسی هم جایز نیست.',
  }]
  let retried = ''
  for await (const chunk of streamWorkersAi(env, model, corrective, maxTokens, 0.1)) {
    retried += chunk
    yield chunk
  }
  if (!retried.trim()) yield firstText.replace(FOREIGN_STRIP, '').trim()
}

// A single Workers AI chat call, streaming text chunks. `stream: true` returns
// a byte stream of SSE/JSON lines (`data: {"response":"…"}`) — either an async
// iterable of Uint8Array or a ReadableStream — and some SDK versions hand back
// `{ response }` objects directly. All shapes are decoded here.
async function* streamWorkersAi(
  env: Env,
  model: string,
  messages: ChatMessage[],
  maxTokens: number,
  temperature: number,
): AsyncGenerator<string> {
  const out = (await env.AI!.run(model, {
    messages,
    max_tokens: maxTokens,
    temperature,
    stream: true,
  })) as any

  const isIterable = out && typeof out[Symbol.asyncIterator] === 'function'
  const isReader = out && typeof out.getReader === 'function'
  if (!isIterable && !isReader) throw new Error('workers ai streaming unavailable')

  const decoder = new TextDecoder()
  let buffer = ''
  // Pull one newline-delimited line out of the buffer; '' when none is whole yet.
  const takeLine = (): string => {
    const idx = buffer.indexOf('\n')
    if (idx === -1) return ''
    const line = buffer.slice(0, idx).trim()
    buffer = buffer.slice(idx + 1)
    return line
  }
  // A line may be bare JSON or an SSE `data:` payload.
  const lineText = (line: string): string => {
    if (!line) return ''
    const t = line.startsWith('data:') ? line.slice(5).trim() : line
    if (!t || t === '[DONE]') return ''
    try {
      const obj = JSON.parse(t)
      return typeof obj.response === 'string' ? obj.response : ''
    } catch {
      return ''
    }
  }
  async function* pump(chunks: AsyncIterable<Uint8Array | string | { response?: unknown }>) {
    for await (const chunk of chunks) {
      if (chunk instanceof Uint8Array) buffer += decoder.decode(chunk, { stream: true })
      else if (typeof chunk === 'string') buffer += chunk
      else if (chunk && typeof chunk.response === 'string' && chunk.response) {
        yield chunk.response
        continue
      } else continue
      for (let line = takeLine(); line !== ''; line = takeLine()) {
        const text = lineText(line)
        if (text) yield text
      }
    }
  }

  if (isIterable) {
    for await (const text of pump(out)) yield text
  } else {
    const reader = out.getReader()
    const wrapped = {
      [Symbol.asyncIterator]: () => ({
        next: () => reader.read(),
      }),
    }
    for await (const text of pump(wrapped)) yield text
  }
  if (buffer.trim()) {
    const text = lineText(buffer.trim())
    if (text) yield text
  }
}

// HuggingFace serverless inference exposes an OpenAI-compatible chat endpoint;
// its (non-streaming) answer becomes a single text delta.
async function* hfStream(
  env: Env,
  user: string,
  messages: ChatMessage[],
  temperature: number,
): AsyncGenerator<string> {
  if (!env.HF_TOKEN) throw new Error('huggingface not configured')
  const words = user.trim().split(/\s+/).length
  const body = {
    model: env.HF_MODEL || DEFAULT_HF_MODEL,
    messages,
    temperature,
    max_tokens: Math.min(4096, Math.max(256, words * 4 + 120)),
  }
  const res = await fetch(HF_CHAT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.HF_TOKEN}` },
    body: JSON.stringify(body),
  })
  const text = await res.text().catch(() => '')
  if (!res.ok) {
    throw new Error(`huggingface ${res.status} ${text.slice(0, 300)}`)
  }
  let obj: any
  try {
    obj = JSON.parse(text)
  } catch {
    throw new Error('huggingface returned an unparseable response')
  }
  const content = obj?.choices?.[0]?.message?.content
  if (typeof content === 'string' && content.trim()) yield content.trim()
  else throw new Error('huggingface returned no text')
}

interface BackendProducer {
  id: string
  make: () => AsyncGenerator<string>
}

function backendsInOrder(
  env: Env,
  requested: string,
  user: string,
  messages: ChatMessage[],
  temperature: number,
  requestedModel: unknown,
): BackendProducer[] {
  const list: BackendProducer[] = []
  const push = (producer: BackendProducer) => {
    if (!list.some((p) => p.id === producer.id)) list.push(producer)
  }

  const gemini = { id: 'gemini', make: () => geminiStream(env, user, messages, temperature) }
  // The caller's model name only wins when it asked for Workers AI directly;
  // failover from another backend uses the fast default instead of the heavy
  // Qwen MoE the app requests for its explicit Qwen option.
  const askedForWorkersAi = requested === 'workersai' || requested === 'cloudflare' || requested === ''
  const workersai = {
    id: 'workersai',
    make: () => workersAiStream(env, user, messages, temperature, resolveWorkersAiModel(requestedModel, askedForWorkersAi)),
  }
  const hf = { id: 'hf', make: () => hfStream(env, user, messages, temperature) }

  if (requested === 'gemini' && env.GEMINI_API_KEY) push(gemini)
  if (askedForWorkersAi && env.AI) push(workersai)
  if ((requested === 'hf' || requested === 'huggingface') && env.HF_TOKEN) push(hf)
  if (env.GEMINI_API_KEY) push(gemini)
  if (env.AI) push(workersai)
  if (env.HF_TOKEN) push(hf)
  return list
}

function streamResponse(it: AsyncGenerator<string>, first: IteratorResult<string>, backendId: string): Response {
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(sseLine(obj))
      try {
        let cur = first
        while (!cur.done) {
          if (cur.value) send({ text: cur.value })
          cur = await it.next()
        }
        send({ done: true, backend: backendId })
      } catch (e) {
        send({ error: errorMessage(e) })
      } finally {
        controller.close()
      }
    },
  })
  return new Response(body, { headers: { ...CORS_HEADERS, ...SSE_HEADERS } })
}

// Try each configured backend once; a failing backend throws on its first step
// and we move to the next, so a dead key costs one quick round trip instead of
// a multi-second retry storm.
async function answer(
  producers: BackendProducer[],
  wantStream: boolean,
): Promise<Response> {
  let lastError = 'no model backend configured'
  for (const producer of producers) {
    const it = producer.make()
    let first: IteratorResult<string>
    try {
      first = await it.next()
    } catch (e) {
      lastError = errorMessage(e)
      continue
    }

    if (wantStream) return streamResponse(it, first, producer.id)

    let text = ''
    let cur = first
    try {
      while (!cur.done) {
        if (cur.value) text += cur.value
        cur = await it.next()
      }
    } catch (e) {
      lastError = errorMessage(e)
      continue
    }
    if (!text.trim()) {
      lastError = `${producer.id} returned no text`
      continue
    }
    return json(200, { choices: [{ message: { role: 'assistant', content: text } }] })
  }
  return json(502, { error: lastError })
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS })
    if (request.method !== 'POST') return json(405, { error: 'method not allowed' })

    // Reject requests from unapproved sites so strangers can't burn the quota.
    // Localhost and the Capacitor wrapper are always fine; everything else must
    // be an explicit production origin.
    const origin = request.headers.get('Origin')
    const allowed = (env.ALLOWED_ORIGINS ?? DEFAULT_ALLOWED_ORIGINS.join(','))
      .split(',')
      .map((s) => s.trim())
    if (origin && !originAllowed(origin, allowed)) return json(403, { error: 'origin not allowed' })

    let body: {
      backend?: string
      model?: string
      stream?: boolean
      messages?: ChatMessage[]
      temperature?: number
    }
    try {
      body = await request.json()
    } catch {
      return json(400, { error: 'invalid json' })
    }

    const messages = Array.isArray(body.messages) ? body.messages : []
    const user = messages
      .filter((m) => m.role === 'user')
      .map((m) => String(m.content ?? ''))
      .join('\n')
    if (!user.trim()) return json(400, { error: 'no user message' })
    if (user.length > 20_000) return json(413, { error: 'text too long' })
    const temperature = typeof body.temperature === 'number' ? body.temperature : 0.3
    const requested = typeof body.backend === 'string' ? body.backend.trim() : ''

    const producers = backendsInOrder(env, requested, user, messages, temperature, body.model)
    return answer(producers, body.stream === true)
  },
}
