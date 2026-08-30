// Virastar edit proxy — a Cloudflare Worker that fronts an AI model for the
// static Virastar site. The site sends OpenAI-style chat-completions bodies.
//
// Backends (first configured one wins):
//   1. GEMINI_API_KEY → Google Gemini (best quality for Persian formal prose;
//                       model `gemini-3.6-flash`, override with GEMINI_MODEL).
//   2. AI binding   → Cloudflare Workers AI (no-key fallback; Llama 3.3 70B).
//   3. HF_TOKEN      → HuggingFace serverless inference (Qwen2.5-14B).
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

    let body: { backend?: string; model?: string; messages?: ChatMessage[]; temperature?: number }
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

    // An explicit `backend` lets the app's model picker choose per request.
    // Default: Google Gemini wins whenever the key is set, then Cloudflare
    // Workers AI (no-key), then HuggingFace.
    const backend = typeof body.backend === 'string' ? body.backend.trim() : ''
    if (backend === 'gemini') return proxyGemini(user, messages, temperature, env)
    if (backend === 'workersai' || backend === 'cloudflare') return proxyWorkersAI(user, messages, temperature, env, body.model)
    if (backend === 'hf' || backend === 'huggingface') return proxyHuggingFace(user, messages, temperature, env)
    if (env.GEMINI_API_KEY) return proxyGemini(user, messages, temperature, env)
    if (env.AI) return proxyWorkersAI(user, messages, temperature, env, body.model)
    if (env.HF_TOKEN) return proxyHuggingFace(user, messages, temperature, env)

    return json(500, { error: 'no model backend configured (AI binding, HF_TOKEN, or GEMINI_API_KEY)' })
  },
}

// Cloudflare Workers AI takes OpenAI-style messages directly and returns
// { response: string } for chat models. The model id resolves from the
// WORKERS_AI_MODEL secret, else the request's own `model` when it names a
// Workers AI model (@cf/...), else the default.
function resolveWorkersAiModel(requestedModel: unknown): string {
  if (typeof requestedModel === 'string' && requestedModel.startsWith('@cf/')) return requestedModel
  return DEFAULT_WORKERS_AI_MODEL
}

// A single Workers AI chat call, returning the assistant text or null.
async function workersAiChat(
  env: Env,
  model: string,
  messages: ChatMessage[],
  maxTokens: number,
  temperature: number,
): Promise<string | null> {
  const out = await env.AI!.run(model, {
    messages,
    max_tokens: maxTokens,
    temperature,
  })
  const object = out as { response?: unknown; choices?: Array<{ message?: { content?: unknown } }> } | null
  const direct = typeof object?.response === 'string' ? object.response : undefined
  const choice = typeof object?.choices?.[0]?.message?.content === 'string' ? object.choices[0].message.content : undefined
  const content = (direct ?? choice ?? '').trim()
  return content || null
}

async function proxyWorkersAI(
  user: string,
  messages: ChatMessage[],
  temperature: number,
  env: Env,
  requestedModel?: unknown,
): Promise<Response> {
  const words = user.trim().split(/\s+/).length
  const model = resolveWorkersAiModel(requestedModel)
  // Generous cap — reasoning models (e.g. Qwen3) burn tokens on thinking and a
  // low cap truncates the actual rewrite.
  const maxTokens = Math.min(8192, Math.max(2048, words * 8 + 512))

  let content = await workersAiChat(env, model, messages, maxTokens, temperature)
  if (!content) return json(502, { error: 'workers ai returned no text' })

  if (hasForeignLetter(content)) {
    // Leaked a Chinese/Latin letter — re-issue the request with a warning. Do
    // NOT echo the leaked draft into context, or the model "corrects" it by
    // repeating it and the reply comes back duplicated.
    const corrective = [...messages, {
      role: 'user',
      content: 'خروجیِ قبلی تو حرفِ چینی/لاتین (غیرفارسی) داشت و ممنوع است. فقط با خط فارسی دوباره بنویس؛ حتی یک حرف غیرفارسی هم جایز نیست.',
    }]
    const retry = await workersAiChat(env, model, corrective, maxTokens, 0.1)
    if (retry && !hasForeignLetter(retry)) content = retry
    else if (retry) content = retry.replace(FOREIGN_STRIP, '').trim()
    else content = content.replace(FOREIGN_STRIP, '').trim()
  }

  if (!content) return json(502, { error: 'workers ai returned no text' })
  return json(200, { choices: [{ message: { role: 'assistant', content } }] })
}

// HuggingFace serverless inference exposes an OpenAI-compatible chat endpoint,
// so the app's request body passes through almost untouched.
async function proxyHuggingFace(
  user: string,
  messages: ChatMessage[],
  temperature: number,
  env: Env,
): Promise<Response> {
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
    return json(502, { error: `huggingface ${res.status}`, detail: text.slice(0, 400) })
  }
  // HF's chat response is already OpenAI-shaped: { choices: [{ message: { content } }] }.
  return new Response(text, { status: 200, headers: { ...CORS_HEADERS, ...JSON_HEADERS } })
}

// Google Gemini uses a different REST shape, so translate the OpenAI-style
// request into systemInstruction + contents and translate the reply back.
async function proxyGemini(
  user: string,
  messages: ChatMessage[],
  temperature: number,
  env: Env,
): Promise<Response> {
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

  let lastDetail = 'gemini unavailable'
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, 400 * attempt))
    const payload: Record<string, unknown> = {
      contents: [{ role: 'user', parts: [{ text: user }] }],
      generationConfig: { temperature, maxOutputTokens },
    }
    if (system.trim()) payload.systemInstruction = { parts: [{ text: system }] }

    const res = await fetch(`${GEMINI_BASE}/models/${model}:generateContent?${params}`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      lastDetail = `gemini ${res.status} ${detail.slice(0, 200)}`
      if (res.status === 429 || res.status === 500 || res.status === 503) continue // transient — retry
      return json(502, { error: lastDetail })
    }

    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
      promptFeedback?: { blockReason?: string }
    }
    const content = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('').trim()
    if (!content) {
      const block = data.promptFeedback?.blockReason
      lastDetail = block ? `gemini blocked: ${block}` : 'gemini returned no content'
      continue
    }
    return json(200, { choices: [{ message: { role: 'assistant', content } }] })
  }
  return json(502, { error: lastDetail })
}
