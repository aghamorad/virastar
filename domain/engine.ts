// The editor engine facade. The default is a hosted online engine: a free
// Cloudflare Worker (`worker/`) fronts Google Gemini, so editing works with
// zero setup and no API key anywhere near the user. Installing the optional
// in-browser Gemma model (settings → model) upgrades the app to fully offline,
// private editing — once installed, the local model takes over automatically.
// If the online engine fails or isn't configured, editing falls back to the
// deterministic Persian rules, so the app never stops working.

import { getMode } from './modes'
import { editOffline, type OfflineResult } from './engines/offline'
import { editOnline } from './engines/online'
import { editWithModel, isModelReady, wasModelInstalled } from './engines/browser'

export type EngineKind = 'offline' | 'online'

export interface EngineSettings {
  engine: EngineKind
  endpoint: string
  model: string
}

// The hosted edit server. Replace with the real Workers URL once deployed
// (see worker/README.md). A temporary override can be set per-browser with
// localStorage.setItem('virastar-server', 'https://<your>.workers.dev').
export const HOSTED_ENDPOINT = 'https://virastar-edit.your-subdomain.workers.dev'

export const DEFAULT_SETTINGS: EngineSettings = {
  engine: 'online',
  endpoint: HOSTED_ENDPOINT,
  model: 'gemini-2.0-flash',
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
): Promise<EditResult> {
  const mode = getMode(modeId)

  // A locally-installed model edits privately on the device — the product's
  // offline upgrade. Used automatically so installing it is the only step.
  if (isModelReady() || wasModelInstalled()) {
    try {
      const output = await editWithModel(input, mode)
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
