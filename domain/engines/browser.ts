// The in-browser editing engine — a small Qwen model (Qwen2.5, 4-bit) that runs
// entirely on the user's device via transformers.js + ONNX runtime. Downloaded
// once from Hugging Face (~1–2 GB, cached in the browser), then edits work with
// no server, no API key, and no data leaving the machine. Two sizes are offered
// (light / stronger); the model picker in settings chooses which.
//
// The engine loads lazily so the app stays light until the model is used or
// downloaded. The "installed" flag survives reloads, so a cached model is
// reused instead of silently falling back to the rules. Top-level code touches
// no browser APIs — everything runs inside functions — so this module is safe
// to import during static prerendering.

import type { WritingMode } from '../modes'
import { HARDENING_RULE, ONLINE_RULES, brokenReasons, hasMarkdown } from './editing'

// Qwen2.5 writes far better Persian than the old Gemma 1B pick. q4f16 lands at
// roughly 0.5 bytes/param, so 1.5B ≈ 1 GB and 3B ≈ 1.8 GB — small enough for
// the "don't fill up the phone" ask.
export const LOCAL_MODELS = {
  'qwen-1.5b': { id: 'onnx-community/Qwen2.5-1.5B-Instruct-ONNX', sizeMB: 1024 },
  'qwen-3b': { id: 'onnx-community/Qwen2.5-3B-Instruct-ONNX', sizeMB: 1840 },
} as const

export type LocalModelId = keyof typeof LOCAL_MODELS

export const MODEL_DTYPE = 'q4f16'

const INSTALLED_KEY = 'virastar-model-installed'

export type ModelState = 'idle' | 'downloading' | 'ready' | 'error'

export interface ModelStatus {
  state: ModelState
  /** 0..100 while downloading, otherwise 0 or 100. */
  progress: number
  error?: string
  /** The local model this status belongs to, once loading/downloading. */
  modelId?: LocalModelId
}

let status: ModelStatus = { state: 'idle', progress: 0 }
const listeners = new Set<() => void>()

export function getModelStatus(): ModelStatus {
  return status
}

export function subscribeModelStatus(callback: () => void): () => void {
  listeners.add(callback)
  return () => {
    listeners.delete(callback)
  }
}

function setStatus(next: ModelStatus): void {
  status = next
  listeners.forEach((callback) => callback())
}

type GenerationResult = { generated_text: unknown }
type TextGenerator = (
  chats: Array<{ role: string; content: string }>,
  options: Record<string, unknown>,
) => Promise<GenerationResult | GenerationResult[]>

let pipelinePromise: Promise<TextGenerator> | null = null
let pipelineModelId: LocalModelId | null = null

// Per-file bytes as transformers.js streams each file, so the progress bar
// reflects the whole download instead of resetting on every file.
type ProgressInfo = { status: string; file?: string; progress?: number; loaded?: number; total?: number }
const fileProgress = new Map<string, { loaded: number; total: number }>()

function overallProgress(): number {
  let loaded = 0
  let total = 0
  for (const entry of fileProgress.values()) {
    loaded += entry.loaded
    total += Math.max(entry.total, entry.loaded)
  }
  return total === 0 ? 0 : Math.min(99, Math.round((loaded / total) * 100))
}

async function ensureLoaded(modelId: LocalModelId): Promise<TextGenerator> {
  if (pipelinePromise && pipelineModelId === modelId) return pipelinePromise
  pipelineModelId = modelId
  pipelinePromise = loadModel(modelId).catch((error) => {
    // Let a failed load be retried instead of caching the rejection forever.
    pipelinePromise = null
    pipelineModelId = null
    throw error
  })
  return pipelinePromise
}

async function loadModel(modelId: LocalModelId): Promise<TextGenerator> {
  const model = LOCAL_MODELS[modelId].id
  const transformers = await import('@huggingface/transformers')
    transformers.env.allowLocalModels = false
    transformers.env.useBrowserCache = true

    const progressCallback = (info: ProgressInfo) => {
      if (!info.file) return
      if (info.status === 'download') {
        fileProgress.set(info.file, { loaded: 0, total: 0 })
      } else if (info.status === 'progress' && typeof info.loaded === 'number') {
        fileProgress.set(info.file, { loaded: info.loaded, total: info.total ?? info.loaded })
        setStatus({ state: 'downloading', progress: overallProgress(), modelId })
      } else if (info.status === 'done' || info.status === 'ready') {
        const entry = fileProgress.get(info.file)
        if (entry) entry.loaded = entry.total
        setStatus({ state: 'downloading', progress: overallProgress(), modelId })
      }
    }

    // WebGPU is much faster on supported machines; WASM is the universal
    // fallback (slower, but runs everywhere).
    for (const device of ['webgpu', 'wasm'] as const) {
      try {
        const generator = (await transformers.pipeline('text-generation', model, {
          dtype: MODEL_DTYPE,
          device,
          progress_callback: progressCallback,
        })) as unknown as TextGenerator
        setStatus({ state: 'ready', progress: 100, modelId })
        try {
          localStorage.setItem(INSTALLED_KEY, modelId)
        } catch {
          /* storage unavailable */
        }
        return generator
      } catch (error) {
        setStatus({ state: 'error', progress: 0, error: String(error), modelId })
      }
    }
    throw new Error('model could not be loaded')
}

/** Ready specifically for `modelId` (a different model may be loaded). */
export function isModelReady(modelId?: LocalModelId): boolean {
  if (!modelId) return status.state === 'ready'
  return status.state === 'ready' && status.modelId === modelId
}

