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
  /** The worker model id for online editing (e.g. gemini-3.6-flash). */
  model: string
  /** Which worker backend to route to: 'gemini' | 'workersai' | 'hf'. */
  backend?: string
  /** The chosen local model, or '' for online-only. */
  localModel?: LocalModelId | ''
}

// The hosted edit server (Cloudflare Worker fronting Google Gemini + Workers
// AI; see worker/README.md). A per-browser override can be set with
// localStorage.setItem('virastar-server', 'https://<your>.workers.dev').
export const HOSTED_ENDPOINT = 'https://virastar-edit.kharkhan.workers.dev'

export const DEFAULT_SETTINGS: EngineSettings = {
  engine: 'online',
  endpoint: HOSTED_ENDPOINT,
  model: 'gemini-3.6-flash',
  backend: 'gemini',
  localModel: '',
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
    label: 'گوگل جمینی',
    description: 'بهترین کیفیت فارسی؛ پیش‌فرض ویراستار. رایگان.',
    badge: 'پیش‌فرض',
    backend: 'gemini',
    model: 'gemini-3.6-flash',
  },
  {
    id: 'online-qwen',
    kind: 'online',
    label: 'قوِن آنلاین (رایگان)',
    description: 'فارسیِ خیلی خوب؛ از طریق سرور رایگان Cloudflare. بدون نصب.',
    badge: 'رایگان',
    backend: 'workersai',
    model: '@cf/qwen/qwen3-30b-a3b-fp8',
  },
  {
    id: 'local-qwen-1.5b',
    kind: 'local',
    label: 'قوِن محلی سبک',
    description: 'حدود ۱ گیگابایت دانلود؛ کاملاً آفلاین و خصوصی روی همین دستگاه.',
    localModel: 'qwen-1.5b',
    sizeMB: LOCAL_MODELS['qwen-1.5b'].sizeMB,
  },
  {
    id: 'local-qwen-3b',
    kind: 'local',
    label: 'قوِن محلی قوی‌تر',
    description: 'حدود ۱.۸ گیگابایت دانلود؛ کاملاً آفلاین، کیفیت بالاتر.',
    localModel: 'qwen-3b',
    sizeMB: LOCAL_MODELS['qwen-3b'].sizeMB,
  },
  {
    id: 'rules',
    kind: 'rules',
    label: 'فقط قواعد (بدون هوش مصنوعی)',
    description: 'اصلاح سریع با قواعد نوشتاری؛ هیچ درخواستی به سرور نمی‌رود.',
  },
]

/** Which dropdown option the current settings represent. */
export function modelChoiceFromSettings(s: EngineSettings): string {
  if (s.localModel && LOCAL_MODELS[s.localModel]) return `local-${s.localModel}`
  if (s.engine === 'offline') return 'rules'
  if (s.backend === 'workersai') return 'online-qwen'
  return 'online-gemini'
}

/** Settings that put `id` into effect, keeping the user's endpoint. */
export function settingsForModelChoice(id: string, endpoint: string): EngineSettings {
  const option = MODEL_OPTIONS.find((o) => o.id === id) ?? MODEL_OPTIONS[0]
  const base = { engine: 'online' as EngineKind, endpoint }
  if (option.kind === 'rules') return { ...base, model: '', backend: 'gemini', localModel: '' }
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

  // A locally-installed model edits privately on the device. Used automatically
  // once the chosen local model is downloaded — installing it is the only step.
  if (localId && (isModelReady(localId) || wasModelInstalled(localId))) {
    try {
      const output = await editWithModel(input, mode, localId)
      return {
        output,
        changed: countWordDiffs(input, output),
        engine: 'offline',
        notes: [
          `«${mode.label}» با موتور محلی روی همین دستگاه انجام شد.`,
          'آفلاین و خصوصی — هیچ‌چیز از دستگاه خارج نشد.',
        ],
      }
    } catch {
      // model hiccuped — fall through to the online engine, then the rules
    }
  }

  // Default path: the hosted (or custom) online engine. Power users can point
  // `settings.endpoint` at any OpenAI-compatible service (Ollama, etc.).
  const endpoint = readServerOverride() ?? settings.endpoint
  if (settings.engine === 'online' && endpoint) {
    try {
      const output = await editOnline(input, mode, {
        endpoint,
        model: settings.model,
        backend: settings.backend,
        onPartial,
      })
      return {
        output,
        changed: countWordDiffs(input, output),
        engine: 'online',
        notes: [
          `«${mode.label}» با هوش مصنوعی آنلاین انجام شد.`,
          'ویرایش واقعی هوش مصنوعی — نتیجه را خودت قضاوت کن.',
        ],
      }
    } catch {
      // online engine failed or isn't live yet — fall through to the rules so
      // the user still gets an edit
    }
  }

  const offline: OfflineResult = editOffline(input, mode)
  return {
    ...offline,
    engine: 'offline',
    notes: [
      'موتور آنلاین در دسترس نبود؛ با قواعد سریع ویرایش شد.',
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
