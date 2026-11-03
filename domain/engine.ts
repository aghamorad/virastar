// The editor engine facade. A model picker in settings lets the user choose
// where editing happens: an online model (Google Gemini, or a free Qwen served
// by Cloudflare's Workers AI) with zero setup and no key near the user, or a
// small Qwen model downloaded to the device for fully offline, private editing.
// If the chosen engine fails, editing falls back to the deterministic Persian
// rules, so the app never stops working.

import { getMode } from './modes'
import { editOffline, type OfflineResult } from './engines/offline'
import { editOnline } from './engines/online'
import {
  editWithModel,
  isModelReady,
  wasModelInstalled,
  LOCAL_MODELS,
  type LocalModelId,
} from './engines/browser'

export type EngineKind = 'offline' | 'online'

export interface EngineSettings {
  engine: EngineKind
  endpoint: string
  /** The worker model id for online editing (e.g. gemini-2.5-flash). */
  model: string
  /** Which worker backend to route to: 'gemini' | 'workersai' | 'direct-gemini' | 'direct-groq' | 'local-ollama' | 'hf'. */
  backend?: string
  /** The chosen local model, or '' for online-only. */
  localModel?: LocalModelId | ''
  /** Optional user-provided Google Gemini API key (free tier) */
  geminiApiKey?: string
  /** Optional user-provided Groq API key (free tier) */
  groqApiKey?: string
  /** Custom endpoint (e.g. http://localhost:11434/v1 for Ollama) */
  customEndpoint?: string
  customModel?: string
}

// The hosted edit server (Cloudflare Worker fronting Google Gemini + Workers
// AI; see worker/README.md). A per-browser override can be set with
// localStorage.setItem('virastar-server', 'https://<your>.workers.dev').
export const HOSTED_ENDPOINT = 'https://virastar-edit.kharkhan.workers.dev'

export const DEFAULT_SETTINGS: EngineSettings = {
  engine: 'online',
  endpoint: HOSTED_ENDPOINT,
  model: 'gemini-2.5-flash',
  backend: 'gemini',
  localModel: '',
  geminiApiKey: '',
  groqApiKey: '',
  customEndpoint: 'http://localhost:11434/v1',
  customModel: 'qwen2.5:1.5b',
}

export interface ModelOption {
  id: string
  kind: 'online' | 'local' | 'rules'
  label: string
  description: string
  badge?: string
  backend?: string
  model?: string
  localModel?: LocalModelId
  sizeMB?: number
}

// The settings dropdown. Order matters: the default (Gemini) is first.
export const MODEL_OPTIONS: ModelOption[] = [
  {
    id: 'online-gemini',
    kind: 'online',
    label: 'گوگل جمینی (پیش‌فرض سرور ویراستار)',
    description: 'بهترین کیفیت و لحن فارسی؛ بدون نیاز به کلید یا نصب. رایگان.',
    badge: 'پیش‌فرض',
    backend: 'gemini',
    model: 'gemini-2.5-flash',
  },
  {
    id: 'online-qwen',
    kind: 'online',
    label: 'قوِن آنلاین (رایگان Cloudflare)',
    description: 'فارسیِ قوی و بدون نیاز به کلید از طریق سرور کلودفلر Workers AI.',
    badge: 'رایگان',
    backend: 'workersai',
    model: '@cf/qwen/qwen2.5-7b-instruct',
  },
  {
    id: 'direct-gemini',
    kind: 'online',
    label: 'کلید اختصاصی Google Gemini (رایگان)',
    description: 'اتصال مستقیم و پرسرعت به حساب AI Studio شما؛ روزانه ۱۵۰۰ ویرایش رایگان بدون کارت بانکی.',
    badge: 'پیشنهادی',
    backend: 'direct-gemini',
    model: 'gemini-2.5-flash',
  },
  {
    id: 'direct-groq',
    kind: 'online',
    label: 'کلید اختصاصی Groq (فوق‌سریع — رایگان)',
    description: 'مدل Qwen 2.5 32B با سرعت بسیار بالا روی سرورهای ابری Groq (رایگان).',
    badge: 'سریع',
    backend: 'direct-groq',
    model: 'qwen-2.5-32b',
  },
  {
    id: 'local-ollama',
    kind: 'online',
    label: 'سرور محلی Ollama / LM Studio (روی مک)',
    description: 'اتصال مستقیم به مدل‌های آفلاین نصب‌شده روی سیستم شما (مانند qwen2.5:1.5b).',
    badge: 'محلی',
    backend: 'local-ollama',
    model: 'qwen2.5:1.5b',
  },
  {
    id: 'local-qwen-0.5b',
    kind: 'local',
    label: 'قوِن درون مرورگر فوق‌سبک (۰.۵B)',
    description: 'حدود ۳۸۰ مگابایت دانلود؛ کاملاً آفلاین در حافظه مرورگر برای گوشی و سیستم‌های سبک.',
    localModel: 'qwen-0.5b',
    sizeMB: LOCAL_MODELS['qwen-0.5b'].sizeMB,
  },
  {
    id: 'local-qwen-1.5b',
    kind: 'local',
    label: 'قوِن درون مرورگر استاندارد (۱.۵B)',
    description: 'حدود ۱ گیگابایت دانلود؛ آفلاین و خصوصی با کیفیت فارسی عالی روی همین دستگاه.',
    localModel: 'qwen-1.5b',
    sizeMB: LOCAL_MODELS['qwen-1.5b'].sizeMB,
  },
  {
    id: 'local-qwen-3b',
    kind: 'local',
    label: 'قوِن درون مرورگر پیشرفته (۳B)',
    description: 'حدود ۱.۸ گیگابایت دانلود؛ بالاترین کیفیت آفلاین فارسی در مرورگر.',
    localModel: 'qwen-3b',
    sizeMB: LOCAL_MODELS['qwen-3b'].sizeMB,
  },
  {
    id: 'rules',
    kind: 'rules',
    label: 'فقط قواعد نگارشی (بدون هوش مصنوعی)',
    description: 'اصلاح سریع غلط‌های املایی و نیم‌فاصله با قواعد دستوری بدون اتصال اینترنت.',
  },
]