/** True when `modelId` was installed before, even if not loaded yet. */
export function wasModelInstalled(modelId: LocalModelId): boolean {
  if (typeof localStorage === 'undefined') return false
  try {
    return localStorage.getItem(INSTALLED_KEY) === modelId
  } catch {
    return false
  }
}

/** Reuse a previously-installed model from the browser cache on page load. */
export function restoreModel(modelId: LocalModelId): void {
  if (status.state !== 'idle' || !wasModelInstalled(modelId)) return
  void ensureLoaded(modelId)
}

export async function downloadModel(modelId: LocalModelId): Promise<void> {
  if (status.state === 'downloading') return
  setStatus({ state: 'downloading', progress: 0, modelId })
  try {
    await ensureLoaded(modelId)
  } catch {
    // status already carries the error
  }
}

export async function removeModel(modelId: LocalModelId): Promise<void> {
  pipelinePromise = null
  pipelineModelId = null
  setStatus({ state: 'idle', progress: 0 })
  fileProgress.clear()
  try {
    localStorage.removeItem(INSTALLED_KEY)
  } catch {
    /* storage unavailable */
  }
  const model = LOCAL_MODELS[modelId].id
  if (typeof caches === 'undefined') return
  try {
    const keys = await caches.keys()
    await Promise.all(
      keys.map(async (key) => {
        const cache = await caches.open(key)
        const requests = await cache.keys()
        const doomed = requests.filter((request) => request.url.includes(model))
        await Promise.all(doomed.map((request) => cache.delete(request)))
      }),
    )
  } catch {
    // cache removal is best-effort
  }
}

export async function editWithModel(input: string, mode: WritingMode, modelId: LocalModelId): Promise<string> {
  const generator = await ensureLoaded(modelId)
  const system = [
    mode.instruction,
    ONLINE_RULES,
    'متن را عیناً بازنویسی کن، نه درباره‌اش؛ چیزی به آن اضافه نکن و حذفش نکن. عنوان، ستاره، گلوله و هر علامت Markdown ننویس؛ «هدف ما»، «هدف از این»، «در ادامه»، «پیشنهاد می‌شود» و جمله‌های سخنرانی‌گونه ننویس.',
  ].join('\n\n')
  // A short letter needs only ~150 tokens; capping by input length stops a
  // small model padding a rewrite out into an essay.
  const max_new_tokens = Math.min(420, Math.max(240, Math.round(input.split(/\s+/).length * 3) + 60))
  const sampling = {
    max_new_tokens,
    temperature: 0.4,
    do_sample: true,
    repetition_penalty: 1.1,
  }

  // Log which guard rejected each attempt so a dodge is diagnosable from the
  // console instead of a black box; the cleaned text keeps the trail readable.
  const produce = async (label: string, sys: string, usr: string, opts: Record<string, unknown>) => {
    const raw = await generateText(generator, [{ role: 'system', content: sys }, { role: 'user', content: usr }], opts)
    const cleaned = cleanOutput(raw)
    console.warn(`[browser-model][${label}]`, JSON.stringify(cleaned).slice(0, 400))
    return cleaned
  }

  try {
    const first = await produce('first', system, input, sampling)
    const firstProblems = brokenReasons(first, input, mode)
    const firstMarkdown = hasMarkdown(first)
    if (firstProblems.length === 0 && !firstMarkdown) return first

    // The model dodged the task (wrote about the text, added markdown, echoed
    // instructions). Retry once, more deterministically, framing the input as
    // data to edit rather than a request.
    const retry = await produce('retry', `${system}\n\n${HARDENING_RULE}`, `متن:\n«${input}»`, { ...sampling, temperature: 0.2 })
    const retryProblems = brokenReasons(retry, input, mode)
    const retryMarkdown = hasMarkdown(retry)
    if (retryProblems.length > 0 || retryMarkdown) {
      console.warn('[browser-model] rejected:', JSON.stringify({ problems: retryProblems, markdown: retryMarkdown }))
      throw new Error('model returned an unedited response')
    }
    return retry
  } catch (error) {
    console.error('[browser-model] edit failed:', error)
    throw error
  }
}

// Strip the markdown scaffolding the model sometimes wraps a rewrite in.
function cleanOutput(text: string): string {
  return text
    .replace(/\*\*/g, '')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/^\s*[-*]\s+/gm, '')
    .replace(/^\s*>\s?/gm, '')
    .trim()
}

async function generateText(
  generator: TextGenerator,
  chat: Array<{ role: string; content: string }>,
  options: Record<string, unknown>,
): Promise<string> {
  const result = await generator(chat, options)
  const first = Array.isArray(result) ? result[0] : result
  const text = first?.generated_text
  if (typeof text === 'string') return text.trim()
  // Chat input: v4 returns the whole conversation — either an object with a
  // `messages` array or the bare message array itself. The assistant's reply
  // is the last one; take it so we never hand the UI a conversation blob.
  const messages = Array.isArray(text)
    ? text
    : (text as { messages?: Array<{ role?: string; content?: unknown }> })?.messages
  if (Array.isArray(messages)) {
    const last = [...messages].reverse().find((m) => m.role === 'assistant' || m.role === 'model')
    if (last) {
      if (typeof last.content === 'string') return last.content.trim()
      if (Array.isArray(last.content)) {
        const textPart = last.content.find(
          (part: unknown) => part && typeof part === 'object' && typeof (part as { text?: unknown }).text === 'string',
        )
        if (textPart) return (textPart as { text: string }).text.trim()
      }
    }
  }
  console.error('[browser-model] unexpected result shape:', JSON.stringify(text).slice(0, 300))
  throw new Error('model returned no text')
}
