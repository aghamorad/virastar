// Virastar edit proxy — a Cloudflare Worker that fronts an AI model for the
// static Virastar site. The site sends OpenAI-style chat-completions bodies.
//
// Backends (first configured one wins):
//   1. HF_TOKEN      → HuggingFace serverless inference (Qwen2.5-72B by
//                      default — excellent at Persian, free tier). Uses a key
//                      that needs no Google sign-up.
//   2. GEMINI_API_KEY → Google Gemini (best quality; enable once a key exists).
//
// Both translate to/from the OpenAI body shape the app already speaks, so
// `domain/engines/online.ts` needs no changes and users never see a key.
//
// Deploy (see worker/README.md for the Persian walkthrough):
//   npx wrangler login
//   npx wrangler secret put HF_TOKEN        # value from ~/.cache/huggingface/token
//   npx wrangler deploy

export interface Env {
  HF_TOKEN?: string
  /** HuggingFace model id, default Qwen/Qwen2.5-72B-Instruct. */
  HF_MODEL?: string
  GEMINI_API_KEY?: string
  /** Comma-separated list of origins allowed to call this worker. */
  ALLOWED_ORIGINS?: string
}

// The app is served from GitHub Pages; Capacitor wraps it in a WKWebView with
// a capacitor:// origin; local dev hits localhost. Requests without an Origin
// header (native clients, some WKWebView setups) are also accepted.
const DEFAULT_ALLOWED_ORIGINS = [
  'https://aghamorad.github.io',
  'https://virastar.ir',
  'capacitor://localhost',
  'http://localhost:3000',
  'http://localhost:4173',
]

const JSON_HEADERS = { 'Content-Type': 'application/json' }
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta'
const HF_CHAT_URL = 'https://api-inference.huggingface.co/v1/chat/completions'
const DEFAULT_HF_MODEL = 'Qwen/Qwen2.5-72B-Instruct'
const DEFAULT_GEMINI_MODEL = 'gemini-2.0-flash'

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, ...JSON_HEADERS } })
}

interface ChatMessage {
  role?: string
  content?: unknown
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS })
    if (request.method !== 'POST') return json(405, { error: 'method not allowed' })

    // Reject requests from unapproved sites so strangers can't burn the quota.
    const origin = request.headers.get('Origin')
    const allowed = (env.ALLOWED_ORIGINS ?? DEFAULT_ALLOWED_ORIGINS.join(','))
      .split(',')
      .map((s) => s.trim())
    if (origin && !allowed.includes(origin)) return json(403, { error: 'origin not allowed' })

    let body: { model?: string; messages?: ChatMessage[]; temperature?: number }
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

    if (env.HF_TOKEN) return proxyHuggingFace(user, messages, temperature, env)
    if (env.GEMINI_API_KEY) return proxyGemini(user, messages, temperature, env)

    return json(500, { error: 'no model backend configured (set HF_TOKEN or GEMINI_API_KEY)' })
  },
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
  const model = 'gemini-2.0-flash'
  const words = user.trim().split(/\s+/).length
  const payload: Record<string, unknown> = {
    contents: [{ role: 'user', parts: [{ text: user }] }],
    generationConfig: {
      temperature,
      maxOutputTokens: Math.min(4096, Math.max(256, words * 4 + 120)),
    },
  }
  if (system.trim()) payload.systemInstruction = { parts: [{ text: system }] }

  const params = new URLSearchParams({ key: env.GEMINI_API_KEY ?? '' })
  const res = await fetch(`${GEMINI_BASE}/models/${model}:generateContent?${params}`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    return json(502, { error: `gemini ${res.status}`, detail: detail.slice(0, 400) })
  }

  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
    promptFeedback?: { blockReason?: string }
  }
  const content = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('').trim()
  if (!content) {
    const block = data.promptFeedback?.blockReason
    return json(502, { error: block ? `gemini blocked: ${block}` : 'gemini returned no content' })
  }
  return json(200, { choices: [{ message: { role: 'assistant', content } }] })
}