/** Which dropdown option the current settings represent. */
export function modelChoiceFromSettings(s: EngineSettings): string {
  if (s.localModel && LOCAL_MODELS[s.localModel]) return `local-${s.localModel}`
  if (s.engine === 'offline') return 'rules'
  if (s.backend === 'direct-gemini') return 'direct-gemini'
  if (s.backend === 'direct-groq') return 'direct-groq'
  if (s.backend === 'local-ollama') return 'local-ollama'
  if (s.backend === 'workersai') return 'online-qwen'
  return 'online-gemini'
}

/** Settings that put `id` into effect, keeping the user's endpoint and keys. */
export function settingsForModelChoice(id: string, current: EngineSettings): EngineSettings {
  const option = MODEL_OPTIONS.find((o) => o.id === id) ?? MODEL_OPTIONS[0]
  const base = {
    ...current,
    engine: 'online' as EngineKind,
  }
  if (option.kind === 'rules') return { ...base, engine: 'offline', model: '', backend: 'rules', localModel: '' }
  if (option.kind === 'local') return { ...base, model: '', backend: 'gemini', localModel: option.localModel }
  return { ...base, model: option.model ?? '', backend: option.backend ?? 'gemini', localModel: '' }
}

export interface EditResult {
  output: string
  changed: number
  engine: EngineKind
  /** Tells the reader what actually happened — in Persian. */
  notes: string[]
}

/** A per-browser endpoint override, so the server URL can change without a rebuild. */
function readServerOverride(): string | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const value = localStorage.getItem('virastar-server')
    return value && value.trim() ? value.trim() : null
  } catch {
    return null
  }
}

export async function runEdit(
  input: string,
  modeId: string,
  settings: EngineSettings,
  onPartial?: (text: string) => void,
): Promise<EditResult> {
  const mode = getMode(modeId)
  const localId = settings.localModel && LOCAL_MODELS[settings.localModel] ? settings.localModel : undefined
  let lastError: string | null = null

  // 1. In-browser local model (Qwen 0.5B, 1.5B, 3B)
  if (localId && (isModelReady(localId) || wasModelInstalled(localId))) {
    try {
      const output = await editWithModel(input, mode, localId)
      return {
        output,
        changed: countWordDiffs(input, output),
        engine: 'offline',
        notes: [
          `«${mode.label}» با موتور محلی (${LOCAL_MODELS[localId].label || localId}) روی همین دستگاه انجام شد.`,
          'کاملاً آفلاین و امن — هیچ متنی از دستگاه خارج نشد.',
        ],
      }
    } catch (err) {
      console.error('Local model edit failed:', err)
      lastError = err instanceof Error ? err.message : String(err)
    }
  }

  // 2. Online engine: Direct Gemini API, Direct Groq API, Local Ollama, or Virastar Cloud Worker
  const endpoint = readServerOverride() ?? settings.endpoint
  if (settings.engine === 'online') {
    try {
      const output = await editOnline(input, mode, {
        endpoint,
        model: settings.model,
        backend: settings.backend,
        geminiApiKey: settings.geminiApiKey,
        groqApiKey: settings.groqApiKey,
        customEndpoint: settings.backend === 'local-ollama' ? settings.customEndpoint : undefined,
        customModel: settings.customModel,
        onPartial,
      })

      let engineDescription = 'هوش مصنوعی سرور ویراستار'
      if (settings.backend === 'direct-gemini' || (settings.geminiApiKey && settings.geminiApiKey.trim())) {
        engineDescription = 'گوگل جمینی مستقیم'
      } else if (settings.backend === 'direct-groq' || (settings.groqApiKey && settings.groqApiKey.trim())) {
        engineDescription = 'Groq فوق‌سریع'
      } else if (settings.backend === 'local-ollama') {
        engineDescription = 'سرور محلی Ollama'
      } else if (settings.backend === 'workersai') {
        engineDescription = 'قوِن کلودفلر'
      }

      return {
        output,
        changed: countWordDiffs(input, output),
        engine: 'online',
        notes: [
          `«${mode.label}» با ${engineDescription} انجام شد.`,
          'ویرایش هوشمند و لحن‌بندی با موفقیت انجام شد.',
        ],
      }
    } catch (err) {
      console.error('Online edit failed:', err)
      lastError = err instanceof Error ? err.message : String(err)
    }
  }

  // 3. Fallback: Fast deterministic rules
  const offline: OfflineResult = editOffline(input, mode)
  return {
    ...offline,
    engine: 'offline',
    notes: [
      lastError
        ? `اتصال به هوش مصنوعی با خطا مواجه شد (${lastError})؛ ویرایش بر اساس قواعد دستوری سریع انجام شد.`
        : 'ویرایش با قواعد دستوری و اصلاح املایی سریع انجام شد.',
      ...offline.notes,
    ],
  }
}

function countWordDiffs(a: string, b: string): number {
  const aw = a.split(/\s+/)
  const bw = b.split(/\s+/)
  let n = 0
  const len = Math.max(aw.length, bw.length)
  for (let i = 0; i < len; i++) if (aw[i] !== bw[i]) n++
  return n
}
