// The editor engine facade. The product's default is the in-browser model:
// a small Google Gemma that downloads once and then edits fully offline. Until
// the model is downloaded, editing falls back to the deterministic Persian
// rules, so the app always works. A custom online endpoint (Ollama or any
// OpenAI-compatible service) remains available to power users via settings,
// but nothing in the UI advertises it.

import { getMode } from './modes'
import { editOffline, type OfflineResult } from './engines/offline'
import { editOnline } from './engines/online'
import { editWithModel, isModelReady, wasModelInstalled, MODEL_ID } from './engines/browser'

export type EngineKind = 'offline' | 'online'

export interface EngineSettings {
  engine: EngineKind
  endpoint: string
  model: string
}

export const DEFAULT_SETTINGS: EngineSettings = {
  engine: 'offline',
  endpoint: '',
  model: MODEL_ID,
}

export interface EditResult {
  output: string
  changed: number
  engine: EngineKind
  /** Tells the reader what actually happened — in Persian. */
  notes: string[]
}

export async function runEdit(
  input: string,
  modeId: string,
  settings: EngineSettings,
): Promise<EditResult> {
  const mode = getMode(modeId)

  // Power-user path: a configured online endpoint (Ollama / OpenAI-compatible).
  if (settings.engine === 'online' && settings.endpoint) {
    try {
      const output = await editOnline(input, mode, {
        endpoint: settings.endpoint,
        model: settings.model,
      })
      return {
        output,
        changed: countWordDiffs(input, output),
        engine: 'online',
        notes: [
          `«${mode.label}» با موتور آنلاین انجام شد.`,
          'ویرایش واقعی هوش مصنوعی — نتیجه را خودت قضاوت کن.',
        ],
      }
    } catch {
      const offline = editOffline(input, mode)
      return {
        ...offline,
        engine: 'offline',
        notes: [
          'موتور آنلاین پاسخ درست نداد؛ با موتور آفلاین ویرایش شد.',
          ...offline.notes,
        ],
      }
    }
  }

  // Default path: the in-browser model, or the fast rules until it downloads.
  // A previously-installed model is used even before this page restores its
  // status — editWithModel loads it from the browser cache on demand.
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
      // model hiccuped — fall through to the rules so the user still gets an edit
    }
  }

  const offline: OfflineResult = editOffline(input, mode)
  return {
    ...offline,
    engine: 'offline',
    notes: isModelReady()
      ? ['مدل محلی به درستی جواب نداد؛ با قواعد سریع ویرایش شد.', ...offline.notes]
      : ['مدل محلی هنوز دانلود نشده؛ با قواعد سریع ویرایش شد.', ...offline.notes],
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
