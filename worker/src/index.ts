// Virastar edit proxy — a Cloudflare Worker that fronts Google Gemini for the
// static Virastar site. The site sends OpenAI-style chat-completions bodies;
// this worker translates them to Gemini's REST API and translates the reply
// back, so the app's online engine (`domain/engines/online.ts`) needs no
// changes and users never see an API key.
//
// Deploy (see worker/README.md for the Persian walkthrough):
//   npx wrangler login
//   npx wrangler secret put GEMINI_API_KEY      # free key from Google AI Studio
//   npx wrangler deploy

export interface Env {
  GEMINI_API_KEY: string
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
    if (!env.GEMINI_API_KEY) return json(500, { error: 'GEMINI_API_KEY is not configured' })

    let body: { model?: string; messages?: ChatMessage[]; temperature?: number }
    try {
      body = await request.json()
    } catch {
      return json(400, { error: 'invalid json' })
    }

    const messages = Array.isArray(body.messages) ? body.messages : []
    const system = messages
      .filter((m) => m.role === 'system')
      .map((m) => String(m.content ?? ''))
      .join('\n')
    const user = messages
      .filter((m) => m.role === 'user')
      .map((m) => String(m.content ?? ''))
      .join('\n')
    if (!user.trim()) return json(400, { error: 'no user message' })
    if (user.length > 20_000) return json(413, { error: 'text too long' })

    const model = body.model || 'gemini-2.0-flash'
    const temperature = typeof body.temperature === 'number' ? body.temperature : 0.3
    const words = user.trim().split(/\s+/).length
    const payload: Record<string, unknown> = {
      contents: [{ role: 'user', parts: [{ text: user }] }],
      generationConfig: {
        temperature,
        // Long enough for a full rewrite, capped so a dodge can't blow up.
        maxOutputTokens: Math.min(4096, Math.max(256, words * 4 + 120)),
      },
    }
    if (system.trim()) payload.systemInstruction = { parts: [{ text: system }] }

    const params = new URLSearchParams({ key: env.GEMINI_API_KEY })
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
  },
}
