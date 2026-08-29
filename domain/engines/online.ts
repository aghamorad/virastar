// The online editing engine — a thin, OpenAI-compatible chat-completions
// client for power users (Ollama, or any OpenAI-compatible service). The
// mode's `instruction` is the system prompt; the user text is the message.
// Kept out of the product UI — the default experience is the in-browser model.
// If it fails, the caller falls back to the offline rules, so the app never
// breaks.

import type { WritingMode } from '../modes'
import { HARDENING_RULE, ONLINE_RULES, looksBroken } from './editing'

// Kept for the dataset scripts, which import the shared prompt from here.
export { ONLINE_RULES } from './editing'

export interface OnlineOptions {
  endpoint: string
  model: string
}

async function request(endpoint: string, body: unknown): Promise<string> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 30_000)
  let res: Response
  try {
    res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
  } finally {
    window.clearTimeout(timeout)
  }
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
  // once, more deterministically, framing the input as data to edit.
  const retry = await request(endpoint, {
    ...body,
    temperature: 0.1,
    messages: [
      { role: 'system', content: `${system}\n\n${HARDENING_RULE}` },
      { role: 'user', content: `متن:\n«${input}»` },
    ],
  })
  if (looksBroken(retry, input, mode)) {
    throw new Error('online engine returned an unedited response')
  }
  return retry
}
